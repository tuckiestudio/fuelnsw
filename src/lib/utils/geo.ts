/** NSW bounding box for initial map center */
export const NSW_BOUNDS = {
	north: -28.0,
	south: -37.5,
	east: 153.6,
	west: 140.9
};

/** NSW center point */
export const NSW_CENTER: [number, number] = [-33.8, 151.2];

/** NSW zoom level */
export const NSW_ZOOM = 8;

/** Calculate distance between two points using Haversine formula (km) */
export function haversineDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}
