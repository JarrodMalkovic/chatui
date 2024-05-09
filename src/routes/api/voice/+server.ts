import { json } from '@sveltejs/kit';
import {
	ELEVENLABS_API_KEY,
	UPSTASH_REDIS_REST_TOKEN,
	UPSTASH_REDIS_REST_URL
} from '$env/static/private';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
	url: UPSTASH_REDIS_REST_URL,
	token: UPSTASH_REDIS_REST_TOKEN
});

const ratelimit = new Ratelimit({
	redis: redis,
	limiter: Ratelimit.slidingWindow(30, '1 h')
});

export async function POST({ request, getClientAddress }) {
	const identifier = getClientAddress() || request.headers['user-agent'] || 'api';
	const rateLimitResult = await ratelimit.limit(identifier);
	if (!rateLimitResult.success) {
		return new Response(JSON.stringify({ message: 'The request has been rate limited.' }), {
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'X-RateLimit-Limit': rateLimitResult.limit.toString(),
				'X-RateLimit-Remaining': rateLimitResult.remaining.toString()
			}
		});
	}

	const body = await request.json();
	const text = body.text;

	const response = await fetch(
		'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream',
		{
			method: 'POST',
			headers: {
				'xi-api-key': ELEVENLABS_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				text: text,
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.5
				}
			})
		}
	);

	if (!response.ok) {
		return json({ error: 'Failed to generate speech' }, { status: response.status });
	}

	const audioStream = await response.blob();
	return new Response(audioStream, {
		headers: {
			'Content-Type': 'audio/mpeg'
		}
	});
}
