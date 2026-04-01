import { Capacitor } from '@capacitor/core';
import { getRemoveAds } from '$lib/preferences';

const INTERSTITIAL_INTERVAL = 3;
let interstitialCount = 0;

function isNative(): boolean {
	return Capacitor.isNativePlatform();
}

export async function initAds(): Promise<void> {
	if (getRemoveAds()) return;

	if (isNative()) {
		try {
			const { AdMob } = await import('@capacitor-community/admob');
			await AdMob.initialize({ testingDevices: ['SIMULATOR'] });
		} catch (e) {
			console.warn('AdMob init failed:', e);
		}
	}
}

export async function maybeShowInterstitial(): Promise<boolean> {
	if (getRemoveAds()) return false;

	interstitialCount++;
	if (interstitialCount % INTERSTITIAL_INTERVAL !== 0) return false;

	if (isNative()) {
		try {
			const { AdMob } = await import('@capacitor-community/admob');
			const platform = Capacitor.getPlatform();
			const adId = platform === 'ios'
				? 'ca-app-pub-XXXX/XXXX'
				: 'ca-app-pub-XXXX/XXXX';
			await AdMob.prepareInterstitial({ adId });
			await AdMob.showInterstitial();
			return true;
		} catch {
			return false;
		}
	}

	return false;
}
