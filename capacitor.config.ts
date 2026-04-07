import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.fuelnsw.app',
	appName: 'Fuel Scout NSW',
	webDir: 'apps/web/build',
	server: {
		url: 'https://fuelscout.com.au'
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
