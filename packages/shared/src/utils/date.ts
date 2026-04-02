export function sydneyDate(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Australia/Sydney' });
}
