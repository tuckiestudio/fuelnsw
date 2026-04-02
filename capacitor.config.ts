import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.fuelnsw.app',
	appName: 'FuelNSW',
	webDir: 'apps/web/build',
	server: {
		url: 'http://150.107.73.209',
		cleartext: true
	},
	plugins: {
		SplashScreen: {
			launchAutoHide: true,
			autoHide: true,
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
};
export default config;
