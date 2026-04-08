<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
</script>

<svelte:head>
	<title>Privacy Policy — Fuel Scout NSW</title>
	<meta name="description" content="Privacy policy for Fuel Scout NSW." />
	<link rel="canonical" href="https://fuelscout.com.au/privacy" />
</svelte:head>

<div class="max-w-3xl mx-auto px-4 sm:px-6 py-8">
	<div class="flex items-center gap-2 mb-6">
		<div class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M3 22V6l4-2v18H3zm6 0V8l4 2v12H9zm6 0V4l4 4v14h-4z"/></svg>
		</div>
		<span class="font-bold text-lg text-gray-900">Fuel Scout NSW</span>
	</div>

	<h1 class="text-2xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
	<p class="text-sm text-gray-500 mb-8">Last updated: April 2026</p>

	<div class="prose prose-gray max-w-none space-y-6 text-sm text-gray-700">
		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">1. Overview</h2>
			<p>Fuel Scout NSW ("we", "us", "our") operates the mobile application and website at <a href="https://fuelscout.com.au" class="text-green-600 underline">fuelscout.com.au</a>. This policy explains what information we collect, how we use it, and your rights.</p>
		</section>

		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>

			<h3 class="font-medium text-gray-900 mb-1">2.1 Fuel Price Data</h3>
			<p>We fetch publicly available fuel price data from the NSW Government Fuel Check API. This data is not personal information.</p>

			<h3 class="font-medium text-gray-900 mt-3 mb-1">2.2 Location Data</h3>
			<p>When you use the "find nearest station" feature, we request access to your device location (via the browser Geolocation API or native Geolocation plugin). Your location is processed locally on your device and sent to our server only to find nearby stations. We do not store your location history.</p>

			<h3 class="font-medium text-gray-900 mt-3 mb-1">2.3 IP Address</h3>
			<p>We use your IP address for server-side geolocation (to suggest a default map position) via the ip-api.com service. We do not store IP addresses beyond the duration of the request.</p>

			<h3 class="font-medium text-gray-900 mt-3 mb-1">2.4 Local Storage</h3>
			<p>We store preferences on your device using localStorage, including your selected fuel type, map position, onboarding state, and discount selections. This data never leaves your device.</p>

			<h3 class="font-medium text-gray-900 mt-3 mb-1">2.5 Subscription Information</h3>
			<p>If you purchase the ad removal subscription, payment and subscription management is handled by RevenueCat via the Apple App Store or Google Play Store. We receive only a confirmation of your subscription status — we do not receive or store your payment details.</p>
		</section>

		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">3. Advertising</h2>
			<p>We use Google AdMob to display advertisements in the mobile app. AdMob may collect device identifiers and usage data to serve personalised ads. You can opt out of personalised advertising through your device settings:</p>
			<ul class="list-disc pl-5 mt-2 space-y-1">
				<li>iOS: Settings → Privacy & Security → Tracking</li>
				<li>Android: Settings → Google → Ads → Opt out of Ads Personalization</li>
			</ul>
			<p class="mt-2">On the website, we use Google AdSense for display advertising. Google may use cookies to serve ads. See <a href="https://policies.google.com/technologies/ads" class="text-green-600 underline" target="_blank" rel="noopener noreferrer">Google's advertising policies</a> for more information.</p>
		</section>

		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">4. Analytics</h2>
			<p>We use Google Analytics 4 to understand how users interact with our service. Analytics data is aggregated and anonymised. We do not track individual users across sessions. You can opt out by using browser extensions that block Google Analytics.</p>
		</section>

		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">5. Third-Party Services</h2>
			<p>Our app integrates with these third-party services:</p>
			<ul class="list-disc pl-5 mt-2 space-y-1">
				<li><strong>NSW Government Fuel Check API</strong> — fuel price data</li>
				<li><strong>Google AdMob / AdSense</strong> — advertising</li>
				<li><strong>RevenueCat</strong> — subscription management</li>
				<li><strong>Google Analytics</strong> — usage analytics</li>
				<li><strong>ip-api.com</strong> — IP-based geolocation</li>
			</ul>
			<p class="mt-2">Each service has its own privacy policy governing how they handle data.</p>
		</section>

		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">6. Data Retention</h2>
			<p>We do not maintain user accounts or profiles. Fuel price data is retained for historical analysis. Location data is not stored. Local storage preferences persist until you clear your browser/app data.</p>
		</section>

		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">7. Children's Privacy</h2>
			<p>Our service is not directed at children under 13. We do not knowingly collect personal information from children.</p>
		</section>

		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">8. Security</h2>
			<p>We use HTTPS for all connections. API endpoints are rate-limited. Admin operations require authentication tokens. However, no method of transmission over the internet is 100% secure.</p>
		</section>

		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">9. Your Rights</h2>
			<p>Depending on your jurisdiction, you may have the right to:</p>
			<ul class="list-disc pl-5 mt-2 space-y-1">
				<li>Access the personal data we hold about you</li>
				<li>Request deletion of your data</li>
				<li>Object to processing of your data</li>
				<li>Lodge a complaint with a supervisory authority</li>
			</ul>
			<p class="mt-2">Since we collect minimal personal data, most rights can be exercised by clearing your browser/app data.</p>
		</section>

		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">10. Changes to This Policy</h2>
			<p>We may update this policy from time to time. Changes will be posted on this page with an updated "Last updated" date.</p>
		</section>

		<section>
			<h2 class="text-lg font-semibold text-gray-900 mb-2">11. Contact</h2>
			<p>If you have questions about this privacy policy, please contact us at:</p>
			<p class="mt-1"><a href="mailto:support@fuelscout.com.au" class="text-green-600 underline">support@fuelscout.com.au</a></p>
		</section>
	</div>

	<div class="mt-10 pt-6 border-t border-gray-200">
		<a href="/" class="text-sm text-green-600 hover:underline">← Back to Fuel Scout NSW</a>
	</div>
</div>
