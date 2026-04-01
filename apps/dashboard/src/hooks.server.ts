import type { Handle } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { initializeSchema } from '@fuelnsw/shared/db/schema';
import { closeDb } from '@fuelnsw/shared/db/client';
import { brotliCompress, gzip as gzipCompress } from 'node:zlib';

let started = false;

const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 60;
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function getClientIp(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	const realIp = request.headers.get('x-real-ip');
	if (realIp) {
		return realIp.trim();
	}
	return 'unknown';
}

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = rateLimitStore.get(ip);

	if (!entry || now - entry.windowStart > rateLimitWindowMs) {
		rateLimitStore.set(ip, { count: 1, windowStart: now });
		return true;
	}

	entry.count++;
	if (entry.count > rateLimitMaxRequests) {
		return false;
	}
	return true;
}

setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of rateLimitStore) {
		if (now - entry.windowStart > rateLimitWindowMs) {
			rateLimitStore.delete(ip);
		}
	}
}, 60_000);

const securityHeaders: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self'"
};

const COMPRESSION_THRESHOLD = 1024;

const brotliCompressP = (buf: Buffer) => new Promise<Buffer>((res, rej) =>
	brotliCompress(buf, { params: { [require('zlib').constants.BROTLI_PARAM_QUALITY]: 4 } }, (err, result) => err ? rej(err) : res(result))
);
const gzipCompressP = (buf: Buffer) => new Promise<Buffer>((res, rej) =>
	gzipCompress(buf, { level: 6 }, (err, result) => err ? rej(err) : res(result))
);

function setupGracefulShutdown(): void {
	const shutdown = (signal: string) => {
		console.log(`[dashboard] Received ${signal}, shutting down gracefully...`);
		try {
			closeDb();
		} catch (e) {
			console.error('[dashboard] Error closing database:', e);
		}
		process.exit(0);
	};

	process.on('SIGTERM', () => shutdown('SIGTERM'));
	process.on('SIGINT', () => shutdown('SIGINT'));
}

export const handle: Handle = async ({ event, resolve }) => {
	if (!started) {
		started = true;
		initializeSchema();
		setupGracefulShutdown();
	}

	if (event.url.pathname.startsWith('/api/')) {
		const ip = getClientIp(event.request);
		if (!checkRateLimit(ip)) {
			return json({ error: 'Too many requests' }, { status: 429 });
		}
	}

	const response = await resolve(event);

	for (const [key, value] of Object.entries(securityHeaders)) {
		response.headers.set(key, value);
	}

	if (process.env.ORIGIN) {
		const existingHsts = response.headers.get('Strict-Transport-Security');
		if (!existingHsts) {
			response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
		}
	}

	const acceptEncoding = event.request.headers.get('accept-encoding') || '';
	if (acceptEncoding && response.body && !response.headers.get('Content-Encoding') && response.clone) {
		try {
			const cloned = response.clone();
			const buf = await cloned.arrayBuffer();
			if (buf.byteLength >= COMPRESSION_THRESHOLD) {
				const body = Buffer.from(buf);
				const newHeaders = new Headers(response.headers);
				newHeaders.delete('Content-Length');
				newHeaders.set('Vary', 'Accept-Encoding');

				if (acceptEncoding.includes('br')) {
					const compressed = await brotliCompressP(body);
					newHeaders.set('Content-Encoding', 'br');
					return new Response(new Uint8Array(compressed), { status: response.status, statusText: response.statusText, headers: newHeaders });
				}

				if (acceptEncoding.includes('gzip')) {
					const compressed = await gzipCompressP(body);
					newHeaders.set('Content-Encoding', 'gzip');
					return new Response(new Uint8Array(compressed), { status: response.status, statusText: response.statusText, headers: newHeaders });
				}
			}
		} catch {
		}
	}

	return response;
};
