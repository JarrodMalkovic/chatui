import md5 from 'md5';

export function getGravatarUrl(email: string) {
	const trimmedEmail = email.trim().toLowerCase();
	const hash = md5(trimmedEmail);

	return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`; // 'identicon' is the default, 's' is the size parameter
}
