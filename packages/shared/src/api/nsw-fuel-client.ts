import type { ApiPricesResponse } from './types.js';

const API_BASE = 'https://api.onegov.nsw.gov.au';
const TOKEN_URL = `${API_BASE}/oauth/client_credential/accesstoken`;

let cachedToken: { token: string; expiresAt: number } | null = null;

function getCredentials(): { key: string; secret: string } {
	const key = process.env.NSW_FUEL_KEY;
	const secret = process.env.NSW_FUEL_SECRET;
	if (!key || !secret) {
		throw new Error('NSW_FUEL_KEY and NSW_FUEL_SECRET environment variables are required');
	}
	return { key, secret };
}

async function getAccessToken(): Promise<string> {
	if (cachedToken && cachedToken.expiresAt > Date.now()) {
		return cachedToken.token;
	}

	const { key, secret } = getCredentials();
	const basicAuth = Buffer.from(`${key}:${secret}`).toString('base64');

	const response = await fetch(`${TOKEN_URL}?grant_type=client_credentials`, {
		method: 'GET',
		headers: {
			Authorization: `Basic ${basicAuth}`,
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
	}

	const data = await response.json() as { access_token: string; expires_in: number };
	const expiresInMs = (data.expires_in - 3600) * 1000;
	cachedToken = {
		token: data.access_token,
		expiresAt: Date.now() + expiresInMs
	};

	return cachedToken.token;
}

async function apiRequest<T>(path: string): Promise<T> {
	const token = await getAccessToken();
	const { key } = getCredentials();

	const timestamp = new Date().toLocaleString('en-AU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: true
	});

	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		apikey: key,
		transactionid: crypto.randomUUID(),
		requesttimestamp: timestamp,
		Accept: 'application/json'
	};

	const response = await fetch(`${API_BASE}${path}`, { headers });

	if (!response.ok) {
		if (response.status === 401) {
			cachedToken = null;
			const retryToken = await getAccessToken();
			const retryHeaders = { ...headers, Authorization: `Bearer ${retryToken}`, transactionid: crypto.randomUUID() };
			const retryResponse = await fetch(`${API_BASE}${path}`, { headers: retryHeaders });
			if (!retryResponse.ok) {
				throw new Error(`API request failed: ${retryResponse.status} ${retryResponse.statusText}`);
			}
			return retryResponse.json() as Promise<T>;
		}
		throw new Error(`API request failed: ${response.status} ${response.statusText}`);
	}

	return response.json() as Promise<T>;
}

export function getAllPrices(): Promise<ApiPricesResponse> {
	return apiRequest<ApiPricesResponse>('/FuelPriceCheck/v1/fuel/prices');
}

export function getNewPrices(): Promise<ApiPricesResponse> {
	return apiRequest<ApiPricesResponse>('/FuelPriceCheck/v1/fuel/prices/new');
}

export function getPricesNearby(
	latitude: number,
	longitude: number,
	fuelType?: string,
	radius?: number
): Promise<ApiPricesResponse> {
	const params = new URLSearchParams({
		latitude: latitude.toString(),
		longitude: longitude.toString()
	});
	if (fuelType) params.set('fuelType', fuelType);
	if (radius) params.set('radius', radius.toString());
	return apiRequest<ApiPricesResponse>(`/FuelPriceCheck/v1/fuel/prices/nearby?${params}`);
}

export function getPricesForStation(stationCode: string): Promise<ApiPricesResponse> {
	return apiRequest<ApiPricesResponse>(`/FuelPriceCheck/v1/fuel/prices/station/${stationCode}`);
}
