import { getDiscounts, setDiscounts } from './preferences';

let state = $state({
	selectedDiscounts: getDiscounts() as string[],
	showDiscountModal: false
});

let discountCount = $derived(state.selectedDiscounts.length);

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

export function closeDiscountModal() {
	state.showDiscountModal = false;
}
