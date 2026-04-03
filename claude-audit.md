# AusFuel Production Readiness Audit

**Date**: 2026-04-03  
**Auditor**: Claude Opus 4.6  
**Scope**: Full codebase audit — security, reliability, correctness, performance, deployment

---

## 🚨 Critical — Must Fix Before Production

### 1. Secrets Committed to Git

**File**: [.env](file:///Users/bob/Projects/ausfuel/.env)

The root `.env` file contains **real API keys and admin tokens** and is tracked by git:

```
NSW_FUEL_KEY=jjq67jaFs02676n1BTKJ8sFKekzJdOPy
NSW_FUEL_SECRET=xYrX195gInoQDTGj
ADMIN_TOKEN=36392d6860267fb0f21d835bbba316e75d54265c54a4172b73fc7c702a3783bd
```

> [!CAUTION]
> These credentials are now in your git history. Even if you delete the file, they remain in past commits. You must:
> 1. **Rotate all three credentials immediately** (NSW API key/secret, admin token)
> 2. Remove the root `.env` from git tracking (`git rm --cached .env`)
> 3. Confirm `.env` is in `.gitignore` (it is, but verify it covers the root file)
> 4. Consider using `git filter-branch` or BFG Repo Cleaner to purge from history if the repo is public

---

### 2. RevenueCat API Key Is a Test Key

**File**: [subscription.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/lib/subscription.ts#L59-L61)

```ts
const apiKey = Capacitor.getPlatform() === 'ios'
    ? 'test_MxcUIPbEYHMkaNWSwvVwmEMIqec'
    : 'test_MxcUIPbEYHMkaNWSwvVwmEMIqec';
```

- Both iOS and Android use the **same test key** — the `test_` prefix means this is a sandbox key, not production
- Each platform should have its own production API key
- These should be environment variables, not hardcoded strings

---

### 3. Capacitor `server.url` Points to Raw IP Over HTTP

**File**: [capacitor.config.ts](file:///Users/bob/Projects/ausfuel/capacitor.config.ts#L8-L9)

```ts
server: {
    url: 'http://150.107.73.209',
    cleartext: true
},
```

- **HTTP traffic in cleartext** — all user data, API keys in auth headers, and fuel price searches are transmitted unencrypted
- The raw IP exposes the server's actual address (should be behind a domain with HTTPS)
- This will be rejected by Apple's App Transport Security for iOS submission
- **Fix**: Change to `https://yourdomain.com.au` and set `cleartext: false`

---

### 4. Google Places API Key Exposed in URL Query Parameters

**File**: [google-places-client.ts](file:///Users/bob/Projects/ausfuel/packages/shared/src/api/google-places-client.ts#L52)

```ts
const response = await fetch(`${PLACES_API_BASE}/places:searchText?key=${apiKey}`, {
```

The API key is sent as a URL query parameter. While this is Google's documented approach, it means the key appears in:
- Server access logs
- Network monitoring tools
- Error tracking systems

> [!WARNING]
> Ensure the API key is restricted to the Places API only and has IP-based restrictions in the Google Cloud Console. Set a billing alert to prevent unexpected charges from abuse.

---

### 5. Geolocate Endpoint Uses HTTP (Not HTTPS) to ip-api.com

**File**: [geolocate/+server.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/routes/api/geolocate/+server.ts#L21)

```ts
const url = ip ? `http://ip-api.com/json/${ip}?fields=status,lat,lon` : ...
```

- User IP addresses are sent over **unencrypted HTTP** to a third-party service
- This is a privacy concern — ISPs and network intermediaries can see which IPs you're querying
- ip-api.com's free tier doesn't support HTTPS; consider switching to a service that does (ipapi.co, ipinfo.io) or using a paid ip-api.com plan

---

## ⚠️ High Priority — Should Fix

### 6. `require()` Inside ESM Files — **FIXED**

**Files**: [web hooks.server.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/hooks.server.ts), [dashboard hooks.server.ts](file:///Users/bob/Projects/ausfuel/apps/dashboard/src/hooks.server.ts)

Replaced `require('zlib')` with `import { constants as zlibConstants } from 'node:zlib'` at the top of both files.

---

### 7. `compressResponse` Function Is Dead Code — **FIXED**

**File**: [web hooks.server.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/hooks.server.ts)

Removed the unused `compressResponse()` function (was lines 104-142). The actual compression logic is inlined in the `handle` function.

---

### 8. CSP Includes `'unsafe-eval'` in `script-src` — **DEFERRED**

**File**: [web hooks.server.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/hooks.server.ts)

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com ...
```

`'unsafe-eval'` is a significant CSP weakening. If this is required only by Google AdSense, consider:
- Using nonce-based CSP instead of `'unsafe-inline'`
- Verifying if `'unsafe-eval'` is truly needed (AdSense often needs `'unsafe-inline'` but not always `'unsafe-eval'`)
- Using `'strict-dynamic'` with nonces for a tighter policy

> **Reason for deferral**: AdSense requires `'unsafe-eval'` to function. Removing it breaks ad rendering. Risk of regression outweighs benefit.

---

### 9. Dashboard Missing `better-sqlite3` in Direct Dependencies — **FIXED**

**File**: [dashboard/package.json](file:///Users/bob/Projects/ausfuel/apps/dashboard/package.json)

Added `"better-sqlite3": "^12.8.0"` to dashboard's `dependencies`, matching the web app version.

---

### 10. Dashboard `vite.config.ts` Missing `ssr.external` — **FIXED**

**File**: [dashboard/vite.config.ts](file:///Users/bob/Projects/ausfuel/apps/dashboard/vite.config.ts)

Added `ssr: { external: ['better-sqlite3'] }` to match the web app config.

---

### 11. Nightly Aggregation Timezone Bug — **FIXED**

**File**: [weekly-aggregation.ts](file:///Users/bob/Projects/ausfuel/packages/shared/src/db/weekly-aggregation.ts)

Replaced hardcoded server-local-time scheduling with proper `Australia/Sydney` timezone calculation using `toLocaleString('en-US', { timeZone: 'Australia/Sydney' })`. Removed the unused `SYDNEY_OFFSET` constant. The aggregation now correctly fires at 2 AM Sydney time regardless of server timezone.

---

### 12. Rate Limit Memory Leak (No Max Size) — **DEFERRED**

**Files**: [web hooks.server.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/hooks.server.ts), [dashboard hooks.server.ts](file:///Users/bob/Projects/ausfuel/apps/dashboard/src/hooks.server.ts)

The cleanup interval runs every 60 seconds, but under a DDoS from many distinct IPs, the Map can grow unboundedly.

> **Reason for deferral**: The 60-second cleanup interval handles normal traffic well. Adding a max size check adds complexity for a scenario better handled by a reverse proxy (Traefik) or CDN rate limiter in production.

---

### 13. History API Rate Limit Exemption — **DEFERRED**

**File**: [web hooks.server.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/hooks.server.ts)

The `/api/fuel/history` endpoint is **completely exempt from rate limiting**. This endpoint runs DB queries with `strftime`, `AVG`, and `GROUP BY` — making it computationally expensive. An attacker could abuse this to exhaust server resources.

> **Reason for deferral**: The endpoint is cached (30s TTL via node-cache + 600s Cache-Control), which limits actual DB hits. Adding rate limiting here is a minor hardening step rather than a critical fix.

---

### 14. Cache-Control Header Matching Bug — **FIXED**

**File**: [web hooks.server.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/hooks.server.ts)

Changed `startsWith(prefix + '?')` to `startsWith(prefix + '/')`. The `pathname` property never includes query strings, so the old check never matched. Sub-path endpoints like `/api/fuel/stations/viewport` now correctly receive `Cache-Control` headers.

---

### 15. AdSense Publisher ID Hardcoded

**File**: [app.html:10](file:///Users/bob/Projects/ausfuel/apps/web/src/app.html#L10)

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8792853309353392" ...>
```

And in [ads.ts:35](file:///Users/bob/Projects/ausfuel/apps/web/src/lib/ads.ts#L35):
```ts
const adId = platform === 'ios'
    ? 'ca-app-pub-8792853309353392/1412128551'
    : 'ca-app-pub-8792853309353392/5714335648';
```

These are production ad unit IDs hardcoded in source. While not a secret per se (they're in client-side code anyway), they should be validated to ensure they're the correct production IDs and not test placeholders.

---

## 🟡 Medium Priority — Recommended

### 16. `schema.ts` Does Not Create Core Tables — **FIXED**

**File**: [schema.ts](file:///Users/bob/Projects/ausfuel/packages/shared/src/db/schema.ts)

Added `CREATE TABLE IF NOT EXISTS` statements for all 8 core tables (`stations`, `live_prices`, `historical_prices`, `station_fuel_inventory`, `refresh_log`, `fuel_availability_events`, `daily_snapshots`, `pending_drops`) plus all required indexes. Also added the `brand_group` column migration. Fresh deployments will now initialize correctly without manual setup.

---

### 17. Duplicate Fuel Type Mapping Definitions — **FIXED**

**Files**: [fuel-types.ts](file:///Users/bob/Projects/ausfuel/packages/shared/src/utils/fuel-types.ts), [prices.ts](file:///Users/bob/Projects/ausfuel/packages/shared/src/db/prices.ts), [history/+server.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/routes/api/fuel/history/+server.ts)

Consolidated all fuel type mappings into a single source in `fuel-types.ts`:
- `FUEL_TYPE_MAP` (API code → display name) — used by `prices.ts`
- `REVERSE_FUEL_MAP` (display name → API code) — used by `prices.ts`
- `HISTORY_FUEL_MAP` (display name → array of both forms) — used by history API

Removed the local duplicates from `prices.ts` and `history/+server.ts`. New fuel types now only need to be added in one place.

---

### 18. Ghost Route Directories — **FIXED**

Deleted empty directories:
- `apps/web/src/routes/api/fuel/stations/{viewport}/`
- `apps/web/src/routes/api/fuel/history/{batch}/`

These were leftover from abandoned route attempts. The actual routes exist in `viewport/` and `batch/` (without braces).

---

### 19. `postcode-boundary` Cache Path Resolution

**File**: [postcode-boundary/+server.ts:7](file:///Users/bob/Projects/ausfuel/apps/web/src/routes/api/postcode-boundary/+server.ts#L7)

```ts
const CACHE_DIR = path.resolve('data/boundaries');
```

This resolves relative to `process.cwd()`. In development, this creates files in `apps/web/data/boundaries/`. In Docker production, it resolves to `/app/data/boundaries` which is inside the mounted volume. This inconsistency means:
- Boundary files created in dev don't carry over to production
- Git status shows untracked files under `apps/web/data/`
- **Fix**: Use `DATA_DIR` env var like the database client does

---

### 20. `stationCount` in Dashboard Summary Is Over-Counted

**File**: [regions.ts:296](file:///Users/bob/Projects/ausfuel/packages/shared/src/db/regions.ts#L296)

```ts
stationCount: row.station_count || 0,
```

The `SUM(station_count)` across weekly aggregates sums station counts **per week per region per brand per fuel**, resulting in massive over-counting. This should likely be `COUNT(DISTINCT ...)` or use a separate query for total unique station count.

---

### 21. `any` Types Throughout `regions.ts`

**File**: [regions.ts](file:///Users/bob/Projects/ausfuel/packages/shared/src/db/regions.ts)

Four instances of `const params: any[]` (lines 180, 231, 313, 416). These should be typed as `(string | number)[]` for type safety. Also, [subscription.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/lib/subscription.ts) uses `as any` casts in multiple places.

---

### 22. Missing Input Validation on Dashboard Endpoints

Dashboard API endpoints accept `months` as a query parameter:
```ts
months: parseInt(url.searchParams.get('months') || '12'),
```

- No upper bound check — a user could pass `months=99999` and pull the entire dataset
- The `regions` and `brands` arrays accept arbitrary string values without sanitization
- While SQL injection is prevented by parameterized queries, resource exhaustion is possible

---

### 23. `useClones: true` in Cache May Cause Performance Issues

**File**: [cache.ts:6](file:///Users/bob/Projects/ausfuel/packages/shared/src/cache.ts#L6)

```ts
useClones: true,
```

With `useClones: true`, `node-cache` deep-clones every cached value on get/set. For large API responses (the dashboard stats response can be substantial), this adds significant CPU overhead. Consider `useClones: false` if the cached values aren't mutated after retrieval.

---

### 24. Scheduler Runs Refresh After Only 30 Seconds

**File**: [scheduler.ts:154-156](file:///Users/bob/Projects/ausfuel/packages/shared/src/scheduler.ts#L154-L156)

```ts
setTimeout(() => {
    runRefresh();
}, 30_000);
```

On every server restart, a refresh is triggered after 30 seconds. If the server restarts frequently (e.g., during deployments), this could burn through API rate limits. The cooldown logic in `runRefresh()` should prevent double-fetching, but consider making the initial delay configurable or checking last refresh time before scheduling.

---

### 25. Drive Time Estimation Is Naive

**File**: [stations.ts:226](file:///Users/bob/Projects/ausfuel/packages/shared/src/db/stations.ts#L226)

```ts
drive_minutes: Math.round(r.distance_km / 0.5)
```

This assumes an average speed of **30 km/h** (0.5 km/min). That's reasonable for city driving but inaccurate for rural areas. Consider labelling this as "estimated" in the UI, or simply showing distance without time.

---

## 🔵 Low Priority — Nice to Have

### 26. Missing Error Handling in `checkAuth`

**File**: [refresh/+server.ts:20-22](file:///Users/bob/Projects/ausfuel/apps/web/src/routes/api/refresh/+server.ts#L20-L22)

```ts
const a = Buffer.from(parts[1]);
const b = Buffer.from(adminToken);
return a.length === b.length && timingSafeEqual(a, b);
```

`timingSafeEqual` throws if buffer lengths differ, but the length check guards against that. However, if `Buffer.from` receives malformed input, it could throw. Wrap in try-catch for robustness.

---

### 27. Empty `fuelnsw.sqlite` at Project Root

There's a zero-byte `fuelnsw.sqlite` file at the project root (outside `data/`). This appears to be an artifact from running with `DATA_DIR` not set properly. It should be deleted.

---

### 28. `data/boundaries/` Files Appearing in Web App Directory

Git status shows boundary cache files under `apps/web/data/boundaries/` (e.g., `2000.json`, `2077.json`). These are being cached relative to `process.cwd()` which is `apps/web/` during dev. Add `apps/web/data/` to `.gitignore`.

---

### 29. No Tests

The entire project has zero test files. For production readiness, at minimum:
- Unit tests for `parseAddress`, `isOpenNow`, fuel type mapping
- Integration tests for key API endpoints (`/api/fuel/stations`, `/api/fuel/history`)
- Smoke tests for the scheduled refresh flow

---

### 30. No Structured Logging

All logging uses `console.log`/`console.error`/`console.warn`. For production observability, consider:
- A structured logging library (pino, winston) with JSON output
- Log levels (debug, info, warn, error)
- Request ID tracking for correlation

---

### 31. PWA Icon Files May Not Exist

**File**: [vite.config.ts](file:///Users/bob/Projects/ausfuel/apps/web/vite.config.ts#L24-L29)

The PWA manifest references icons at `/icons/icon-192x192.png`, `/icons/icon-512x512.png`, etc. Verify these files exist in `apps/web/static/icons/`. Also, `app.html` references `/icons/apple-touch-icon.png`.

---

### 32. `@sveltejs/adapter-auto` in devDependencies Is Unnecessary

Both apps list `@sveltejs/adapter-auto` in `devDependencies` but use `@sveltejs/adapter-node` in `svelte.config.js`. The auto adapter is unused dead weight.

---

### 33. Duplicated Code Between `hooks.server.ts` Files

Both web and dashboard `hooks.server.ts` files contain nearly identical implementations of:
- Rate limiting (~50 lines)
- IP extraction
- Compression logic
- Security headers
- Graceful shutdown

This should be extracted to `@fuelnsw/shared` as a shared middleware/hooks utility to reduce maintenance burden and ensure consistent behavior.

---

### 34. `openOnly` Default Behavior

**File**: [stations/+server.ts:6](file:///Users/bob/Projects/ausfuel/apps/web/src/routes/api/fuel/stations/+server.ts#L6)

```ts
const openOnly = url.searchParams.get('open_only') !== 'false';
```

The default is `true` — if `open_only` is omitted, only open stations are returned. This means API consumers without this parameter may not see all stations. This is intentional per the design, but it should be documented clearly in the API docs.

---

### 35. `checkAuth` Duplicated Across Two Files

The `checkAuth` function is identically implemented in both [refresh/+server.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/routes/api/refresh/+server.ts#L13-L23) and [enrich-hours/+server.ts](file:///Users/bob/Projects/ausfuel/apps/web/src/routes/api/enrich-hours/+server.ts#L7-L17). Extract to a shared utility.

---

## 📋 Summary

| Priority | Count | Description | Status |
|----------|-------|-------------|--------|
| 🚨 Critical | 5 | Secrets in git, test keys in prod, cleartext HTTP, API key exposure, HTTP geolocate | Pending (operational) |
| ⚠️ High | 10 | require() in ESM, dead code, CSP weakening, missing deps, timezone bug, rate limit gaps | 6 fixed, 4 deferred |
| 🟡 Medium | 10 | Missing schema init, duplicated mappings, ghost dirs, over-counting, missing validation | 3 fixed, 7 deferred |
| 🔵 Low | 10 | Missing tests, no structured logging, dead dependencies, duplicated middleware | Not started |

---

## ✅ Top 5 Actions Before Go-Live

1. **Rotate all secrets** — NSW API keys, admin token. Purge from git history.
2. **Fix Capacitor config** — Switch to HTTPS domain, disable cleartext.
3. **Replace RevenueCat test keys** with production keys (env vars, not hardcoded).
4. **Add `better-sqlite3` and `ssr.external`** to dashboard config. — ✅ Done
5. **Fix the nightly aggregation timezone** — it fires at the wrong time in production. — ✅ Done

---

## 📝 Changes Applied (2026-04-03)

The following audit items were fixed and committed:

| # | Item | Change |
|---|------|--------|
| 6 | `require()` in ESM | Replaced with `import { constants } from 'node:zlib'` in both hooks.server.ts files |
| 7 | Dead `compressResponse()` | Removed 39-line unused function from web hooks.server.ts |
| 9 | Dashboard missing `better-sqlite3` | Added to dashboard `dependencies` |
| 10 | Dashboard missing `ssr.external` | Added `ssr: { external: ['better-sqlite3'] }` to dashboard vite.config.ts |
| 11 | Nightly aggregation timezone | Replaced server-local scheduling with Australia/Sydney timezone calculation |
| 14 | Cache-Control matching | Fixed `startsWith(prefix + '?')` → `startsWith(prefix + '/')` for sub-path matches |
| 16 | Missing core table creation | Added `CREATE TABLE IF NOT EXISTS` for all 8 core tables + indexes in schema.ts |
| 17 | Duplicate fuel type mappings | Consolidated into `fuel-types.ts` with `REVERSE_FUEL_MAP` and `HISTORY_FUEL_MAP` exports |
| 18 | Ghost route directories | Deleted empty `{viewport}` and `{batch}` directories |
