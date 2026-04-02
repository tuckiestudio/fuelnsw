import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			srcDir: './src',
			mode: 'production',
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
	],
	ssr: {
		external: ['better-sqlite3']
	},
	resolve: {
		alias: {
			'@fuelnsw/shared': resolve(import.meta.dirname, '../../packages/shared/src')
		}
	}
});
