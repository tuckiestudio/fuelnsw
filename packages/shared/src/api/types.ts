export interface ApiStation {
	brandid?: string;
	stationid?: string;
	code: string;
	name: string;
	brand: string;
	address: string;
	location: {
		latitude: number;
		longitude: number;
	};
	state?: string;
	isAdBlueAvailable?: boolean;
}

export interface ApiPrice {
	stationcode: string;
	fueltype: string;
	price: number;
	lastupdated: string;
}

export interface ApiPricesResponse {
	stations: ApiStation[];
	prices: ApiPrice[];
}

export { FUEL_TYPE_MAP } from '../utils/fuel-types.js';

export const FUEL_DISPLAY_TYPES = ['E10', 'Unleaded', 'P95', 'P98', 'Diesel', 'LPG'];

export interface Station {
	code: string;
	name: string;
	brand: string;
	address: string;
	suburb: string;
	state: string;
	postcode: string;
	latitude: number;
	longitude: number;
	last_seen: string;
	opening_hours: string | null;
	hours_last_fetched: string | null;
}

export interface LivePrice {
	id?: number;
	station_code: string;
	fuel_type: string;
	price: number | null;
	last_updated: string | null;
	fetched_at: string;
}

export interface HistoricalPrice {
	id?: number;
	station_code: string;
	fuel_type: string;
	price: number;
	price_updated: string;
}

export interface StationFuelInventory {
	station_code: string;
	fuel_type: string;
	first_seen: string;
	last_seen: string;
	total_records: number;
}

export interface RefreshLog {
	id?: number;
	fetched_at: string;
	stations_count: number;
	prices_count: number;
}

export interface AvailabilityEvent {
	id?: number;
	station_code: string;
	fuel_type: string;
	event_type: 'dropped' | 'added';
	detected_at: string;
	previous_price: number | null;
	refresh_id: number | null;
}

export interface DryStation {
	station_code: string;
	station_name: string;
	brand: string;
	suburb: string;
	fuel_type: string;
	dropped_at: string;
	hours_since_drop: number;
	previous_price: number | null;
	severity: 'recent' | 'warning' | 'critical';
	is_fully_offline: boolean;
}

export interface FuelTypeAvailability {
	fuel_type: string;
	active_count: number;
	dry_count: number;
	recently_dropped_count: number;
}

export interface AvailabilityTrendPoint {
	date: string;
	added: number;
	dropped: number;
}

export interface OfflineStation {
	station_code: string;
	station_name: string;
	brand: string;
	suburb: string;
	fuel_types_dropped: number;
	dropped_at: string;
	hours_since_drop: number;
}

export interface OpeningHourPeriod {
	open: { day: number; time?: string; hour?: number; minute?: number; hours?: number; minutes?: number };
	close: { day: number; time?: string; hour?: number; minute?: number; hours?: number; minutes?: number };
}

export interface OpeningHours {
	periods: OpeningHourPeriod[];
	weekdayText: string[];
	openNow?: boolean;
}

export interface StationGeoJSON {
	type: 'Feature';
	properties: {
		code: string;
		name: string;
		brand: string;
		suburb: string;
		address: string;
		postcode: string;
		opening_hours: string | null;
		is_open: boolean;
		[fuelType: string]: string | number | boolean | null | undefined;
	};
	geometry: {
		type: 'Point';
		coordinates: [number, number];
	};
}
