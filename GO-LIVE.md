# Go-Live Checklist

Steps 10-14 are implemented. These remaining tasks require manual setup before going live.

## High Priority

### Replace AdMob Placeholder IDs

File: `apps/web/src/lib/ads.ts`

Replace all `ca-app-pub-XXXX/XXXX` with real AdMob ad unit IDs:
- `initAds()` — banner ad ID (line ~22)
- `maybeShowInterstitial()` — interstitial ad ID (line ~77)

Use platform-specific IDs: one for iOS, one for Android.

### Replace RevenueCat API Keys

File: `apps/web/src/lib/subscription.ts`

Replace placeholder keys in `configureRevenueCat()`:
- `appl_XYZ` → RevenueCat Apple API key
- `goog_XYZ` → RevenueCat Google API key

### Generate PWA Icons

Source SVG: `apps/web/static/icons/icon.svg`

Generate PNGs at these sizes and place in `apps/web/static/icons/`:
- `icon-192x192.png`
- `icon-512x512.png`
- `maskable-icon-192x192.png` (40% safe area padding)
- `maskable-icon-512x512.png` (40% safe area padding)
- `apple-touch-icon.png` (180x180)

Can use an online tool like realfavicongenerator.net or `npx pwa-asset-generator`.

## Medium Priority

### Add Native Platforms

Requires Xcode (macOS) and Android Studio.

```bash
npx cap add ios
npx cap add android
```

Then sync after builds:

```bash
npm run build:web && npx cap sync
```

### Set Up RevenueCat Dashboard

1. Create project at revenuecat.com
2. Connect Apple App Store Connect and Google Play Console
3. Create entitlement: `remove_ads`
4. Create offering with monthly package at $1.00
5. Configure server-side webhooks for receipt validation

The entitlement ID `remove_ads` must match `ENTITLEMENT_ID` in `lib/subscription.ts`.

### Add Web AdSense

Add to `apps/web/src/app.html` or `apps/web/src/routes/+layout.svelte`:

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>
```

Replace `ca-pub-XXXX` with your AdSense publisher ID. The CSP headers already allow this domain.

## Low Priority

### Test CSP Before Deploy

Temporarily use `Content-Security-Policy-Report-Only` instead of `Content-Security-Policy` in `hooks.server.ts` to verify nothing breaks without actually blocking requests.

### Web Subscription (Stripe)

RevenueCat only handles native subscriptions. For web ad removal, options:
- Stripe Checkout with server endpoints (`POST /api/subscription/create`, `POST /api/subscription/webhook`)
- Skip web subscriptions entirely and only offer ad removal in native apps

### Haptic Feedback (Native)

Plan mentions adding haptics to `StationPanel.svelte` and `QuickFuelSheet.svelte` via `@capacitor/haptics`. The plugin is installed but not yet wired into components.
