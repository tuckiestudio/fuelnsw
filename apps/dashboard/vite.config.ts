import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		external: ['better-sqlite3']
	},
	resolve: {
		alias: {
			'@fuelnsw/shared': resolve(import.meta.dirname, '../../packages/shared/src')
		}
	}
});
