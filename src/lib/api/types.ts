/** Raw station object from the NSW Fuel Check API */
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

/** Raw price object from the NSW Fuel Check API */
export interface ApiPrice {
	stationcode: string;
	fueltype: string;
	price: number;
	lastupdated: string;
}

/** Full API response from GET /FuelPriceCheck/v1/fuel/prices */
export interface ApiPricesResponse {
	stations: ApiStation[];
	prices: ApiPrice[];
}

export { FUEL_TYPE_MAP } from '../utils/fuel-types.js';

/** Display fuel types for the UI */
export const FUEL_DISPLAY_TYPES = ['E10', 'Unleaded', 'P95', 'P98', 'Diesel', 'LPG'];

/** Our internal station model */
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
}

/** Our internal live price model */
export interface LivePrice {
	id?: number;
	station_code: string;
	fuel_type: string;
	price: number | null;
	last_updated: string | null;
	fetched_at: string;
}

/** Our internal historical price model */
export interface HistoricalPrice {
	id?: number;
	station_code: string;
	fuel_type: string;
	price: number;
	price_updated: string; // date string YYYY-MM-DD
}

/** Station fuel type inventory record */
export interface StationFuelInventory {
	station_code: string;
	fuel_type: string;
	first_seen: string;
	last_seen: string;
	total_records: number;
}

/** Refresh log entry */
export interface RefreshLog {
	id?: number;
	fetched_at: string;
	stations_count: number;
	prices_count: number;
}

/** Fuel availability event */
export interface AvailabilityEvent {
	id?: number;
	station_code: string;
	fuel_type: string;
	event_type: 'dropped' | 'added';
	detected_at: string;
	previous_price: number | null;
	refresh_id: number | null;
}

/** Dry station result */
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

/** Per-fuel-type availability breakdown */
export interface FuelTypeAvailability {
	fuel_type: string;
	active_count: number;
	dry_count: number;
	recently_dropped_count: number;
}

/** Daily trend data point */
export interface AvailabilityTrendPoint {
	date: string;
	added: number;
	dropped: number;
}

/** Offline station (dropped ALL fuel types) */
export interface OfflineStation {
	station_code: string;
	station_name: string;
	brand: string;
	suburb: string;
	fuel_types_dropped: number;
	dropped_at: string;
	hours_since_drop: number;
}

/** GeoJSON feature for map rendering */
export interface StationGeoJSON {
	type: 'Feature';
	properties: {
		code: string;
		name: string;
		brand: string;
		suburb: string;
		address: string;
		postcode: string;
		[fuelType: string]: string | undefined;
	};
	geometry: {
		type: 'Point';
		coordinates: [number, number];
	};
}
