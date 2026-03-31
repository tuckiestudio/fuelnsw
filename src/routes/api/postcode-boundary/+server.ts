import { json } from '@sveltejs/kit';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { RequestHandler } from './$types';

const CACHE_DIR = path.resolve('data/boundaries');

async function ensureCacheDir() {
	if (!existsSync(CACHE_DIR)) {
		await mkdir(CACHE_DIR, { recursive: true });
	}
}

function cachePath(postcode: string) {
	return path.join(CACHE_DIR, `${postcode}.json`);
}

type Point = [number, number];

function mergeOuterWays(members: any[]): Point[][] {
	const outerWays: Point[][] = members
		.filter((m: any) => m.role === 'outer' && m.geometry && m.geometry.length >= 2)
		.map((m: any) =>
			m.geometry
				.map((p: any): Point => [p.lat, p.lon])
				.filter(([lat, lon]: Point) => Math.abs(lat) > 1 && Math.abs(lon) > 1)
		)
		.filter((w: Point[]) => w.length >= 2);

	if (outerWays.length === 0) return [];

	const remaining = [...outerWays];
	const rings: Point[][] = [];

	while (remaining.length > 0) {
		const ring: Point[] = remaining.shift()!;
		let changed = true;
		while (changed) {
			changed = false;
			for (let i = remaining.length - 1; i >= 0; i--) {
				const way = remaining[i];
				const rf = ring[0];
				const rl = ring[ring.length - 1];
				const wf = way[0];
				const wl = way[way.length - 1];

				if (rl[0] === wf[0] && rl[1] === wf[1]) {
					ring.push(...way.slice(1));
					remaining.splice(i, 1);
					changed = true;
				} else if (rl[0] === wl[0] && rl[1] === wl[1]) {
					ring.push(...way.slice(0, -1).reverse());
					remaining.splice(i, 1);
					changed = true;
				} else if (rf[0] === wl[0] && rf[1] === wl[1]) {
					ring.unshift(...way.slice(0, -1));
					remaining.splice(i, 1);
					changed = true;
				} else if (rf[0] === wf[0] && rf[1] === wf[1]) {
					ring.unshift(...way.slice(1).reverse());
					remaining.splice(i, 1);
					changed = true;
				}
			}
		}
		rings.push(ring);
	}
	return rings;
}

function pointInRing(pt: Point, ring: Point[]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [yi, xi] = ring[i];
		const [yj, xj] = ring[j];
		const [y, x] = pt;
		if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
			inside = !inside;
		}
	}
	return inside;
}

function ringArea(ring: Point[]): number {
	let area = 0;
	for (let i = 0; i < ring.length; i++) {
		const j = (i + 1) % ring.length;
		area += ring[i][1] * ring[j][0];
		area -= ring[j][1] * ring[i][0];
	}
	return Math.abs(area / 2);
}

function buildPostcodeOutline(elements: any[]): Point[][] {
	const allRings: { ring: Point[]; area: number }[] = [];

	for (const el of elements) {
		if (el.type === 'relation' && el.members) {
			const rings = mergeOuterWays(el.members);
			for (const ring of rings) {
				if (ring.length > 3) {
					allRings.push({ ring, area: ringArea(ring) });
				}
			}
		} else if (el.type === 'way' && el.geometry) {
			const coords: Point[] = el.geometry
				.map((p: any): Point => [p.lat, p.lon])
				.filter(([lat, lon]: Point) => Math.abs(lat) > 1 && Math.abs(lon) > 1);
			if (coords.length > 3) {
				allRings.push({ ring: coords, area: ringArea(coords) });
			}
		}
	}

	if (allRings.length === 0) return [];

	allRings.sort((a, b) => b.area - a.area);

	const outerRings: Point[][] = [];
	const used = new Set<number>();

	for (let i = 0; i < allRings.length; i++) {
		if (used.has(i)) continue;
		const candidate = allRings[i].ring;
		let isHole = false;
		for (let j = 0; j < i; j++) {
			if (used.has(j)) continue;
			if (pointInRing(candidate[0], allRings[j].ring)) {
				isHole = true;
				break;
			}
		}
		if (!isHole) {
			outerRings.push(candidate);
			used.add(i);
		}
	}

	return outerRings;
}

async function fetchFromOverpass(postcode: string) {
	const query = `[out:json][timeout:15];relation["boundary"="administrative"]["postal_code"="${postcode}"](-37.5,140.5,-27.5,154.0);out geom;`;

	const res = await fetch('https://overpass-api.de/api/interpreter', {
		method: 'POST',
		body: 'data=' + encodeURIComponent(query),
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
	});

	if (!res.ok) throw new Error(`Overpass API returned ${res.status}`);
	const data = await res.json();

	const outline = buildPostcodeOutline(data.elements || []);

	const cached = { outlines: outline };
	await ensureCacheDir();
	await writeFile(cachePath(postcode), JSON.stringify(cached));

	return cached;
}

export const GET: RequestHandler = async ({ url }) => {
	const postcode = url.searchParams.get('postcode');
	if (!postcode || !/^\d{4}$/.test(postcode)) {
		return json({ outlines: [] });
	}

	const pcNum = parseInt(postcode, 10);
	if (pcNum < 2000 || pcNum > 2999) {
		return json({ outlines: [] });
	}

	try {
		const cached = cachePath(postcode);
		if (existsSync(cached)) {
			const raw = await readFile(cached, 'utf-8');
			return json(JSON.parse(raw));
		}

		const data = await fetchFromOverpass(postcode);
		return json(data);
	} catch (e) {
		console.warn('Failed to fetch postcode boundary:', e);
		return json({ outlines: [] });
	}
};
