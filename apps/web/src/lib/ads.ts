import { Capacitor } from '@capacitor/core';
import { getRemoveAds } from '$lib/preferences';

const INTERSTITIAL_INTERVAL = 3;
let interstitialCount = 0;
let bannerVisible = false;

const BANNER_IDS = {
	ios: 'ca-app-pub-8792853309353392/2976491668',
	android: 'ca-app-pub-8792853309353392/5301274237'
};

export const WEB_AD_SLOT = '1288173347';

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

export async function showBanner(): Promise<void> {
	if (getRemoveAds() || !isNative() || bannerVisible) return;

	try {
		const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
		const platform = Capacitor.getPlatform();
		const adId = platform === 'ios' ? BANNER_IDS.ios : BANNER_IDS.android;
		await AdMob.showBanner({
			adId,
			adSize: BannerAdSize.ADAPTIVE_BANNER,
			position: BannerAdPosition.BOTTOM_CENTER
		});
		bannerVisible = true;
	} catch (e) {
		console.warn('Banner ad failed:', e);
	}
}

export async function hideBanner(): Promise<void> {
	if (!isNative() || !bannerVisible) return;

	try {
		const { AdMob } = await import('@capacitor-community/admob');
		await AdMob.hideBanner();
		bannerVisible = false;
	} catch {}
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
				? 'ca-app-pub-8792853309353392/1412128551'
				: 'ca-app-pub-8792853309353392/5714335648';
			await AdMob.prepareInterstitial({ adId });
			await AdMob.showInterstitial();
			return true;
		} catch {
			return false;
		}
	}

	return false;
}
