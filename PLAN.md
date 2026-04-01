# Mobile & Monetization — Remaining Steps (10-14)

This document covers the remaining implementation steps for mobile-first experience, PWA, native app, and monetization. Steps 1-9 are complete.

---

## Step 10: CSP Header Update

**Status:** Complete
**Files to modify:** `apps/web/src/hooks.server.ts`

### What needs to happen

The current CSP header (line 65 of `hooks.server.ts`) is:

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self' https://overpass-api.de
```

This must be relaxed to support:

1. **Ad scripts** — Google AdSense (`pagead2.googlesyndication.com`) for web and Google AdMob SDK for native
2. **Navigation URLs** — `maps://maps.apple.com` (iOS), `https://www.google.com/maps/dir/` (Android/web)
3. **PWA service worker** — `'self'` scope for `sw.js` + `manifest.json`
4. **IP geolocation fallback** — `https://ipapi.co`
5. **Leaflet tiles** — `https://*.tile.openstreetmap.org` (already allowed for img-src)
6. **Google Fonts** (if ads load them)
7. **Frame-src** for ads iframes

### Target CSP

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://www.googletagmanager.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https://*.tile.openstreetmap.org https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com;
connect-src 'self' https://ipapi.co https://overpass-api.de https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net;
font-src 'self' https://fonts.gstatic.com;
frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://pagead2.googlesyndication.com;
navigate-to 'self' maps:// https://www.google.com/maps/;
worker-src 'self';
manifest-src 'self';
```

### Notes
- In Capacitor context, CSP is less relevant (native webview), but it must work for the web version
- `X-Frame-Options: DENY` (line 62) will also need to become `SAMEORIGIN` or be removed to allow ad iframes
- Test with `Content-Security-Policy-Report-Only` first to avoid breaking anything

---

## Step 11: PWA Manifest + Service Worker

**Status:** Complete
**Packages to add:** `@vite-pwa/sveltekit`
**Files to modify:** `apps/web/vite.config.ts`, `apps/web/src/app.html`, `apps/web/static/` (icons)
**New files:** PWA icons (192x192, 512x512, maskable variants)

### What needs to happen

1. **Install `@vite-pwa/sveltekit`** in `apps/web/`

```bash
cd apps/web && npm install -D @vite-pwa/sveltekit
```

2. **Configure in `vite.config.ts`** — Add `SvelteKitPWA()` plugin with:
   - `registerType: 'autoUpdate'` — auto-update service worker on new deployments
   - `manifest` object with: name "FuelNSW", short_name "FuelNSW", theme_color (green-600 #16a34a), background_color (#ffffff), display "standalone", scope "/", start_url "/"
   - `workbox.navigateFallback` set to the SvelteKit index HTML
   - `workbox.runtimeCaching` for API endpoints and tile images

3. **Add PWA meta tags to `app.html`**:
   - `<meta name="theme-color" content="#16a34a">`
   - `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`
   - `<meta name="apple-mobile-web-app-capable" content="yes">`
   - `<meta name="apple-mobile-web-app-status-bar-style" content="default">`

4. **Create icon files** in `apps/web/static/icons/`:
   - `icon-192x192.png`, `icon-512x512.png` (generated from a FuelNSW logo)
   - `apple-touch-icon.png` (180x180)
   - `maskable-icon-192x192.png`, `maskable-icon-512x512.png`

5. **Service worker scope** — Must cover `/` so all routes work offline. The `@vite-pwa/sveltekit` plugin handles SW registration automatically.

### Vite config addition pattern

```ts
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss(),
    SvelteKitPWA({
      srcDir: './src',
      mode: 'production', // only generates SW in build, not dev
      registerType: 'autoUpdate',
      manifest: {
        name: 'FuelNSW — Live NSW Fuel Prices',
        short_name: 'FuelNSW',
        description: 'Real-time NSW fuel prices on an interactive map',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org/,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: /\/api\/fuel\/stations\/viewport/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-viewport', expiration: { maxEntries: 50, maxAgeSeconds: 60 } }
          }
        ]
      }
    })
  ]
});
```

### Notes
- This is the web-only PWA. The Capacitor app (step 12) wraps the hosted URL, so it doesn't need the SW.
- The SW will cache tile images and API responses for basic offline support.
- `@vite-pwa/sveltekit` auto-injects the SW registration script — no manual `<script>` needed.

---

## Step 12: Capacitor Setup + Native Plugins

**Status:** Complete
**Packages to add:** `@capacitor/core`, `@capacitor/cli`, `@capacitor/node-utility`, plus plugins
**Architecture:** Option A — wrap the hosted `adapter-node` server URL (no `adapter-static`)

### What needs to happen

1. **Initialize Capacitor in the monorepo root** (or in `apps/web/`):

```bash
npm install @capacitor/core
npx cap init FuelNSW com.fuelnsw.app --web-dir=apps/web/build
```

This creates `capacitor.config.ts` at root with:
```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fuelnsw.app',
  appName: 'FuelNSW',
  webDir: 'apps/web/build',
  server: {
    url: 'https://fuelnsw.com.au',  // production URL — wraps the hosted adapter-node server
    cleartext: true
  }
};
export default config;
```

2. **Add native platforms**:
```bash
npx cap add ios
npx cap add android
```

3. **Install native plugins** for App Store compliance and UX:

| Plugin | Purpose | Install |
|---|---|---|
| `@capacitor/splash-screen` | Show splash while webview loads | `npm install @capacitor/splash-screen` |
| `@capacitor/haptics` | Haptic feedback on navigation tap | `npm install @capacitor/haptics` |
| `@capacitor/status-bar` | Match status bar to green theme | `npm install @capacitor/status-bar` |
| `@capacitor/app` | Handle back button, deep links | `npm install @capacitor/app` |
| `@capacitor/browser` | Open navigation URLs natively | `npm install @capacitor/browser` |
| `@capacitor/geolocation` | Native GPS (more reliable than web API) | `npm install @capacitor/geolocation` |

4. **Update `lib/navigation.ts`** to use `@capacitor/browser` in native context:

```ts
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export async function navigateTo(lat: number, lng: number, name?: string): Promise<void> {
  const isIOS = Capacitor.getPlatform() === 'ios';
  const isNative = Capacitor.isNativePlatform();

  let url: string;
  if (isIOS) {
    const params = new URLSearchParams({ daddr: `${lat},${lng}`, dirflg: 'd', t: 'm' });
    if (name) params.set('q', name);
    url = `maps://maps.apple.com/?${params}`;
  } else {
    const params = new URLSearchParams({ api: '1', destination: `${lat},${lng}`, travelmode: 'driving' });
    url = `https://www.google.com/maps/dir/?${params}`;
  }

  if (isNative) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank');
  }
}
```

5. **Splash screen setup** — Configure in `capacitor.config.ts`:
```ts
plugins: {
  SplashScreen: {
    launchAutoHide: false,
    backgroundColor: '#16a34a',
    androidSplashResourceName: 'splash',
    showSpinner: true,
    spinnerColor: '#ffffff',
    splashFullScreen: true,
    splashImmersive: true
  },
  StatusBar: {
    style: 'LIGHT',
    backgroundColor: '#16a34a'
  }
}
```

6. **Haptic feedback** — Call `Haptics.impact({ style: ImpactStyle.Light })` on station tap, `ImpactStyle.Medium` on navigation launch. Add calls in `StationPanel.svelte` and `QuickFuelSheet.svelte`.

### Notes
- **Option A** means the native app is just a webview pointing at the production URL. No build step for the native app — just `npm run build:web` then `npx cap sync`.
- The `server.url` in capacitor.config means NO local files are served — it loads from the hosted server. This means no `adapter-static` needed.
- For App Store review: splash screen, haptics, and status bar customization help pass the "not just a website wrapper" test.
- Xcode and Android Studio are required for building/signing.
- The `apps/web/build` directory is only used for `cap sync` asset copying when `server.url` is NOT set. With `server.url`, the webDir is mostly irrelevant but must exist.

---

## Step 13: AdMob Integration

**Status:** Complete
**Packages to add:** `@capacitor-community/admob`
**Web equivalent:** Google AdSense script tags

### What needs to happen

1. **Install AdMob plugin**:
```bash
npm install @capacitor-community/admob
```

2. **Create ad management module** at `apps/web/src/lib/ads.ts`:

```ts
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdSize, BannerAdPosition, InterstitialAd } from '@capacitor-community/admob';

let interstitialCount = 0;

export async function initAds(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await AdMob.initialize({ testingDevices: ['YOUR_DEVICE_ID'] });

  await AdMob.prepareBanner({
    adId: Platform.select({ ios: 'ca-app-pub-XXXX/XXXX', android: 'ca-app-pub-XXXX/XXXX' }),
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    adPosition: BannerAdPosition.BOTTOM_CENTER,
    npa: false
  });
}

export async function showBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await AdMob.showBanner();
}

export async function hideBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await AdMob.hideBanner();
}

export async function maybeShowInterstitial(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  interstitialCount++;
  if (interstitialCount % 3 !== 0) return false;

  await AdMob.prepareInterstitial({
    adId: Platform.select({ ios: 'ca-app-pub-XXXX/XXXX', android: 'ca-app-pub-XXXX/XXXX' }),
  });
  await AdMob.showInterstitial();
  return true;
}
```

3. **Banner ad placement** — Show at bottom when no panel/sheet is open. Hide when StationPanel or QuickFuelSheet is visible (they cover the bottom).

   In `+page.svelte`:
   - Call `showBanner()` on mount
   - Call `hideBanner()` when station panel or quick fuel sheet opens
   - Call `showBanner()` when they close

4. **Interstitial ads** — Show every 3rd navigation action. In `navigateTo()` or in the QuickFuelSheet's `handleNavigate`:

```ts
import { maybeShowInterstitial } from '$lib/ads';

async function handleNavigate(station: NearestStation) {
  await maybeShowInterstitial();
  navigateTo(station.latitude, station.longitude, station.name);
}
```

5. **Web version (AdSense)** — Add AdSense script to `app.html` or `+layout.svelte`:
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>
```
Place an `<ins class="adsbygoogle">` banner div at the bottom of the layout, same show/hide logic based on panel state.

6. **Ad-free subscription check** — Before showing any ad, check `getRemoveAds()` from `lib/preferences.ts`. If true, skip all ad calls.

### Notes
- AdMob ad IDs will be different for iOS vs Android vs test mode
- Use `Capacitor.getPlatform()` to select the right ad ID
- For testing, use Google's test ad unit IDs before going live
- AdSense for web needs the CSP update (step 10) to allow the script domains
- Banner ads should be hidden during station panel / quick fuel sheet to avoid accidental clicks
- Interstitial frequency cap (every 3 navigations) is important for UX and App Store compliance

---

## Step 14: Subscription (RevenueCat + Stripe)

**Status:** Complete
**Packages to add:** `@revenuecat/purchases-capacitor` (native), `stripe` (web backend)
**Pricing:** $1/month only, no one-time purchase

### What needs to happen

1. **RevenueCat setup** (unified Apple/Google subscription management):

```bash
npm install @revenuecat/purchases-capacitor
```

```ts
import { Purchases } from '@revenuecat/purchases-capacitor';

await Purchases.configure({
  apiKey: Capacitor.getPlatform() === 'ios'
    ? 'appl_XYZ'   // RevenueCat Apple API key
    : 'goog_XYZ',  // RevenueCat Google API key
  appUserID: undefined // anonymous user to start
});
```

2. **Subscription flow** — Create a settings/paywall component:

```ts
// lib/subscription.ts
import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

const ENTITLEMENT_ID = 'remove_ads';

export async function isSubscribed(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return checkWebSubscription();
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

export async function purchaseSubscription(): Promise<boolean> {
  const offerings = await Purchases.getOfferings();
  const package_ = offerings.current?.monthly;
  if (!package_) return false;
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: package_ });
  return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

export async function restorePurchases(): Promise<boolean> {
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
}
```

3. **Paywall UI** — Create `components/PaywallModal.svelte`:
   - Title: "Remove Ads"
   - Price: "$1.00/month"
   - Subscribe button → calls `purchaseSubscription()`
   - Restore purchases link → calls `restorePurchases()`
   - On success: set `setRemoveAds(true)` in preferences, close modal

4. **Web subscription (Stripe)** — Since RevenueCat doesn't handle web:
   - Create a Stripe Checkout session on the server side (new endpoint: `POST /api/subscription/create`)
   - Redirect to Stripe Checkout
   - Webhook endpoint (`POST /api/subscription/webhook`) to handle `checkout.session.completed`
   - Store subscription status in a simple `subscribers` table or use Stripe Customer Portal
   - Alternatively, skip web subscriptions and only offer ad removal in the native apps

5. **Integration points**:
   - Check `isSubscribed()` on app load, set `removeAds` preference
   - Show "Remove Ads" in settings/nav menu when not subscribed
   - All ad display functions (step 13) check `getRemoveAds()` before showing ads
   - Paywall shown as modal overlay triggered by "Remove Ads" button

6. **RevenueCat dashboard setup** (manual):
   - Create project at revenuecat.com
   - Connect Apple App Store Connect and Google Play Console
   - Create entitlement "remove_ads"
   - Create offering with monthly package at $1.00
   - Configure webhooks for server-side receipt validation

### Notes
- RevenueCat handles all the complexity of Apple/Google subscription APIs, receipt validation, grace periods, billing retries
- The `$1/month` pricing needs Apple/Google approval (minimum is $0.99 which is fine)
- Apple requires a "Restore Purchases" button — RevenueCat makes this one call
- For web, Stripe Checkout is the simplest approach — no need for a full billing portal
- Consider whether web ad removal is worth the Stripe integration complexity vs just offering it in the native app
- `ENTITLEMENT_ID` must match what's configured in RevenueCat dashboard

---

## Dependencies Between Steps

```
Step 10 (CSP) → Step 11 (PWA) — PWA SW needs correct CSP
Step 10 (CSP) → Step 13 (Ads) — Ad scripts need CSP allowance
Step 11 (PWA) → Step 12 (Capacitor) — PWA provides offline for web; Capacitor provides native
Step 12 (Capacitor) → Step 13 (AdMob) — AdMob requires native Capacitor plugins
Step 12 (Capacitor) → Step 14 (RevenueCat) — RevenueCat requires native platform
Step 13 (Ads) → Step 14 (Subscription) — Subscription removes ads
```

Recommended order: **10 → 11 → 12 → 13 → 14**

---

## Key Files Reference

| File | Role |
|---|---|
| `apps/web/src/hooks.server.ts` | CSP header, rate limiting, compression, scheduler |
| `apps/web/src/lib/navigation.ts` | Platform-aware navigation (Apple Maps vs Google Maps) |
| `apps/web/src/lib/preferences.ts` | localStorage wrapper (fuelType, removeAds, onboarded, lastLat/Lng) |
| `apps/web/src/routes/+page.svelte` | Main map page with all integrations |
| `apps/web/src/components/map/QuickFuelSheet.svelte` | Quick Fuel results with navigate buttons |
| `apps/web/src/components/map/StationPanel.svelte` | Station detail panel (draggable bottom sheet on mobile) |
| `apps/web/package.json` | Web app dependencies (no PWA/Capacitor packages yet) |
| `apps/web/vite.config.ts` | Vite config with Tailwind + shared alias |
| `apps/web/src/app.html` | HTML shell (needs PWA meta tags) |
| `apps/web/svelte.config.js` | adapter-node, runes mode, $components alias |

## Environment Variables Needed

| Variable | Where | Description |
|---|---|---|
| `ADMOB_IOS_ID` | native | AdMob iOS ad unit ID |
| `ADMOB_ANDROID_ID` | native | AdMob Android ad unit ID |
| `REVENUECAT_APPLE_KEY` | native | RevenueCat Apple API key |
| `REVENUECAT_GOOGLE_KEY` | native | RevenueCat Google API key |
| `STRIPE_SECRET_KEY` | server | Stripe secret key for web subscriptions |
| `STRIPE_WEBHOOK_SECRET` | server | Stripe webhook signing secret |
