import type { Handle } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { initializeSchema } from '@fuelnsw/shared/db/schema';
import { backfillFromStaleRecords } from '@fuelnsw/shared/db/availability';
import { closeDb } from '@fuelnsw/shared/db/client';
import { brotliCompress, gzip as gzipCompress } from 'node:zlib';

let started = false;

const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 60;
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

const API_CACHE: Record<string, string> = {
	'/api/fuel/stations': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=600',
	'/api/fuel/stations/viewport': 'public, max-age=60, s-maxage=300, stale-while-revalidate=120',
	'/api/fuel/prices': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=600',
	'/api/dry-stations': 'public, max-age=120, s-maxage=600, stale-while-revalidate=300',
	'/api/health': 'public, max-age=30',
	'/api/fuel/history': 'public, max-age=600, s-maxage=3600',
	'/api/fuel/history/batch': 'public, max-age=600, s-maxage=3600',
};

function getClientIp(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		const ips = forwarded.split(',').map(s => s.trim());
		return ips[ips.length - 1] || 'unknown';
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
	'X-Frame-Options': 'SAMEORIGIN',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
	'Content-Security-Policy': [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://www.googletagmanager.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"img-src 'self' data: blob: https://*.tile.openstreetmap.org https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google-analytics.com https://www.googletagmanager.com",
		"connect-src 'self' https://ipapi.co https://overpass-api.de https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://www.google-analytics.com https://www.googletagmanager.com",
		"font-src 'self' https://fonts.gstatic.com",
		"frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://pagead2.googlesyndication.com",
		"worker-src 'self'",
		"manifest-src 'self'"
	].join('; ')
};

const CORS_ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);

function addCorsHeaders(request: Request, response: Response): void {
	const origin = request.headers.get('origin');
	if (!origin) return;

	if (CORS_ALLOWED_ORIGINS.length > 0 && CORS_ALLOWED_ORIGINS.includes(origin)) {
		response.headers.set('Access-Control-Allow-Origin', origin);
		response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
		response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		response.headers.set('Access-Control-Max-Age', '86400');
		response.headers.set('Vary', 'Origin');
	}
}

const COMPRESSION_THRESHOLD = 1024;

const brotliCompressP = (buf: Buffer) => new Promise<Buffer>((res, rej) =>
	brotliCompress(buf, { params: { [require('zlib').constants.BROTLI_PARAM_QUALITY]: 4 } }, (err, result) => err ? rej(err) : res(result))
);
const gzipCompressP = (buf: Buffer) => new Promise<Buffer>((res, rej) =>
	gzipCompress(buf, { level: 6 }, (err, result) => err ? rej(err) : res(result))
);

async function compressResponse(response: Response, acceptEncoding: string): Promise<Response> {
	if (response.status === 204 || response.status === 304) return response;

	const contentType = response.headers.get('content-type') || '';
	if (!contentType.includes('json') && !contentType.includes('text') && !contentType.includes('javascript') && !contentType.includes('xml')) {
		return response;
	}

	if (!response.body) return response;

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const body = Buffer.concat(chunks);

	if (body.length < COMPRESSION_THRESHOLD) return response;

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

	return response;
}

function setupGracefulShutdown(): void {
	const shutdown = (signal: string) => {
		console.log(`[server] Received ${signal}, shutting down gracefully...`);
		try {
			closeDb();
		} catch (e) {
			console.error('[server] Error closing database:', e);
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
		backfillFromStaleRecords();
		setupGracefulShutdown();
		import('@fuelnsw/shared/scheduler').then(m => m.startScheduler());
	}

	if (event.url.pathname.startsWith('/api/') && !event.url.pathname.startsWith('/api/fuel/history')) {
		const ip = getClientIp(event.request);
		if (!checkRateLimit(ip)) {
			return json({ error: 'Too many requests' }, { status: 429 });
		}
	}

	if (event.request.method === 'OPTIONS' && event.url.pathname.startsWith('/api/')) {
		const origin = event.request.headers.get('origin');
		if (CORS_ALLOWED_ORIGINS.length > 0 && origin && CORS_ALLOWED_ORIGINS.includes(origin)) {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': origin,
					'Access-Control-Allow-Methods': 'GET, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					'Access-Control-Max-Age': '86400'
				}
			});
		}
		return new Response(null, { status: 204 });
	}

	const response = await resolve(event);

	for (const [key, value] of Object.entries(securityHeaders)) {
		response.headers.set(key, value);
	}

	if (event.url.pathname.startsWith('/api/')) {
		addCorsHeaders(event.request, response);
	}

	for (const [prefix, cacheControl] of Object.entries(API_CACHE)) {
		if (event.url.pathname === prefix || event.url.pathname.startsWith(prefix + '?')) {
			response.headers.set('Cache-Control', cacheControl);
			break;
		}
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
			// compression failed, return original response
		}
	}

	return response;
};
