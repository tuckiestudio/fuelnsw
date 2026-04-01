import { getDb } from './client.js';
import { initializeSchema } from './schema.js';

const MOCK_STATIONS = [
	{ code: 'S001', name: 'Caltex Sydney CBD', brand: 'Caltex', address: '100 George St', suburb: 'Sydney', state: 'NSW', postcode: '2000', latitude: -33.8688, longitude: 151.2093 },
	{ code: 'S002', name: 'BP Parramatta', brand: 'BP', address: '200 Church St', suburb: 'Parramatta', state: 'NSW', postcode: '2150', latitude: -33.8150, longitude: 151.0030 },
	{ code: 'S003', name: 'Shell Bondi', brand: 'Shell', address: '70 Hall St', suburb: 'Bondi', state: 'NSW', postcode: '2026', latitude: -33.8908, longitude: 151.2743 },
	{ code: 'S004', name: 'United Manly', brand: 'United', address: '15 Darley Rd', suburb: 'Manly', state: 'NSW', postcode: '2095', latitude: -33.7930, longitude: 151.2870 },
	{ code: 'S005', name: '7-Eleven Chatswood', brand: '7-Eleven', address: '1 Victoria Ave', suburb: 'Chatswood', state: 'NSW', postcode: '2067', latitude: -33.8960, longitude: 151.1810 },
	{ code: 'S006', name: 'Ampol Newtown', brand: 'Ampol', address: '256 King St', suburb: 'Newtown', state: 'NSW', postcode: '2042', latitude: -33.8975, longitude: 151.1780 },
	{ code: 'S007', name: 'Metro Petroleum Glebe', brand: 'Metro Petroleum', address: '44 Glebe Point Rd', suburb: 'Glebe', state: 'NSW', postcode: '2037', latitude: -33.8790, longitude: 151.1870 },
	{ code: 'S008', name: 'Caltex Hurstville', brand: 'Caltex', address: '228 Forest Rd', suburb: 'Hurstville', state: 'NSW', postcode: '2220', latitude: -33.9670, longitude: 151.1020 },
	{ code: 'S009', name: 'Shell Penrith', brand: 'Shell', address: '100 High St', suburb: 'Penrith', state: 'NSW', postcode: '2750', latitude: -33.7510, longitude: 150.6940 },
	{ code: 'S010', name: 'BP Newcastle', brand: 'BP', address: '45 Hunter St', suburb: 'Newcastle', state: 'NSW', postcode: '2300', latitude: -32.9280, longitude: 151.7820 },
	{ code: 'S011', name: 'Wollongong Fuel', brand: 'Caltex', address: '300 Crown St', suburb: 'Wollongong', state: 'NSW', postcode: '2500', latitude: -34.4250, longitude: 150.8930 },
	{ code: 'S012', name: 'Shell Wagga Wagga', brand: 'Shell', address: '50 Forsyth St', suburb: 'Wagga Wagga', state: 'NSW', postcode: '2650', latitude: -35.1020, longitude: 147.3580 },
	{ code: 'S013', name: 'BP Albury', brand: 'BP', address: '530 Kiewa St', suburb: 'Albury', state: 'NSW', postcode: '2640', latitude: -36.0740, longitude: 146.9240 },
	{ code: 'S014', name: 'United Coffs Harbour', brand: 'United', address: '25 Harbour Dr', suburb: 'Coffs Harbour', state: 'NSW', postcode: '2450', latitude: -30.2980, longitude: 153.1150 },
	{ code: 'S015', name: 'Caltex Port Macquarie', brand: 'Caltex', address: '70 Horton St', suburb: 'Port Macquarie', state: 'NSW', postcode: '2444', latitude: -31.4300, longitude: 152.9090 },
	{ code: 'S016', name: 'Shell Lismore', brand: 'Shell', address: '90 Molesworth St', suburb: 'Lismore', state: 'NSW', postcode: '2480', latitude: -28.8130, longitude: 153.2770 },
	{ code: 'S017', name: 'BP Tamworth', brand: 'BP', address: '436 Peel St', suburb: 'Tamworth', state: 'NSW', postcode: '2340', latitude: -31.0930, longitude: 150.9290 },
	{ code: 'S018', name: '7-Eleven Dubbo', brand: '7-Eleven', address: '168 Brisbane St', suburb: 'Dubbo', state: 'NSW', postcode: '2830', latitude: -32.2480, longitude: 148.6110 },
	{ code: 'S019', name: 'Shell Orange', brand: 'Shell', address: '200 Summer St', suburb: 'Orange', state: 'NSW', postcode: '2800', latitude: -33.2840, longitude: 149.1010 },
	{ code: 'S020', name: 'Ampol Bathurst', brand: 'Ampol', address: '105 William St', suburb: 'Bathurst', state: 'NSW', postcode: '2795', latitude: -33.4160, longitude: 149.5780 }
];

function generatePrices() {
	const fuelTypes = ['E10', 'Unleaded', 'P95', 'P98', 'Diesel'];
	const prices: Array<{ stationcode: string; fueltype: string; price: number; lastupdated: string }> = [];
	const now = new Date().toISOString();

	for (const station of MOCK_STATIONS) {
		for (const fuel of fuelTypes) {
			let base: number;
			switch (fuel) {
				case 'E10': base = 170; break;
				case 'Unleaded': base = 178; break;
				case 'P95': base = 195; break;
				case 'P98': base = 205; break;
				case 'Diesel': base = 188; break;
				default: base = 180;
			}
			const variation = Math.round((Math.random() - 0.5) * 40);
			const price = base + variation;

			if (station.code === 'S004' && fuel === 'P98') continue;
			if (station.code === 'S007' && fuel === 'P95') continue;
			if (station.code === 'S012' && fuel === 'E10') continue;
			if (station.code === 'S003' && fuel === 'Diesel') continue;

			prices.push({
				stationcode: station.code,
				fueltype: fuel,
				price,
				lastupdated: now
			});
		}
	}
	return prices;
}

function generateHistoricalData() {
	const db = getDb();
	const fuelTypes = ['E10', 'Unleaded', 'P95', 'P98', 'Diesel'];
	const today = new Date();

	const insertHist = db.prepare("INSERT OR IGNORE INTO historical_prices (station_code, fuel_type, price, price_updated) VALUES (?, ?, ?, ?)");
	const insertInv = db.prepare("INSERT OR IGNORE INTO station_fuel_inventory (station_code, fuel_type, first_seen, last_seen, total_records) VALUES (?, ?, ?, ?, 1)");

	const transaction = db.transaction(() => {
		for (const station of MOCK_STATIONS) {
			for (const fuel of fuelTypes) {
				if (station.code === 'S004' && fuel === 'P98') continue;
				if (station.code === 'S007' && fuel === 'P95') continue;
				if (station.code === 'S012' && fuel === 'E10') continue;

				let base: number;
				switch (fuel) {
					case 'E10': base = 170; break;
					case 'Unleaded': base = 178; break;
					case 'P95': base = 195; break;
					case 'P98': base = 205; break;
					case 'Diesel': base = 188; break;
					default: base = 180;
				}

				const firstDate = new Date(today);
				firstDate.setDate(firstDate.getDate() - 89);
				const lastSeen = new Date(today);
				lastSeen.setDate(lastSeen.getDate() - Math.floor(Math.random() * 5));

				let dateCount = 0;
				for (let d = new Date(firstDate); d <= today; d.setDate(d.getDate() + 3)) {
					dateCount++;
					const daysAgo = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
					const trendFactor = -daysAgo * 0.1;
					const noise = Math.round((Math.random() - 0.5) * 20);
					const price = Math.round(base + trendFactor + noise);

					insertHist.run(station.code, fuel, price, d.toISOString().slice(0, 10));
				}

				insertInv.run(station.code, fuel, firstDate.toISOString().slice(0, 10), lastSeen.toISOString().slice(0, 10));

				if (station.code === 'S003' && fuel === 'Diesel') {
					const dryDate = new Date(today);
					dryDate.setDate(dryDate.getDate() - 5);
					db.prepare("UPDATE station_fuel_inventory SET last_seen = ?, total_records = ? WHERE station_code = ? AND fuel_type = ?")
						.run(dryDate.toISOString().slice(0, 10), 31, station.code, fuel);
				}
			}
		}
	});

	transaction();
}

export function seedMockData(): void {
	const db = getDb();
	initializeSchema();

	const count = (db.prepare('SELECT COUNT(*) as c FROM stations').get() as { c: number }).c;
	if (count > 0) return;

	const insertStation = db.prepare("INSERT OR IGNORE INTO stations (code, name, brand, address, suburb, state, postcode, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
	const stationTxn = db.transaction(() => {
		for (const s of MOCK_STATIONS) {
			insertStation.run(s.code, s.name, s.brand, s.address, s.suburb, s.state, s.postcode, s.latitude, s.longitude);
		}
	});
	stationTxn();
	console.log('Mock: stations inserted');

	const prices = generatePrices();
	const insertPrice = db.prepare("INSERT OR REPLACE INTO live_prices (station_code, fuel_type, price, last_updated, fetched_at) VALUES (?, ?, ?, ?, datetime('now'))");
	const today = new Date().toISOString().slice(0, 10);
	const priceTxn = db.transaction(() => {
		for (const p of prices) {
			insertPrice.run(p.stationcode, p.fueltype, p.price, p.lastupdated);
		}
	});
	priceTxn();
	console.log('Mock: prices inserted');

	try {
		generateHistoricalData();
		console.log('Mock: historical data generated');
	} catch (histErr) {
		console.error('Mock: historical data FAILED:', histErr);
		throw histErr;
	}

	db.prepare("INSERT INTO refresh_log (stations_count, prices_count) VALUES (?, ?)").run(MOCK_STATIONS.length, prices.length);
	console.log(`Mock data seeded: ${MOCK_STATIONS.length} stations, ${prices.length} prices`);
}
