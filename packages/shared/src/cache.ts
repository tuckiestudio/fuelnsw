import NodeCache from 'node-cache';

export const dashboardCache = new NodeCache({
	stdTTL: 30,
	checkperiod: 60,
	useClones: true,
	maxKeys: 1000
});

export function getCachedStats(key: string): any | null {
	return dashboardCache.get(key) || null;
}

export function setCachedStats(key: string, value: any, ttl?: number): void {
	if (ttl) {
		dashboardCache.set(key, value, ttl);
	} else {
		dashboardCache.set(key, value);
	}
}

export function getCacheStats(): { keys: number; hits: number; misses: number; hitRate: number } {
	const stats = dashboardCache.getStats();
	return {
		keys: stats.keys,
		hits: stats.hits,
		misses: stats.misses,
		hitRate: stats.hits / (stats.hits + stats.misses) || 0
	};
}
