import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export async function navigateTo(lat: number, lng: number, name?: string): Promise<void> {
	const isIOS = Capacitor.getPlatform() === 'ios'
		|| (/iPad|iPhone|iPod/.test(navigator.userAgent) && !Capacitor.isNativePlatform());

	let url: string;
	if (isIOS) {
		const params = new URLSearchParams({
			daddr: `${lat},${lng}`,
			dirflg: 'd',
			t: 'm'
		});
		if (name) params.set('q', name);
		url = `maps://maps.apple.com/?${params}`;
	} else {
		const params = new URLSearchParams({
			api: '1',
			destination: `${lat},${lng}`,
			travelmode: 'driving'
		});
		url = `https://www.google.com/maps/dir/?${params}`;
	}

	if (Capacitor.isNativePlatform()) {
		await Browser.open({ url });
	} else {
		window.open(url, '_blank');
	}
}
