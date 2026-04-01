# Go-Live Checklist

Steps 10-14 are implemented. These remaining tasks require manual setup before going live.

## Completed

- [x] **PWA Icons** — Generated from `icon.svg`: `icon-192x192.png`, `icon-512x512.png`, `maskable-icon-192x192.png`, `maskable-icon-512x512.png`, `apple-touch-icon.png`
- [x] **AdMob IDs** — Replaced placeholders with real interstitial ad IDs in `apps/web/src/lib/ads.ts` (iOS: `...1412128551`, Android: `...5714335648`). Banner ad IDs (iOS: `...2976491668`, Android: `...5301274237`) to be configured in native projects when banners are added.
- [x] **RevenueCat Keys** — Using test key in `apps/web/src/lib/subscription.ts`. Replace with production `appl_` and `goog_` keys when apps are published to stores.
- [x] **Web AdSense** — Added script tag to `apps/web/src/app.html` with publisher ID `ca-pub-8792853309353392`.
- [x] **CSP Report-Only** — Switched to `Content-Security-Policy-Report-Only` in `hooks.server.ts`. Switch back to `Content-Security-Policy` after verifying no violations in production.
- [x] **Native Platforms** — Added `ios/` and `android/` via `npx cap add`. All 8 Capacitor plugins detected.
- [x] **Haptic Feedback** — Wired `@capacitor/haptics` into `StationPanel.svelte` and `QuickFuelSheet.svelte`.
- [x] **Web Subscriptions** — Skipped. Ad removal only available via native app subscriptions.

## Remaining Manual Steps

### Switch CSP Back to Enforcing

After verifying no violations in production logs, change `Content-Security-Policy-Report-Only` back to `Content-Security-Policy` in `apps/web/src/hooks.server.ts`.

### Set Up RevenueCat Dashboard

1. Create project at revenuecat.com
2. Connect Apple App Store Connect and Google Play Console
3. Create entitlement: `remove_ads`
4. Create offering with monthly package at $1.00
5. Configure server-side webhooks for receipt validation
6. Replace test API key in `apps/web/src/lib/subscription.ts` with production keys

The entitlement ID `remove_ads` must match `ENTITLEMENT_ID` in `lib/subscription.ts`.

### Replace RevenueCat Production Keys

When apps are published, replace `test_MxcUIPbEYHMkaNWSwvVwmEMIqec` in `apps/web/src/lib/subscription.ts` with:
- `appl_...` for iOS
- `goog_...` for Android

### Configure Native Banner Ads

Banner ad IDs need to be used when implementing banner ad components in the native iOS/Android projects:
- iOS banner: `ca-app-pub-8792853309353392/2976491668`
- Android banner: `ca-app-pub-8792853309353392/5301274237`

### Build & Sync Native Apps

```bash
npm run build:web && npx cap sync
```

Then open in Xcode / Android Studio to configure signing and build for release.
