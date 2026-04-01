import { Capacitor } from '@capacitor/core';
import { setRemoveAds } from '$lib/preferences';

const ENTITLEMENT_ID = 'remove_ads';

export async function isSubscribed(): Promise<boolean> {
	if (!Capacitor.isNativePlatform()) return false;

	try {
		const { Purchases } = await import('@revenuecat/purchases-capacitor');
		const { customerInfo } = await Purchases.getCustomerInfo();
		const active = customerInfo.entitlements.active as Record<string, unknown>;
		if (active && active[ENTITLEMENT_ID]) {
			setRemoveAds(true);
			return true;
		}
	} catch {}
	return false;
}

export async function purchaseSubscription(): Promise<boolean> {
	if (!Capacitor.isNativePlatform()) return false;

	try {
		const { Purchases } = await import('@revenuecat/purchases-capacitor');
		const offerings = await Purchases.getOfferings();
		const current = offerings.current as any;
		if (!current?.monthly) return false;
		const { customerInfo } = await Purchases.purchasePackage({ aPackage: current.monthly });
		const active = (customerInfo as any).entitlements?.active as Record<string, unknown>;
		if (active && active[ENTITLEMENT_ID]) {
			setRemoveAds(true);
			return true;
		}
	} catch {}
	return false;
}

export async function restorePurchases(): Promise<boolean> {
	if (!Capacitor.isNativePlatform()) return false;

	try {
		const { Purchases } = await import('@revenuecat/purchases-capacitor');
		const { customerInfo } = await Purchases.restorePurchases();
		const active = (customerInfo as any).entitlements?.active as Record<string, unknown>;
		if (active && active[ENTITLEMENT_ID]) {
			setRemoveAds(true);
			return true;
		}
	} catch {}
	return false;
}

export async function configureRevenueCat(): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;

	try {
		const { Purchases } = await import('@revenuecat/purchases-capacitor');
		const apiKey = Capacitor.getPlatform() === 'ios'
			? 'test_MxcUIPbEYHMkaNWSwvVwmEMIqec'
			: 'test_MxcUIPbEYHMkaNWSwvVwmEMIqec';
		await Purchases.configure({ apiKey, appUserID: undefined });
	} catch {}
}
