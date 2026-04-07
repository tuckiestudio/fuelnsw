import { getDiscounts, setDiscounts } from './preferences';

let selectedDiscounts = $state<string[]>(getDiscounts());
let showDiscountModal = $state(false);
let discountCount = $derived(selectedDiscounts.length);

export { selectedDiscounts, showDiscountModal, discountCount };

export function toggleDiscount(id: string) {
	const idx = selectedDiscounts.indexOf(id);
	if (idx >= 0) {
		selectedDiscounts = selectedDiscounts.filter((d) => d !== id);
	} else {
		selectedDiscounts = [...selectedDiscounts, id];
	}
	setDiscounts(selectedDiscounts);
}

export function clearDiscounts() {
	selectedDiscounts = [];
	setDiscounts([]);
}

export function openDiscountModal() {
	showDiscountModal = true;
}

export function closeDiscountModal() {
	showDiscountModal = false;
}
