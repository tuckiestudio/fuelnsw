import { getDiscounts, setDiscounts, getGiftCardEnabled, setGiftCardEnabled, getGiftCardPercent, setGiftCardPercent } from './preferences';

let state = $state({
	selectedDiscounts: getDiscounts() as string[],
	showDiscountModal: false,
	giftCardEnabled: getGiftCardEnabled(),
	giftCardPercent: getGiftCardPercent(),
});

let discountCount = $derived(state.selectedDiscounts.length + (state.giftCardEnabled ? 1 : 0));

export function getSelectedDiscounts() {
	return state.selectedDiscounts;
}

export function getShowDiscountModal() {
	return state.showDiscountModal;
}

export function getDiscountCount() {
	return discountCount;
}

export function toggleDiscount(id: string) {
	const idx = state.selectedDiscounts.indexOf(id);
	if (idx >= 0) {
		state.selectedDiscounts = state.selectedDiscounts.filter((d) => d !== id);
	} else {
		state.selectedDiscounts = [...state.selectedDiscounts, id];
	}
	setDiscounts(state.selectedDiscounts);
}

export function clearDiscounts() {
	state.selectedDiscounts = [];
	setDiscounts([]);
}

export function openDiscountModal() {
	state.showDiscountModal = true;
}

let onCloseCallbacks: (() => void)[] = [];

export function onDiscountModalClose(callback: () => void) {
	onCloseCallbacks.push(callback);
	return () => {
		onCloseCallbacks = onCloseCallbacks.filter((cb) => cb !== callback);
	};
}

export function closeDiscountModal() {
	state.showDiscountModal = false;
	for (const cb of onCloseCallbacks) cb();
}

export function getGiftCardEnabledState() {
	return state.giftCardEnabled;
}

export function getGiftCardPercentState() {
	return state.giftCardPercent;
}

export function toggleGiftCard(enabled: boolean) {
	state.giftCardEnabled = enabled;
	setGiftCardEnabled(enabled);
}

export function updateGiftCardPercent(percent: number) {
	const clamped = Math.max(1, Math.min(15, Math.round(percent)));
	state.giftCardPercent = clamped;
	setGiftCardPercent(clamped);
}
