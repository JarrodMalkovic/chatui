import { writable } from 'svelte/store';
import { supabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';
import { getGravatarUrl } from './gravatar';

export const user = writable<User | null>(null);

interface User {
	id: string;
	email: string;
	username: string;
	profilePicture: string;
}

function normalizeUserData(user): User {
	let normalizedData = {
		...user.user_metadata,
		...user.identities?.[0]?.identity_data
	};

	console.log({ normalizedData, user });
	if (normalizedData.avatar_url) {
		normalizedData.profilePicture = normalizedData.avatar_url;
	} else if (!normalizedData.profilePicture) {
		normalizedData.profilePicture = getGravatarUrl(normalizedData.email);
	}

	if (normalizedData.preferred_username) {
		normalizedData.username = normalizedData.preferred_username;
	} else if (!normalizedData.username) {
		normalizedData.username = normalizedData.email.split('@')[0];
	}

	return {
		profilePicture: normalizedData.profilePicture,
		username: normalizedData.username,
		email: normalizedData.email,
		id: user.id
	};
}

supabase.auth.onAuthStateChange((_event, session) => {
	user.set(session ? normalizeUserData(session.user) : null);
});
