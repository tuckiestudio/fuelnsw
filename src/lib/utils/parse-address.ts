export function parseAddress(address: string): { suburb: string; state: string; postcode: string } {
	let suburb = '';
	let state = 'NSW';
	let postcode = '';

	const pcMatch = address.match(/(\d{4})\s*$/);
	if (pcMatch) postcode = pcMatch[1];

	const fullStates: Record<string, string> = {
		'NEW SOUTH WALES': 'NSW',
		'SOUTH AUSTRALIA': 'SA',
		'WESTERN AUSTRALIA': 'WA',
		'NORTHERN TERRITORY': 'NT',
		'AUSTRALIAN CAPITAL TERRITORY': 'ACT',
		'VICTORIA': 'VIC',
		'QUEENSLAND': 'QLD',
		'TASMANIA': 'TAS'
	};

	let stateFound = false;
	for (const [full, abbr] of Object.entries(fullStates)) {
		if (address.includes(full)) {
			state = abbr;
			stateFound = true;
			break;
		}
	}

	if (!stateFound) {
		const stMatch = address.match(/\b([A-Z]{2,3})\s+\d{4}\s*$/);
		if (stMatch) state = stMatch[1];
	}

	let cleaned = address
		.replace(/\d{4}\s*$/, '')
		.replace(/,\s*AUD?\s*$/i, '')
		.replace(/,\s*$/, '')
		.trim();

	for (const abbr of ['NSW', 'ACT', 'VIC', 'QLD', 'SA', 'WA', 'NT', 'TAS']) {
		cleaned = cleaned.replace(new RegExp(`,?\\s*\\b${abbr}\\b`, 'g'), '');
	}
	cleaned = cleaned.replace(/,\s*$/, '').trim();

	const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
	if (parts.length >= 2) {
		suburb = parts[parts.length - 1];
	} else if (parts.length === 1) {
		const words = parts[0].split(/\s+/);
		if (words.length >= 2) {
			const streetTypes = /^(Rd|Road|St|Street|Ave|Avenue|Hwy|Highway|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place|Cres|Crescent|Blvd|Boulevard|Pde|Parade|Way|Esp|Esplanade|Terrace|Tce)$/i;
			let lastStreetIdx = -1;
			for (let i = 0; i < words.length; i++) {
				if (streetTypes.test(words[i])) lastStreetIdx = i;
			}
			if (lastStreetIdx >= 0 && lastStreetIdx < words.length - 1) {
				suburb = words.slice(lastStreetIdx + 1).join(' ');
			} else {
				suburb = words.length <= 3 ? words.join(' ') : words[words.length - 1];
			}
		} else {
			suburb = words[0];
		}
	}

	suburb = suburb.replace(/\s+/g, ' ').trim().split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

	return { suburb, state, postcode };
}
