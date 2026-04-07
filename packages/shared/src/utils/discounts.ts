export interface DiscountOffer {
	id: string;
	name: string;
	category: string;
	amount: number;
	fuelTypeOverrides?: Record<string, number>;
	fuelTypeExclusions?: string[];
	maxLitres: number;
	description: string;
	lastVerified: string;
}

export interface BrandCategory {
	id: string;
	name: string;
	discountIds: string[];
	reducedAmounts?: Record<string, number>;
}

export interface BrandDiscountConfig {
	brands: string[];
	categories: BrandCategory[];
	maxCategories: number;
}

export interface DiscountResult {
	totalDiscount: number;
	appliedDiscounts: { id: string; amount: number; name: string }[];
}

const DISCOUNT_OFFERS: DiscountOffer[] = [
	{
		id: 'woolworths_voucher',
		name: 'Woolworths Fuel Voucher',
		category: 'supermarket',
		amount: 4,
		maxLitres: 150,
		description: 'Earned from spending $30+ at Woolworths',
		lastVerified: '2026-04-07',
	},
	{
		id: 'coles_voucher',
		name: 'Coles Fuel Voucher',
		category: 'supermarket',
		amount: 4,
		maxLitres: 150,
		description: 'Earned from spending $30+ at Coles/Flybuys partners',
		lastVerified: '2026-04-07',
	},
	{
		id: 'ritchies_iga_voucher',
		name: 'Ritchies IGA Fuel Voucher',
		category: 'supermarket',
		amount: 4,
		maxLitres: 150,
		description: 'Participating stations vary by voucher (location-specific)',
		lastVerified: '2026-04-07',
	},
	{
		id: 'nrma',
		name: 'My NRMA',
		category: 'auto_club',
		amount: 4,
		fuelTypeOverrides: { P95: 5, P98: 5 },
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'NRMA member benefit at Ampol Foodary',
		lastVerified: '2026-04-07',
	},
	{
		id: 'racv',
		name: 'RACV Member',
		category: 'partner_app',
		amount: 5,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'RACV member discount at EG Ampol',
		lastVerified: '2026-04-07',
	},
	{
		id: 'raa',
		name: 'RAA Member',
		category: 'auto_club',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'RAA member discount at Caltex and Puma Energy',
		lastVerified: '2026-04-07',
	},
	{
		id: 'rac',
		name: 'RAC Member',
		category: 'auto_club',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'RAC member discount at Caltex and Puma Energy',
		lastVerified: '2026-04-07',
	},
	{
		id: 'racq',
		name: 'RACQ Member',
		category: 'auto_club',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'RACQ member discount at Caltex and Puma Energy',
		lastVerified: '2026-04-07',
	},
	{
		id: 'linkt',
		name: 'Linkt Rewards',
		category: 'partner_app',
		amount: 6,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Linkt account holder perk at 7-Eleven',
		lastVerified: '2026-04-07',
	},
	{
		id: 'nab_goodies',
		name: 'NAB Goodies',
		category: 'partner_app',
		amount: 6,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'NAB customer perk at 7-Eleven',
		lastVerified: '2026-04-07',
	},
	{
		id: 'telstra',
		name: 'Telstra App',
		category: 'partner_app',
		amount: 6,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Telstra customer perk at 7-Eleven',
		lastVerified: '2026-04-07',
	},
	{
		id: 'wilson_parking',
		name: 'Wilson Parking Perks',
		category: 'partner_app',
		amount: 6,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Wilson Parking member perk at 7-Eleven',
		lastVerified: '2026-04-07',
	},
	{
		id: 'afl_live',
		name: 'AFL Live App',
		category: 'partner_app',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'AFL Live Pass holder at Shell and Reddy Express',
		lastVerified: '2026-04-07',
	},
	{
		id: 'shell_vpower_racing',
		name: 'Shell V-Power Racing',
		category: 'partner_app',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Shell V-Power Racing club member discount',
		lastVerified: '2026-04-07',
	},
	{
		id: 'gday_rewards',
		name: "G'Day Rewards",
		category: 'partner_app',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: "G'Day Rewards member at Shell and Reddy Express (subsequent redemptions)",
		lastVerified: '2026-04-07',
	},
	{
		id: 'shell_secret_saver',
		name: 'Shell Secret Saver',
		category: 'partner_app',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Shell app exclusive at Reddy Express',
		lastVerified: '2026-04-07',
	},
	{
		id: 'toyota_go',
		name: 'Toyota Go',
		category: 'partner_app',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Toyota owner benefit at Ampol Foodary',
		lastVerified: '2026-04-07',
	},
	{
		id: 'apod',
		name: 'APOD (Defence)',
		category: 'partner_app',
		amount: 5,
		fuelTypeOverrides: { P95: 8, P98: 8 },
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Australian Defence members at Ampol Foodary',
		lastVerified: '2026-04-07',
	},
	{
		id: 'lexus_encore',
		name: 'Lexus Encore',
		category: 'partner_app',
		amount: 5,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Lexus Encore member at Ampol Foodary',
		lastVerified: '2026-04-07',
	},
	{
		id: 'eg_club',
		name: 'EG Club Member',
		category: 'loyalty',
		amount: 5,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'EG Club loyalty member at EG Ampol and Caltex Woolworths',
		lastVerified: '2026-04-07',
	},
	{
		id: 'arevo',
		name: 'arevo by RACV',
		category: 'partner_app',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'arevo app user at EG Ampol and Caltex Woolworths',
		lastVerified: '2026-04-07',
	},
	{
		id: 'origin_energy',
		name: 'Origin Energy',
		category: 'partner_app',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Origin Energy customer at EG Ampol and Caltex Woolworths',
		lastVerified: '2026-04-07',
	},
	{
		id: 'autopact',
		name: 'Autopact Loyalty',
		category: 'partner_app',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Autopact loyalty member at EG Ampol and Caltex Woolworths',
		lastVerified: '2026-04-07',
	},
	{
		id: 'uber_pro',
		name: 'Uber Pro',
		category: 'partner_app',
		amount: 6,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Uber Pro Blue/Green tier at BP (higher tiers get more)',
		lastVerified: '2026-04-07',
	},
	{
		id: 'eg_spend_instore',
		name: 'Spend $5+ In-store',
		category: 'spend_instore',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Spend $5+ in-store at EG Ampol and Caltex Woolworths',
		lastVerified: '2026-04-07',
	},
	{
		id: 'reddy_spend_instore',
		name: 'Spend $20+ In-store',
		category: 'spend_instore',
		amount: 10,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Spend $20+ in-store at Reddy Express and Coles Express',
		lastVerified: '2026-04-07',
	},
	{
		id: 'bp_spend_instore',
		name: 'Buy 2 Promotional Products',
		category: 'spend_instore',
		amount: 8,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'Buy 2 promotional products at BP',
		lastVerified: '2026-04-07',
	},
	{
		id: 'nsw_seniors',
		name: 'NSW Seniors Card',
		category: 'seniors',
		amount: 4,
		fuelTypeExclusions: ['LPG'],
		maxLitres: 150,
		description: 'NSW Seniors Card via United Petroleum app (check availability)',
		lastVerified: '2026-04-07',
	},
];

const BRAND_CONFIGS: BrandDiscountConfig[] = [
	{
		brands: ['7-Eleven'],
		categories: [
			{
				id: 'partner',
				name: 'Partner discount',
				discountIds: ['linkt', 'nab_goodies', 'telstra', 'wilson_parking'],
			},
		],
		maxCategories: 1,
	},
	{
		brands: ['Ampol Foodary'],
		categories: [
			{
				id: 'supermarket',
				name: 'Supermarket voucher',
				discountIds: ['woolworths_voucher'],
			},
			{
				id: 'partner',
				name: 'Partner discount',
				discountIds: ['nrma', 'toyota_go', 'apod', 'lexus_encore'],
			},
		],
		maxCategories: 2,
	},
	{
		brands: ['EG Ampol', 'Caltex Woolworths'],
		categories: [
			{
				id: 'supermarket',
				name: 'Supermarket voucher',
				discountIds: ['woolworths_voucher'],
			},
			{
				id: 'spend',
				name: 'Spend in-store',
				discountIds: ['eg_spend_instore'],
			},
			{
				id: 'partner',
				name: 'Partner discount',
				discountIds: ['eg_club', 'racv', 'arevo', 'origin_energy', 'autopact'],
				reducedAmounts: {
					racv: 2,
					arevo: 1,
					origin_energy: 2,
				},
			},
		],
		maxCategories: 3,
	},
	{
		brands: ['Shell'],
		categories: [
			{
				id: 'partner',
				name: 'Partner discount',
				discountIds: ['afl_live', 'shell_vpower_racing', 'gday_rewards'],
			},
		],
		maxCategories: 1,
	},
	{
		brands: ['Reddy Express', 'Coles Express'],
		categories: [
			{
				id: 'supermarket',
				name: 'Supermarket voucher',
				discountIds: ['coles_voucher'],
			},
			{
				id: 'spend',
				name: 'Spend in-store',
				discountIds: ['reddy_spend_instore'],
			},
			{
				id: 'partner',
				name: 'Partner discount',
				discountIds: [
					'afl_live',
					'shell_vpower_racing',
					'gday_rewards',
					'shell_secret_saver',
				],
			},
		],
		maxCategories: 3,
	},
	{
		brands: ['BP'],
		categories: [
			{
				id: 'spend',
				name: 'Spend in-store',
				discountIds: ['bp_spend_instore'],
			},
			{
				id: 'partner',
				name: 'Partner discount',
				discountIds: ['uber_pro'],
			},
			{
				id: 'supermarket',
				name: 'Supermarket voucher',
				discountIds: ['ritchies_iga_voucher'],
			},
		],
		maxCategories: 1,
	},
	{
		brands: ['Caltex', 'Puma Energy'],
		categories: [
			{
				id: 'partner',
				name: 'Auto club discount',
				discountIds: ['raa', 'rac', 'racq'],
			},
			{
				id: 'supermarket',
				name: 'Supermarket voucher',
				discountIds: ['ritchies_iga_voucher'],
			},
		],
		maxCategories: 1,
	},
	{
		brands: ['United', 'ASTRON'],
		categories: [
			{
				id: 'seniors',
				name: 'Seniors discount',
				discountIds: ['nsw_seniors'],
			},
		],
		maxCategories: 1,
	},
	{
		brands: ['Liberty'],
		categories: [
			{
				id: 'supermarket',
				name: 'Supermarket voucher',
				discountIds: ['ritchies_iga_voucher'],
			},
		],
		maxCategories: 1,
	},
];

const OFFER_MAP = new Map(DISCOUNT_OFFERS.map((o) => [o.id, o]));

const BRAND_CONFIG_MAP = new Map<string, BrandDiscountConfig>();
for (const config of BRAND_CONFIGS) {
	for (const brand of config.brands) {
		BRAND_CONFIG_MAP.set(brand, config);
	}
}

export function getDiscountConfig(brand: string): BrandDiscountConfig | null {
	return BRAND_CONFIG_MAP.get(brand) ?? null;
}

export function calculateDiscount(
	brand: string,
	fuelType: string,
	selectedDiscountIds: string[],
): DiscountResult {
	const config = getDiscountConfig(brand);
	if (!config || selectedDiscountIds.length === 0) {
		return { totalDiscount: 0, appliedDiscounts: [] };
	}

	const selectedSet = new Set(selectedDiscountIds);
	const applied: { id: string; amount: number; name: string }[] = [];

	for (const category of config.categories) {
		let bestOffer: DiscountOffer | null = null;
		let bestAmount = 0;

		for (const discountId of category.discountIds) {
			if (!selectedSet.has(discountId)) continue;
			const offer = OFFER_MAP.get(discountId);
			if (!offer) continue;

			if (offer.fuelTypeExclusions?.includes(fuelType)) continue;

			let amount = offer.amount;
			if (offer.fuelTypeOverrides && fuelType in offer.fuelTypeOverrides) {
				amount = offer.fuelTypeOverrides[fuelType];
			}

			if (amount > bestAmount) {
				bestOffer = offer;
				bestAmount = amount;
			}
		}

		if (!bestOffer) continue;

		let finalAmount = bestAmount;

		const stackingCount = applied.length + 1;
		if (stackingCount > 1 && category.reducedAmounts && bestOffer.id in category.reducedAmounts) {
			finalAmount = category.reducedAmounts[bestOffer.id];
		}

		applied.push({
			id: bestOffer.id,
			amount: finalAmount,
			name: bestOffer.name,
		});
	}

	if (config.maxCategories > 0 && applied.length > config.maxCategories) {
		applied.sort((a, b) => b.amount - a.amount);
		applied.length = config.maxCategories;
	}

	const totalDiscount = applied.reduce((sum, d) => sum + d.amount, 0);
	return { totalDiscount, appliedDiscounts: applied };
}

export function getAllDiscountOffers(): DiscountOffer[] {
	return DISCOUNT_OFFERS;
}

export function getCategoryGroups(): {
	id: string;
	name: string;
	discounts: DiscountOffer[];
}[] {
	const categoryMeta: Record<string, string> = {
		supermarket: 'Supermarket vouchers',
		auto_club: 'Auto club discounts',
		partner_app: 'Partner app discounts',
		loyalty: 'Loyalty programs',
		spend_instore: 'Spend in-store',
		seniors: 'Seniors discounts',
	};
	const order = ['supermarket', 'auto_club', 'partner_app', 'loyalty', 'spend_instore', 'seniors'];
	const groups = new Map<string, DiscountOffer[]>();

	for (const offer of DISCOUNT_OFFERS) {
		if (!groups.has(offer.category)) {
			groups.set(offer.category, []);
		}
		groups.get(offer.category)!.push(offer);
	}

	return order
		.filter((id) => groups.has(id))
		.map((id) => ({
			id,
			name: categoryMeta[id] ?? id,
			discounts: groups.get(id)!,
		}));
}

export function getLastVerifiedDate(): string {
	let oldest = DISCOUNT_OFFERS[0].lastVerified;
	for (const offer of DISCOUNT_OFFERS) {
		if (offer.lastVerified < oldest) {
			oldest = offer.lastVerified;
		}
	}
	return oldest;
}

export function getOffersForBrand(brand: string): DiscountOffer[] {
	const config = getDiscountConfig(brand);
	if (!config) return [];
	const offers: DiscountOffer[] = [];
	for (const category of config.categories) {
		for (const discountId of category.discountIds) {
			const offer = OFFER_MAP.get(discountId);
			if (offer) offers.push(offer);
		}
	}
	return offers;
}
