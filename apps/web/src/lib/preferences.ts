const KEYS = {
	fuelType: 'fuelnsw_fuelType',
	lastLat: 'fuelnsw_lastLat',
	lastLng: 'fuelnsw_lastLng',
	onboarded: 'fuelnsw_onboarded',
	removeAds: 'fuelnsw_removeAds',
	openOnly: 'fuelnsw_openOnly'
} as const;

function get<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function set(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
	}
}

export function getFuelType(): string {
	return get(KEYS.fuelType, 'E10');
}

export function setFuelType(fuelType: string): void {
	set(KEYS.fuelType, fuelType);
}

export function getLastPosition(): { lat: number; lng: number } | null {
	const lat = get<number | null>(KEYS.lastLat, null);
	const lng = get<number | null>(KEYS.lastLng, null);
	if (lat !== null && lng !== null) return { lat, lng };
	return null;
}

export function setLastPosition(lat: number, lng: number): void {
	set(KEYS.lastLat, lat);
	set(KEYS.lastLng, lng);
}

export function getOnboarded(): boolean {
	return get(KEYS.onboarded, false);
}

export function setOnboarded(): void {
	set(KEYS.onboarded, true);
}

export function getRemoveAds(): boolean {
	return get(KEYS.removeAds, false);
}

export function setRemoveAds(value: boolean): void {
	set(KEYS.removeAds, value);
}

export function getOpenOnly(): boolean {
	return get(KEYS.openOnly, true);
}

export function setOpenOnly(value: boolean): void {
	set(KEYS.openOnly, value);
}
