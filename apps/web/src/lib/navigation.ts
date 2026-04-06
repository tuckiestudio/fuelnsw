import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { getNavApp, setNavApp, type NavApp } from './preferences';

export type { NavApp };

export const NAV_APPS: { id: NavApp; label: string }[] = [
	{ id: 'apple', label: 'Apple Maps' },
	{ id: 'google', label: 'Google Maps' }
];

export type NavigateResult =
	| { ok: true }
	| { ok: false; reason: 'needs_choice' };

function isIOS(): boolean {
	return Capacitor.getPlatform() === 'ios'
		|| (/iPad|iPhone|iPod/.test(navigator.userAgent) && !Capacitor.isNativePlatform());
}

function isAndroidWeb(): boolean {
	return !Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent);
}

function buildAppleMapsUrl(lat: number, lng: number, name?: string): string {
	const params = new URLSearchParams({ daddr: `${lat},${lng}`, dirflg: 'd', t: 'm' });
	if (name) params.set('q', name);
	return `maps://maps.apple.com/?${params}`;
}

function buildGoogleMapsUrl(lat: number, lng: number): string {
	const params = new URLSearchParams({ api: '1', destination: `${lat},${lng}`, travelmode: 'driving' });
	return `https://www.google.com/maps/dir/?${params}`;
}

function buildGeoUri(lat: number, lng: number, name?: string): string {
	const q = name ? `${lat},${lng}(${name})` : `${lat},${lng}`;
	return `geo:0,0?q=${encodeURIComponent(q)}`;
}

async function openUrl(url: string): Promise<void> {
	if (Capacitor.isNativePlatform()) {
		await Browser.open({ url });
	} else {
		window.open(url, '_blank');
	}
}

export async function navigateTo(lat: number, lng: number, name?: string): Promise<NavigateResult> {
	if (isAndroidWeb()) {
		window.open(buildGeoUri(lat, lng, name), '_blank');
		return { ok: true };
	}

	if (isIOS()) {
		const pref = getNavApp();
		if (!pref) return { ok: false, reason: 'needs_choice' };
		const url = pref === 'apple'
			? buildAppleMapsUrl(lat, lng, name)
			: buildGoogleMapsUrl(lat, lng);
		await openUrl(url);
		return { ok: true };
	}

	window.open(buildGoogleMapsUrl(lat, lng), '_blank');
	return { ok: true };
}

export async function navigateWithApp(lat: number, lng: number, app: NavApp, name?: string): Promise<void> {
	setNavApp(app);
	const url = app === 'apple'
		? buildAppleMapsUrl(lat, lng, name)
		: buildGoogleMapsUrl(lat, lng);
	await openUrl(url);
}
