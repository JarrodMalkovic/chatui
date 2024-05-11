import { supabase } from '$lib/supabaseClient';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { negotiateLanguages } from '@fluent/langneg';

const handleAuth = async ({ event, resolve }) => {
	const token = event.request.headers.get('authorization')?.split(' ')[1];
	if (token) {
		try {
			const { data, error } = await supabase.auth.getUser(token);

			if (!error && data) {
				event.locals.user = data;
			}
		} catch (err) {
			console.error('Invalid token', err);
		}
	}

	return resolve(event);
};

const handleCORS: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api')) {
		if (event.request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Headers': '*'
				}
			});
		}
	}

	const response = await resolve(event);

	if (event.url.pathname.startsWith('/api')) {
		response.headers.append('Access-Control-Allow-Origin', '*');
	}

	return response;
};

const handleInitialLanguage: Handle = async ({ event, resolve }) => {
	const supportedLocales = ['en', 'zh'];
	const acceptLangHeader = event.request.headers.get('Accept-Language') || 'en';
	const preferredLocale = negotiateLanguages(
		acceptLangHeader.split(',').map((lang) => lang.split(';')[0]),
		supportedLocales,
		{ defaultLocale: 'en' }
	)[0];

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', preferredLocale)
	});

	return response;
};

export const handle = sequence(handleAuth, handleCORS, handleInitialLanguage);
