import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse, Message, strea } from 'ai';
import {
	OPENAI_API_KEY,
	TOGETHERAI_API_KEY,
	UPSTASH_REDIS_REST_TOKEN,
	UPSTASH_REDIS_REST_URL
} from '$env/static/private';
import { supabase, supabaseUrl } from '$lib/supabaseClient';
import { decode } from 'base64-arraybuffer';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const togetherAiClient = new OpenAI({
	apiKey: TOGETHERAI_API_KEY,
	baseURL: 'https://api.together.xyz/v1'
});

export const config = {
	runtime: 'edge'
};

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

	const { prompt } = await request.json();

	const result = await togetherAiClient.completions.create({
		model: 'stabilityai/stable-diffusion-xl-base-1.0',
		prompt
	});
	const fileName = `${Math.random().toString(36)}.png`;
	const { data } = await supabase.storage
		.from('uploads')
		.upload(fileName, decode(result.choices[0].image_base64), {
			contentType: 'image/png'
		});

	const generatedImage = `${supabaseUrl}/storage/v1/object/public/${data?.fullPath}`;

	return new Response(
		JSON.stringify({
			image: generatedImage
		}),
		{
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		}
	);
}
