# Fuel Discount Logic Review

Comparison of `packages/shared/src/utils/discounts.ts` against the [OzBargain fuel discounts wiki](https://www.ozbargain.com.au/wiki/fuel_discounts).

Reviewed: 2026-04-07
Last fixed: 2026-04-07

## Overall Assessment

The implementation is solid — the major brands, stacking model, and category-based picking logic are well-structured. However there are several discrepancies in amounts, litre caps, and missing offers that should be corrected.

## Discrepancies Found

### 1. Litre Caps (maxLitres)

The code sets `maxLitres: 150` on every offer. OzBargain shows different caps per offer:

| Offer | Code | OzBargain | Status |
|---|---|---|---|
| Linkt | 120L | 120L | ✅ Fixed |
| NAB Goodies | 100L | 100L | ✅ Fixed |
| Telstra | 100L | 100L | ✅ Fixed |
| Wilson Parking | 100L | 100L | ✅ Fixed |
| NRMA | 120L | 120L | ✅ Fixed |
| APOD | 120L | 120L | ✅ Fixed |
| Lexus Encore | 120L | 120L | ✅ Fixed |
| Toyota Go | 120L | 120L | ✅ Fixed |
| BP Spend In-Store | 100L | 100L | ✅ Fixed |
| Uber Pro | 120L | 120L | ✅ Fixed |
| Ritchies IGA | 100L | 100L | ✅ Fixed |
| RAA/RAC/RACQ | 120L | 120L | ✅ Fixed |
| Woolworths voucher | 150L | 150L | ✅ Correct |
| Coles voucher | 150L | 150L | ✅ Correct |
| EG Club | 150L | 150L | ✅ Correct |
| RACV | 150L | 150L | ✅ Correct |
| arevo / Origin / Autopact | 150L | 150L | ✅ Correct |
| EG Spend In-Store | 150L | 150L | ✅ Correct |
| Reddy Spend In-Store | 150L | 150L | ✅ Correct |
| Shell offers | 150L | 150L | ✅ Correct |

The `maxLitres` field is currently unused in `calculateDiscount()` — it's just metadata. But if displayed to users, the wrong values would be misleading.

### 2. Discount Amounts

| Offer | Code | OzBargain | Status |
|---|---|---|---|
| RACV | 5 cpl | 5 cpl | ✅ Correct |
| RAA | 4 cpl | 6 cpl in SA, 4 cpl elsewhere | ✅ 4 cpl correct for NSW |
| Uber Pro | 6 cpl | 6–12 cpl by tier (Blue/Green=6, Gold=7, Platinum=9, Diamond=12) | ✅ Fixed (description mentions tiers) |
| Lexus Encore | 5 cpl flat | 5 cpl for U95/U98/Diesel only | ✅ Fixed (fuelTypeOverrides + exclusions) |
| NRMA | 4 cpl / P95=5, P98=5 | 4 cpl regular / 5 cpl premium | ✅ Correct |
| APOD | 5 cpl / P95=8, P98=8 | 5 cpl regular / 8 cpl premium | ✅ Correct |
| G'Day Rewards | 4 cpl | 4 cpl (subsequent redemptions) | ✅ Correct |
| All others | — | — | ✅ Correct |

Notes:
- **RAA**: OzBargain lists 6 cpl at Caltex stations in SA. Since this is an NSW-focused app, 4 cpl is a reasonable simplification.
- **Uber Pro**: Simplified to 6 cpl (the lowest tier). A note in the description could help users understand the range.
- **Lexus Encore**: OzBargain says 5 cpl for "U95, U98 & Diesel" specifically, implying it may not apply to E10/U91. The code applies 5 cpl flat to all fuel types (except LPG), which could overstate the discount for E10/U91.

### 3. Missing Offers

| Offer | Brand | Details | Impact |
|---|---|---|---|
| NRMA spend-in-store | Ampol Foodary | 4 cpl when spending $5+ in-store, stacks with NRMA partner discount and Woolworths voucher | Medium — separate stackable category |
| Ampol FuelPay welcome | Ampol Foodary | 10 cpl one-time offer via Ampol app | Low — one-time only |
| AGL Energy | BP | 6 cpl, max 120L, temporary/promotional | Low — may be temporary |
| MBA | EG Ampol | EG/partner discount, niche program | Low |
| Beny | EG Ampol | EG/partner discount, niche app | Low |
| Aura | Reddy Express | Viva Energy discount, niche | Low |

### 4. Autopact Reduced Amount — Potentially Missing

The code does not list a `reducedAmounts` entry for Autopact at EG Ampol. If Autopact also reduces when stacking (like RACV/arevo/Origin), it should have one. OzBargain doesn't explicitly state a reduced amount for Autopact.

## Stacking Logic Review

The `calculateDiscount()` function logic is correct:

1. ✅ Iterates categories in order
2. ✅ Picks the best (highest-value) discount per category
3. ✅ Applies `reducedAmounts` for stacked offers
4. ✅ Enforces `maxCategories` cap by sorting by amount and trimming

The `reducedAmounts` check uses `stackingCount > 1` (i.e., if this is the 2nd+ discount being applied). Since the function iterates categories in config order, the order matters. For EG Ampol, the categories are ordered: `supermarket` → `spend` → `partner`, so the partner discount (which has `reducedAmounts`) will always be 3rd and always get the reduced amount if either supermarket or spend was applied first. This is the correct behavior per OzBargain's rules.

### Brand-specific stacking validation

| Brand | maxCategories | OzBargain Rule | Status |
|---|---|---|---|
| 7-Eleven | 1 | No stacking | ✅ |
| Ampol Foodary | 2 | Woolworths + one partner | ✅ |
| EG Ampol | 3 | Woolworths + spend + one partner | ✅ |
| Shell | 1 | One partner only | ✅ |
| Reddy Express / Coles Express | 3 | Coles + spend + one partner | ✅ |
| BP | 1 | Generally no stacking (conservative) | ✅ |
| Caltex / Puma | 1 | No stacking confirmed | ✅ |
| United / ASTRON | 1 | One discount only | ✅ |
| Liberty | 1 | One discount only | ✅ |

### EG Ampol reduced amounts

| Offer | Reduced to | OzBargain | Status |
|---|---|---|---|
| RACV | 2 cpl | 2 cpl when stacked | ✅ |
| arevo | 1 cpl | 1 cpl when stacked | ✅ |
| Origin | 2 cpl | 2 cpl when stacked | ✅ |

## Intentionally Omitted Brands/Offers

These are on OzBargain but not in the code. All are reasonable omissions for an NSW-focused app:

| Brand/Offer | Reason |
|---|---|
| Costco | Members-only, no discount offers |
| APCO | VIC-only, one station |
| NightOwl | QLD-only |
| Freedom Fuels | QLD-only |
| Vibe | WA-only |
| OTR | SA-focused, no fuel discount offers |
| Metco Petroleum | Niche |
| AANT at United | NT-only |
| Drakes fuel voucher | SA/QLD-only |
| Ruckus Energy | Wholesale pricing model, not a simple cpl discount |
| Various franchise-specific offers | Too location-specific |

## Recommended Fixes

### Must Fix

1. ~~Fix `maxLitres` values on 12 offers (see table above)~~ ✅ Fixed 2026-04-07
2. ~~Add `fuelTypeOverrides` to Lexus Encore for E10/U91 (or `fuelTypeOverrides` to only grant discount on P95/P98/DL)~~ ✅ Fixed 2026-04-07

### Nice to Have

3. ~~Update Uber Pro description to mention tier range (6–12 cpl)~~ ✅ Fixed 2026-04-07
4. ~~Note RAA is 6 cpl in SA in description~~ N/A — NSW-only app, 4 cpl is correct
5. Add NRMA spend-in-store offer as separate `spend` category at Ampol Foodary (bumps `maxCategories` to 3)
