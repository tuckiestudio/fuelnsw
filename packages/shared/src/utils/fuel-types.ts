export const FUEL_TYPE_MAP: Record<string, string> = {
	E10: 'E10',
	U91: 'Unleaded',
	P95: 'P95',
	P98: 'P98',
	DL: 'Diesel',
	LPG: 'LPG',
	B20: 'B20',
	PDL: 'PDL',
	E85: 'E85',
	EV: 'EV'
};

export const REVERSE_FUEL_MAP: Record<string, string> = {
	'E10': 'E10',
	'Unleaded': 'U91',
	'P95': 'P95',
	'P98': 'P98',
	'Diesel': 'DL',
	'LPG': 'LPG',
	'B20': 'B20',
	'PDL': 'PDL',
	'E85': 'E85',
	'EV': 'EV'
};

export const HISTORY_FUEL_MAP: Record<string, string[]> = {
	'E10': ['E10'],
	'Unleaded': ['Unleaded', 'U91'],
	'P95': ['P95'],
	'P98': ['P98'],
	'Diesel': ['Diesel', 'DL'],
	'LPG': ['LPG'],
	'B20': ['B20'],
	'PDL': ['PDL'],
	'E85': ['E85'],
	'EV': ['EV']
};

export const FUEL_OPTIONS = ['E10', 'Unleaded', 'P95', 'P98', 'Diesel', 'PDL', 'LPG', 'E85', 'B20'] as const;

export type FuelOption = (typeof FUEL_OPTIONS)[number];

export const FUEL_LABELS: Record<string, string> = {
	'E10': 'E10',
	'Unleaded': 'Unleaded',
	'P95': 'Premium 95',
	'P98': 'Premium 98',
	'Diesel': 'Diesel',
	'PDL': 'Premium Diesel',
	'LPG': 'LPG',
	'E85': 'E85',
	'B20': 'B20'
};

export const FUEL_COLORS: Record<string, string> = {
	'E10': '#22c55e',
	'Unleaded': '#3b82f6',
	'P95': '#a855f7',
	'P98': '#ef4444',
	'Diesel': '#f59e0b',
	'PDL': '#f97316',
	'LPG': '#06b6d4',
	'E85': '#84cc16',
	'B20': '#14b8a6'
};

export function getPriceColor(price: number, min: number, max: number): string {
	if (max === min) return '#22c55e';
	const ratio = (price - min) / (max - min);
	if (ratio < 0.25) return '#22c55e';
	if (ratio < 0.5) return '#eab308';
	if (ratio < 0.75) return '#f97316';
	return '#ef4444';
}
