const KEYS = {
	fuelType: 'fuelscoutnsw_fuelType',
	lastLat: 'fuelscoutnsw_lastLat',
	lastLng: 'fuelscoutnsw_lastLng',
	onboarded: 'fuelscoutnsw_onboarded',
	removeAds: 'fuelscoutnsw_removeAds',
	openOnly: 'fuelscoutnsw_openOnly',
	navApp: 'fuelscoutnsw_navApp',
	discounts: 'fuelscoutnsw_discounts',
	giftCardEnabled: 'fuelscoutnsw_giftCardEnabled',
	giftCardPercent: 'fuelscoutnsw_giftCardPercent',
	giftCardBrands: 'fuelscoutnsw_giftCardBrands'
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

export type NavApp = 'apple' | 'google';

export function getNavApp(): NavApp | null {
	return get<NavApp | null>(KEYS.navApp, null);
}

export function setNavApp(value: NavApp): void {
	set(KEYS.navApp, value);
}

export function getDiscounts(): string[] {
	return get(KEYS.discounts, []);
}

export function setDiscounts(ids: string[]): void {
	set(KEYS.discounts, ids);
}

export function getGiftCardEnabled(): boolean {
	return get(KEYS.giftCardEnabled, false);
}

export function setGiftCardEnabled(value: boolean): void {
	set(KEYS.giftCardEnabled, value);
}

export function getGiftCardPercent(): number {
	return get(KEYS.giftCardPercent, 5);
}

export function setGiftCardPercent(value: number): void {
	set(KEYS.giftCardPercent, value);
}

export function getGiftCardBrands(): string[] | null {
	return get<string[] | null>(KEYS.giftCardBrands, null);
}

export function setGiftCardBrands(brands: string[] | null): void {
	set(KEYS.giftCardBrands, brands);
}
