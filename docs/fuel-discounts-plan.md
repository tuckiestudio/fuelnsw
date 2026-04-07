# Fuel Discounts Feature — Implementation Plan

> **Discount data last verified:** April 2026
> **Next review due:** July 2026

## Overview

A full discount system where users declare which discount programs they have access to, and the app calculates and displays discounted prices across the map, station panels, and QuickFuel.

## Architecture

**Pure frontend** — no DB changes, no API changes. All discount logic lives in a static data file with calculation functions. The nearest stations API returns pump prices; discounts are applied client-side.

### Key Design Decisions

1. **Uses `station.brand` for discount lookup, NOT `brand_group`.** The `brand_group` column groups by parent company (e.g., EG Ampol → Ampol, Ampol Foodary → Ampol), but discount programs differ by sub-brand. EG Ampol accepts EG Club + Woolworths vouchers, while Ampol Foodary accepts NRMA + Toyota Go. These are different discount programs despite sharing the same `brand_group`.

2. **Reactive state via `.svelte.ts` module.** Discounts need to reactively propagate across 5+ components simultaneously (map markers, StationPanel, QuickFuelSheet, StationListPanel, layout nav badge). A simple `preferences.ts` get/set approach would require each component to poll localStorage independently and wouldn't update in real time. The `.svelte.ts` module-level `$state` pattern is the correct Svelte 5 approach for shared reactive state.

3. **QuickFuel is "best effort".** The nearest stations API sorts by pump price server-side and caps results. After client-side discounts are applied and re-sorted, some stations that would be cheaper after discounts may have been excluded server-side. This is acceptable — QuickFuel's primary purpose is finding the closest cheap fuel nearby, not guaranteed-optimal discounted prices. The API already fetches `limit*50` candidates before filtering to radius, which provides enough headroom for most cases.

---

## File Plan

### 1. NEW: `packages/shared/src/utils/discounts.ts`

Core data model and calculation engine. ~400-500 lines.

#### Types

```typescript
interface DiscountOffer {
  id: string                          // e.g., 'woolworths_voucher'
  name: string                        // e.g., 'Woolworths Fuel Voucher'
  category: string                    // 'supermarket' | 'auto_club' | 'partner_app' | 'spend_instore' | 'seniors' | 'loyalty' | 'price_lock'
  amount: number                      // default c/L discount
  fuelTypeOverrides?: Record<string, number>  // e.g., { P95: 5, P98: 5 }
  fuelTypeExclusions?: string[]       // e.g., ['LPG']
  maxLitres: number
  description: string                 // short eligibility text
  lastVerified: string                // ISO date, e.g., '2026-04-07'
}

interface BrandCategory {
  id: string                          // slot ID: 'supermarket' | 'spend' | 'partner'
  name: string                        // display: 'Supermarket voucher' | 'Spend in-store' | 'Partner discount'
  discountIds: string[]               // which discounts fill this slot
  reducedAmounts?: Record<string, number>  // discountId → c/L when stacked
}

interface BrandDiscountConfig {
  brands: string[]                    // station.brand values (includes legacy names)
  categories: BrandCategory[]
  maxCategories: number               // how many slots can combine
}

interface DiscountResult {
  totalDiscount: number               // c/L
  appliedDiscounts: { id: string; amount: number; name: string }[]
}
```

#### Discount Offers (~25 offers covering all NSW brands with known programs)

| ID | Name | Amount | Accepted at | Verified |
|---|---|---|---|---|
| `woolworths_voucher` | Woolworths Fuel Voucher | 4c/L | Ampol Foodary, EG Ampol, Caltex Woolworths | 2026-04 |
| `coles_voucher` | Coles Fuel Voucher | 4c/L | Reddy Express, Coles Express | 2026-04 |
| `ritchies_iga_voucher` | Ritchies IGA Fuel Voucher | 4c/L | Varies by voucher (location-specific participating stations) | 2026-04 |
| `nrma` | My NRMA | 4c/L (5c premium) | Ampol Foodary only | 2026-04 |
| `racv` | RACV Member | 5c/L | EG Ampol | 2026-04 |
| `raa` | RAA Member | 4c/L (national) | Caltex, Puma Energy (all states) | 2026-04 |
| `rac` | RAC Member | 4c/L | Caltex, Puma Energy (all states) | 2026-04 |
| `racq` | RACQ Member | 4c/L | Caltex, Puma Energy (all states) | 2026-04 |
| `linkt` | Linkt Rewards | 6c/L | 7-Eleven | 2026-04 |
| `nab_goodies` | NAB Goodies | 6c/L | 7-Eleven | 2026-04 |
| `telstra` | Telstra App | 6c/L | 7-Eleven | 2026-04 |
| `wilson_parking` | Wilson Parking Perks | 6c/L | 7-Eleven | 2026-04 |
| `afl_live` | AFL Live App | 4c/L | Shell, Reddy Express, Coles Express | 2026-04 |
| `shell_vpower_racing` | Shell V-Power Racing | 4c/L | Shell, Reddy Express, Coles Express | 2026-04 |
| `gday_rewards` | G'Day Rewards | 6c/L first / 4c/L after | Shell, Reddy Express, Coles Express | 2026-04 |
| `shell_secret_saver` | Shell Secret Saver | 4c/L | Reddy Express, Coles Express | 2026-04 |
| `toyota_go` | Toyota Go | 4c/L | Ampol Foodary | 2026-04 |
| `apod` | APOD (Defence) | 5c/L (8c premium) | Ampol Foodary | 2026-04 |
| `lexus_encore` | Lexus Encore | 5c/L | Ampol Foodary | 2026-04 |
| `eg_club` | EG Club Member | 5c/L | EG Ampol, Caltex Woolworths | 2026-04 |
| `arevo` | arevo by RACV | 4c/L | EG Ampol, Caltex Woolworths | 2026-04 |
| `origin_energy` | Origin Energy | 4c/L | EG Ampol, Caltex Woolworths | 2026-04 |
| `autopact` | Autopact Loyalty | 4c/L | EG Ampol, Caltex Woolworths | 2026-04 |
| `uber_pro` | Uber Pro | 6-12c/L (tiered) | BP | 2026-04 |
| `eg_spend_instore` | Spend $5+ In-store | 4c/L | EG Ampol, Caltex Woolworths | 2026-04 |
| `reddy_spend_instore` | Spend $20+ In-store | 10c/L | Reddy Express, Coles Express | 2026-04 |
| `bp_spend_instore` | Buy 2 Promotional Products | 8c/L | BP | 2026-04 |
| `nsw_seniors` | NSW Seniors Card | 4c/L (via United app) | United | 2026-04 |
| `711_price_lock` | 7-Eleven Fuel Price Lock | variable | 7-Eleven | 2026-04 |

##### Research notes (April 2026)

- **Woolworths vouchers**: Accepted at EG Ampol and Ampol Foodary ONLY. NOT accepted at United, BP, Shell, or independent stations.
- **Coles vouchers**: Accepted at Shell Coles Express and Reddy Express ONLY.
- **Ritchies IGA**: Participating petrol stations vary by location and are printed on each voucher. Not a universal brand partnership. Implemented as a generic discount that can be toggled.
- **United Petroleum**: Does NOT accept Woolworths or Coles vouchers. The original plan incorrectly listed United as accepting both. United only has its own app-based seniors card discount.
- **NSW Seniors Card at United**: The formal NSW Government partnership was terminated in December 2024, but discount may still be available via the United Petroleum mobile app. Implemented as a standalone discount with a caveat.
- **NRMA**: Ampol Foodary ONLY. Not available at EG Ampol stations.
- **RAA/RAC/RACQ**: These auto clubs operate nationally at participating Caltex stations (4c/L outside home state). Valid in NSW.
- **Lowes** (61 stations): No known supermarket voucher acceptance. Has its own bp+ fuel card but that's a commercial product, not a consumer discount.
- **South West** (21 stations): Rural independent chain in western NSW. No known discount programs.
- **Enhance** (80 stations), **Budget** (91 stations), **Exploren** (236 stations): No known discount programs.

#### Brand Configs (13 configs covering all NSW brands with discount programs)

| Config | Brands | Slots | Max Stack |
|---|---|---|---|
| 7-Eleven | `7-Eleven` | partner (Linkt/NAB/Telstra/Wilson) + price_lock | 1 |
| Ampol Foodary | `Ampol Foodary` | supermarket (Woolworths) + partner (NRMA/Toyota/APOD/Lexus) | 2 |
| EG Ampol | `EG Ampol`, `Caltex Woolworths` | supermarket (Woolworths) + spend (EG spend) + partner (EG Club/RACV/arevo/Origin/Autopact) | 3 |
| Ampol Other | `Ampol`, `Ampol Breeze`, `EBM Ampol`, `U-Go` | none | 0 |
| Shell | `Shell` | partner (AFL/V-Power/G'DAY) | 1 |
| Reddy Express | `Reddy Express`, `Coles Express` | supermarket (Coles) + spend ($20+) + partner (AFL/V-Power/G'DAY/Secret Saver) | 3 |
| BP | `BP` | spend (BP spend) + partner (Uber Pro) + supermarket (Ritchies, location-dependent) | 1 |
| Caltex | `Caltex`, `Puma Energy` | partner (RAA/RAC/RACQ) + supermarket (Ritchies, location-dependent) | 1 |
| United | `United`, `ASTRON` | seniors (NSW Seniors via app) | 1 |
| Liberty | `Liberty` | supermarket (Ritchies, location-dependent) | 1 |
| Westside | `Westside` | none | 0 |
| Metro Fuel | `Metro Fuel`, `Lowes` | none | 0 |
| No Discounts | All other brands | none | 0 |

**Fallback**: `getDiscountConfig()` returns `null` for any brand not found in the configs above. When `null`, no discounts are applied and no discount UI is shown for that station.

#### Key Functions

- `getDiscountConfig(brand: string): BrandDiscountConfig | null` — looks up config by brand, handles legacy name mapping. Returns `null` for unknown brands.
- `calculateDiscount(brand, fuelType, selectedDiscountIds, priceLockInfo?): DiscountResult` — core engine that finds the best valid combination
- `getAllDiscountOffers(): DiscountOffer[]` — returns all offers for the selector UI
- `getCategoryGroups(): { id: string, name: string, discounts: DiscountOffer[] }[]` — groups for the UI
- `getLastVerifiedDate(): string` — returns the oldest `lastVerified` date across all offers, for display in the UI

#### Stacking Calculation Logic

1. Look up brand config
2. For each category/slot, find which of the user's selected discounts match
3. For each matched category, pick the highest-value discount
4. If `maxCategories > 1`, sort categories by value and take top N
5. Apply reduced amounts for stacked discounts
6. Apply fuel-type overrides and exclusions
7. Return total discount + breakdown

---

### 2. NEW: `apps/web/src/lib/discount-state.svelte.ts`

Shared reactive state (Svelte 5 `.svelte.ts` module). This MUST be a `.svelte.ts` file (not plain `.ts`) because it uses Svelte 5 runes (`$state`, `$derived`) at module level for cross-component reactivity.

```typescript
import { getDiscounts, setDiscounts, getLockedPrice, setLockedPrice } from './preferences';

let selectedDiscounts = $state<string[]>(getDiscounts());
let sevenElevenLockedPrice = $state<number | null>(getLockedPrice());
let showDiscountModal = $state(false);
let discountCount = $derived(selectedDiscounts.length + (sevenElevenLockedPrice != null ? 1 : 0));

export { selectedDiscounts, sevenElevenLockedPrice, showDiscountModal, discountCount };

export function toggleDiscount(id: string) {
  const idx = selectedDiscounts.indexOf(id);
  if (idx >= 0) {
    selectedDiscounts = selectedDiscounts.filter(d => d !== id);
  } else {
    selectedDiscounts = [...selectedDiscounts, id];
  }
  setDiscounts(selectedDiscounts);
}

export function updateLockedPrice(price: number | null) {
  sevenElevenLockedPrice = price;
  setLockedPrice(price);
}
```

---

### 3. MODIFY: `apps/web/src/lib/preferences.ts`

Add 2 new keys to the `KEYS` object and 4 new get/set functions:

```typescript
// In KEYS object:
discounts: 'fuelscoutnsw_discounts',
lockedPrice: 'fuelscoutnsw_711_locked_price',

// New functions:
export function getDiscounts(): string[] {
  return get(KEYS.discounts, []);
}

export function setDiscounts(ids: string[]): void {
  set(KEYS.discounts, ids);
}

export function getLockedPrice(): number | null {
  return get(KEYS.lockedPrice, null);
}

export function setLockedPrice(price: number | null): void {
  set(KEYS.lockedPrice, price);
}
```

---

### 4. NEW: `apps/web/src/components/map/DiscountModal.svelte`

Full-screen modal at `z-[2001]` (one level above Onboarding at `z-[2000]` to avoid any overlap):

- Header with title + close button
- Grouped sections (Supermarket, Auto Club, Partner Apps, Loyalty, Spend In-Store, Seniors)
- Each discount as a toggle row: name, description, amount badge
- 7-Eleven Price Lock section: toggle + price input field
- Active discount count badge in header
- Discounts are immediately reflected when toggled (live updates via reactive state)
- Footer with "Done" button
- Footer shows "Discount data last verified: April 2026" sourced from `getLastVerifiedDate()`

---

### 5. MODIFY: `apps/web/src/routes/+layout.svelte`

Add "Discounts" button in nav bar between Summary and Remove Ads. Use compact icon-only style on mobile to avoid crowding the `h-14` nav bar:

```svelte
<!-- Desktop: icon + text -->
<button onclick={() => showDiscountModal = true}
  class="hidden sm:flex px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 items-center gap-1">
  Discounts
  {#if discountCount > 0}
    <span class="bg-green-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
      {discountCount}
    </span>
  {/if}
</button>

<!-- Mobile: icon only -->
<button onclick={() => showDiscountModal = true}
  class="sm:hidden relative p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50"
  aria-label="Fuel discounts">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
  </svg>
  {#if discountCount > 0}
    <span class="absolute -top-0.5 -right-0.5 bg-green-600 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
      {discountCount}
    </span>
  {/if}
</button>
```

Add `<DiscountModal>` conditional render (like PaywallModal).

---

### 6. MODIFY: `apps/web/src/routes/+page.svelte`

Major changes:

- Import discount state and calculation function
- Add reactive `discountedPrices` derived from stations + selected discounts
- Modify `renderMarkers()`: calculate discounted price, show it with a small discount badge
- Modify `updatePriceRange()`: use discounted prices for color calculation
- Modify tooltips: show original price strikethrough + discounted price
- Re-render markers when discount state changes (via `$effect`)
- For QuickFuel: apply discounts client-side and re-sort by discounted price (best effort — see limitations)

#### Marker HTML

When no discounts apply:

```html
<div class="price-label" style="background:${color}">
  <span>165.9</span>
</div>
```

When discounts apply:

```html
<div class="price-label price-label-discounted" style="background:${color}">
  <span>159.9</span>
  <span class="discount-badge">-6</span>
</div>
```

#### Required CSS additions to `+page.svelte` `<style>` block

```css
:global(.price-label-discounted) {
  position: relative;
  padding-right: 18px;
}

:global(.discount-badge) {
  position: absolute;
  top: -5px;
  right: -6px;
  background: #16a34a;
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 3px;
  border-radius: 6px;
  line-height: 1.2;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.6);
}
```

---

### 7. MODIFY: `apps/web/src/components/map/StationPanel.svelte`

- Import discount state and `calculateDiscount`
- Calculate applicable discount for the station using `station.properties.brand`
- Show discount breakdown section after the "Current Prices" list:
  - Original price: ~~165.9~~
  - Discount breakdown: -4c/L Woolworths + -4c/L NRMA
  - Discounted price: **157.9** (larger, green)
- Only show if discounts are active and apply to this station

---

### 8. MODIFY: `apps/web/src/components/map/QuickFuelSheet.svelte`

- Import discount state and `calculateDiscount`
- Apply discounts to station prices using `station.brand`
- Re-sort by discounted price (best effort — see Limitations section)
- Show discounted prices with a toggle to see pump prices
- Show discount indicator next to prices

Note: QuickFuelSheet receives `NearestStation[]` (not `StationGeoJSON[]`). The `brand` field is available on `NearestStation` for discount lookup.

---

### 9. MODIFY: `apps/web/src/components/map/StationListPanel.svelte`

- Import discount state and `calculateDiscount`
- Apply discounts to prices using `station.properties.brand`
- Show discounted prices with indicator
- Sort by discounted price when discounts are active (uses same sort logic, just with adjusted price values)

---

## Brand Name Mapping

Critical for correctness — the `brand` field from the DB/API maps to discount groups. The `brand_group` field is NOT used (it groups by parent company, not by discount program).

| DB Brand | Discount Group | Why |
|---|---|---|
| `EG Ampol` | EG Ampol | Accepts Woolworths, EG Club, arevo, etc. |
| `Caltex Woolworths` | EG Ampol (same stations) | Rebranding to EG Ampol, same discount programs |
| `Ampol Foodary` | Ampol Foodary | Accepts Woolworths, NRMA, Toyota Go, etc. |
| `Ampol`, `Ampol Breeze`, `EBM Ampol`, `U-Go` | Ampol Other (no discounts) | No consumer discount programs |
| `Reddy Express` | Shell Reddy Express | Accepts Coles, G'DAY Rewards, Spend $20+, etc. |
| `Coles Express` | Shell Reddy Express (same stations) | Rebranding to Reddy Express, same discount programs |
| `Shell` | Shell | Accepts G'DAY Rewards, AFL, V-Power Racing |
| `Caltex`, `Puma Energy` | Caltex | Accepts RAA/RAC/RACQ auto clubs nationally |
| `United`, `ASTRON` | United | NSW Seniors via app only. NO supermarket vouchers |
| `Westside` | Westside (no discounts) | No Viva Energy discount programs |
| `Metro Fuel`, `Lowes` | No discounts | No known consumer discount programs |
| All other brands | No discounts | Independent/EV/small chains — no known programs |

---

## Edge Cases

1. **LPG exclusions**: Most partner discounts exclude LPG. If user selects LPG as fuel type, only supermarket vouchers apply (and not all of those).
2. **Premium fuel overrides**: NRMA gives 5c/L on P95/P98 vs 4c/L on regular. APOD gives 8c/L on premium vs 5c/L on regular.
3. **Reduced stacking amounts**: RACV drops from 5c → 2c when stacked with Woolworths at EG Ampol. Origin drops 4c → 2c. arevo drops 4c → 1c.
4. **7-Eleven Price Lock cap**: Discount capped at 25c/L. If pump is cheaper than locked price, no discount.
5. **No applicable discounts**: Show pump price as-is, no discount indicator. `getDiscountConfig()` returns `null` → no discount UI shown.
6. **Uber Pro tiers**: Use the lowest tier (Blue/Green = 6c/L) as the default. User can select higher if they're Gold/Platinum/Diamond.
7. **G'DAY Rewards first vs subsequent**: Use 4c/L as the default (subsequent redemptions). Could add a toggle for "first redemption" but that's minor.
8. **Ritchies IGA vouchers**: Participating petrol stations vary by location (printed on each voucher). Implemented as a generic discount that users self-select. The app cannot verify which stations actually accept a particular Ritchies voucher.
9. **United NSW Seniors**: Formal government partnership terminated Dec 2024. Discount may still work via the United Petroleum app. Implemented with a description caveat.
10. **Unknown brands**: Any brand not in the brand configs gets `null` from `getDiscountConfig()` — no discount applied, no discount UI shown. This correctly handles the 60+ independent/EV/small brands in the DB.

---

## Limitations

### QuickFuel "Best Effort" Discounts

The `/api/fuel/stations/nearest` endpoint sorts by pump price ASC server-side and returns the top N cheapest stations within a radius. When discounts are applied client-side:

1. The order may change (a more expensive pump-price station at a discount-friendly brand could become cheapest after discounts)
2. Some stations that would be cheapest after discounts may not have been included in the server response (they were pruned server-side because their pump price was too high)

**This is accepted behavior.** QuickFuel's primary purpose is "nearest cheap fuel" — the API already fetches `limit*50` candidates sorted by price before distance-filtering, which provides good coverage. The discounted re-sort is a display enhancement, not a guarantee of finding the globally optimal discounted price.

### Discount Data Staleness

Discount programs change frequently (amounts, participating brands, program terminations). The data is hardcoded in `discounts.ts` and requires a code deploy to update. Each `DiscountOffer` has a `lastVerified` date field, and the DiscountModal footer shows the oldest verification date to set user expectations.

---

## Stacking Reference

### Best Possible Stacking by Brand

| Brand | Slot 1 | Slot 2 | Slot 3 | Max Discount |
|---|---|---|---|---|
| **Shell Reddy Express** | Coles voucher (4c) | Spend $20+ (10c) | G'DAY Rewards first (6c) | **20c/L** |
| **Shell Reddy Express** | Coles voucher (4c) | Spend $20+ (10c) | AFL/V-Power (4c) | **18c/L** |
| **EG Ampol** | Woolworths (4c) | Spend $5+ (4c) | EG Club (5c) | **13c/L** |
| **Ampol Foodary** | Woolworths (4c) | NRMA premium (5c) | — | **9c/L** |
| **7-Eleven** | Linkt/NAB/Telstra/Wilson (6c) | — | — | **6c/L** |
| **BP** | Ritchies IGA (4c) | — | — | **4c/L** |
| **Caltex** | RAA/RAC/RACQ (4c) | — | — | **4c/L** |
| **United** | NSW Seniors (4c) | — | — | **4c/L** |

### Reduced Amounts When Stacked

These discounts reduce in value when combined with other slots at the same brand:

| Discount | Normal | Stacked with Woolworths at EG Ampol |
|---|---|---|
| RACV | 5c/L | 2c/L |
| arevo | 4c/L | 1c/L |
| Origin | 4c/L | 2c/L |

---

## Implementation Order

1. `packages/shared/src/utils/discounts.ts` — data model + calculation logic + `lastVerified` on every offer
2. `apps/web/src/lib/preferences.ts` — add discount preference keys (4 new functions)
3. `apps/web/src/lib/discount-state.svelte.ts` — shared reactive state (must be `.svelte.ts`, not `.ts`)
4. `apps/web/src/components/map/DiscountModal.svelte` — the selector UI at `z-[2001]`
5. `apps/web/src/routes/+layout.svelte` — nav link (compact icon on mobile, text+icon on desktop) + modal mount
6. `apps/web/src/routes/+page.svelte` — apply discounts to map markers + add CSS for `.price-label-discounted` and `.discount-badge`
7. `apps/web/src/components/map/StationPanel.svelte` — discount breakdown
8. `apps/web/src/components/map/QuickFuelSheet.svelte` — discounted QuickFuel (best effort re-sort, uses `station.brand`)
9. `apps/web/src/components/map/StationListPanel.svelte` — discounted list (uses `station.properties.brand`)

---

## Maintenance Guide

### How to Review & Update Discount Data

Discount data should be reviewed every 3 months (or when a user reports inaccurate discounts).

#### Quick review process

1. Open `packages/shared/src/utils/discounts.ts`
2. For each `DiscountOffer`, check the primary source:
   - **Woolworths**: [everyday.com.au](https://www.everyday.com.au/fuel) — check amount and participating sites
   - **Coles/Flybuys**: [reddyexpress.com.au](https://www.reddyexpress.com.au) — check amount and participating sites
   - **NRMA**: [mynrma.com.au/member-benefits](https://www.mynrma.com.au/member-benefits) — check fuel discount section
   - **EG Club**: [eg.com.au](https://www.eg.com.au) — check EG Club benefits
   - **G'DAY Rewards**: [reddyexpress.com.au](https://www.reddyexpress.com.au) — check G'DAY section
   - **7-Eleven**: [7eleven.com.au](https://www.7eleven.com.au) — check Fuel Price Lock and partner apps
   - **RAA/RAC/RACQ**: [caltex.com.au](https://www.caltex.com.au) — check auto club partnerships
   - **Shell partners**: [shell.com.au](https://www.shell.com.au) — check partner programs
   - **United**: [unitedpetroleum.com.au](https://www.unitedpetroleum.com.au) — check loyalty/seniors
3. Update `amount`, `fuelTypeOverrides`, accepted brands, and `lastVerified` date
4. Update the "Discount data last verified" date at the top of this file
5. If a discount program was terminated, remove the offer and remove its ID from all `BrandCategory.discountIds` arrays

#### What to watch for

- Amount changes (e.g., 4c/L → 3c/L)
- Brand acceptance changes (stations switching networks)
- New discount programs (e.g., a new partner app at Shell)
- Program terminations (e.g., NSW Seniors at United was partially terminated)
- Stacking rule changes (reduced amounts when combined)

---

## NSW Brands with Stations (Reference)

Brands present in the NSW Fuel Check API with station counts, verified against live DB:

| Brand | Count | Has Discounts |
|---|---|---|
| Independent | 1081 | No |
| BP | 920 | Yes |
| Caltex | 703 | Yes |
| Ampol | 687 | No (Ampol Other) |
| Metro Fuel | 636 | No |
| 7-Eleven | 488 | Yes |
| Caltex Woolworths | 392 | Yes (→ EG Ampol) |
| EG Ampol | 355 | Yes |
| Shell | 352 | Yes |
| Reddy Express | 292 | Yes |
| Coles Express | 287 | Yes (→ Reddy Express) |
| Exploren | 236 | No |
| Tesla | 225 | No (EV) |
| Ampol Foodary | 218 | Yes |
| United | 209 | Limited (Seniors via app) |
| Mobil | 171 | No |
| AGL | 153 | No (EV) |
| Liberty | 129 | Limited (Ritchies, location-dependent) |
| Speedway | 113 | No |
| Independent EV | 99 | No (EV) |
| Budget | 91 | No |
| Enhance | 80 | No |
| NRMA | 78 | No |
| Chargefox | 73 | No (EV) |
| Pearl Energy | 71 | No |
| Lowes | 61 | No |
| Westside | 60 | No |
| IOR Group | 51 | No |
| Puma Energy | 43 | Yes (→ Caltex) |
| Inland Petroleum | 26 | No |
| Woodham Petroleum | 25 | No |
| U-Go | 24 | No (→ Ampol Other) |
| ChargePoint | 24 | No (EV) |
| ASTRON | 24 | Limited (→ United) |
| South West | 21 | No |
| JOLT | 21 | No (EV) |
| Ultra Petroleum | 16 | No |
| Ampol Breeze | 15 | No (→ Ampol Other) |
| Transwest Fuels | 12 | No |
| Costco | 12 | No |
| All others (<10 stations each) | ~50 | No |
