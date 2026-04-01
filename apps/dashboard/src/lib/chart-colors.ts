/**
 * Chart Color Assignments
 * 
 * Colorblind-friendly palette for regions, brands, and fuel types.
 * Uses distinct colors that work well together and are distinguishable by colorblind users.
 */

/**
 * SA4 Region Colors
 * Using a colorblind-friendly palette with high contrast
 */
export const REGION_COLORS: Record<string, string> = {
  'Sydney': '#3b82f6',      // Blue
  'Central Coast': '#06b6d4', // Cyan
  'Newcastle and Lake Macquarie': '#10b981', // Green
  'Illawarra': '#f59e0b',   // Amber
  'Richmond - Tweed': '#8b5cf6', // Purple
  'Southern Highlands and Shoalhaven': '#ec4899', // Pink
  'Hunter Valley (excludes Newcastle)': '#14b8a6', // Teal
  'Mid North Coast': '#f97316', // Orange
  'Coffs Harbour - Grafton': '#6366f1', // Indigo
  'Capital Region': '#84cc16', // Lime
  'Central West': '#eab308', // Yellow
  'Riverina': '#a855f7', // Purple
  'New England and North West': '#16a34a', // Dark Green
  'Murray': '#dc2626', // Red
  'Far West and Orana': '#991b1b'  // Dark Red
};

/**
 * Brand Colors
 * Using recognizable brand colors where possible, generated colors for others
 */
export const BRAND_COLORS: Record<string, string> = {
  // Major brands with recognizable colors
  'BP': '#00a74f',          // BP green
  'Caltex': '#e31837',      // Caltex red
  'Ampol': '#ffd100',       // Ampol yellow
  '7-Eleven': '#008060',    // 7-Eleven green
  'Shell': '#dd1d21',       // Shell red
  'Mobil': '#ed0000',       // Mobil red
  'Coles Express': '#ed1c24', // Coles red
  'United': '#0055a4',      // United blue
  'Metro Fuel': '#00a9e0',  // Metro blue
  'Liberty': '#009fe3',     // Liberty blue
  'Costco': '#004a8f',      // Costco blue
  'NRMA': '#004b8d',        // NRMA blue
  'Tesla': '#cc0000',       // Tesla red
  'AGL': '#0095da',         // AGL blue
  'Puma Energy': '#ff6600', // Puma orange
  
  // Smaller brands - generated distinct colors
  'Independent': '#6b7280', // Gray
  'Reddy Express': '#dc2626',
  'Exploren': '#7c3aed',
  'Speedway': '#2563eb',
  'Budget': '#059669',
  'Enhance': '#db2777',
  'Chargefox': '#0891b2',
  'Pearl Energy': '#4f46e5',
  'Westside': '#c026d3',
  'Lowes': '#be123c',
  'IOR Group': '#0284c7',
  'Inland Petroleum': '#166534',
  'Woodham Petroleum': '#9f1239',
  'U-Go': '#65a30d',
  'ChargePoint': '#00a3e0',
  'ASTRON': '#4338ca',
  'South West': '#047857',
  'JOLT': '#ea580c',
  'Ultra Petroleum': '#0369a1',
  'Transwest Fuels': '#0c4a6e',
  'EVUp': '#4c1d95',
  'Arko Energy': '#881337',
  'Evie Networks': '#1e3a8a',
  'Powerfuel': '#14532d',
  'Everty': '#312e81',
  'APCO': '#581c87',
  'Prime Petroleum': '#831843',
  'Prime': '#9d174d',
  'The Major': '#be185d',
  'Supreme Fuel': '#c026d3',
  'Roo Petroleum': '#7c2d12',
  'Infinity': '#4338ca',
  'Greens Mandurama': '#15803d',
  'Bribbaree Servo': '#a16207',
  'Bargo Petroleum': '#b91c1c',
  'AUS Petroleum': '#0369a1',
  'Tinonee General Store': '#065f46',
  'TEMCO Petroleum': '#9a3412',
  'Rural Fuel': '#365314',
  'Payless Fuel': '#1e40af',
  'NPG Retail': '#7e22ce',
  'Matilda': '#be123c',
  'HopeFuel': '#0891b2',
  'Highland Fuels': '#059669',
  'EZ Fuel': '#dc2626',
  'EBM Ampol': '#ffd100',
  'Coral Petroleum': '#0891b2',
  'Calvi Petrol': '#4f46e5',
  'Boost Fuel': '#ea580c',
  'Bendalong General Store': '#06b6d4',
  'Bangalow General Store': '#10b981',
  'APW': '#6366f1',
  'Mobil 1 Carlingford Car Care': '#ed0000'
};

/**
 * Fuel Type Colors
 * Consistent with existing app fuel type colors
 */
export const FUEL_COLORS: Record<string, string> = {
  'Diesel': '#3b82f6',      // Blue
  'Unleaded': '#22c55e',    // Green
  'E10': '#84cc16',         // Lime
  'P95': '#f59e0b',         // Amber
  'P98': '#ef4444',         // Red
  'LPG': '#8b5cf6',         // Purple
  'B20': '#06b6d4',         // Cyan
  'E85': '#10b981',         // Emerald
  'PDL': '#f97316',         // Orange
  'EV': '#6366f1'           // Indigo
};

/**
 * Get a color for a region (with fallback for unknown regions)
 */
export function getRegionColor(region: string): string {
  return REGION_COLORS[region] || generateColor(region);
}

/**
 * Get a color for a brand (with fallback for unknown brands)
 */
export function getBrandColor(brand: string): string {
  return BRAND_COLORS[brand] || generateColor(brand);
}

/**
 * Get a color for a fuel type (with fallback for unknown types)
 */
export function getFuelColor(fuelType: string): string {
  return FUEL_COLORS[fuelType] || generateColor(fuelType);
}

/**
 * Generate a consistent color from a string (for unknown items)
 * Uses a simple hash to generate HSL colors
 */
function generateColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  const saturation = 70;
  const lightness = 50;
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get a lighter version of a color (for backgrounds)
 */
export function lightenColor(color: string, alpha: number = 0.3): string {
  // For HSL colors, adjust lightness
  if (color.startsWith('hsl')) {
    return color.replace(/(\d+)%\)$/, (match, lightness) => {
      const newLightness = Math.min(95, parseInt(lightness) + 30);
      return `${newLightness}%)`;
    }).replace('hsl', 'hsla').replace(')', `, ${alpha})`);
  }
  
  // For hex colors, convert to rgba
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  return color;
}
