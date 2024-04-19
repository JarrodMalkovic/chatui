import { supabase } from '$lib/supabaseClient';

export async function handle({ event, resolve }) {
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

	const response = await resolve(event);
	return response;
}
