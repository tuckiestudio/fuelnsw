export function navigateTo(lat: number, lng: number, name?: string): void {
	const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
		(CapacitorPlatform() === 'ios');

	if (isIOS) {
		const params = new URLSearchParams({
			daddr: `${lat},${lng}`,
			dirflg: 'd',
			t: 'm'
		});
		if (name) params.set('q', name);
		window.open(`maps://maps.apple.com/?${params}`, '_system');
	} else {
		const params = new URLSearchParams({
			api: '1',
			destination: `${lat},${lng}`,
			travelmode: 'driving'
		});
		window.open(`https://www.google.com/maps/dir/?${params}`, '_blank');
	}
}

function CapacitorPlatform(): string {
	try {
		const w = window as any;
		return w?.Capacitor?.getPlatform?.() ?? 'web';
	} catch {
		return 'web';
	}
}
