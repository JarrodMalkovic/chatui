export async function load({ params }) {
	const { preferredLocale } = params;

	return {
		props: {
			preferredLocale: preferredLocale
		}
	};
}
