import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse, Message, strea } from 'ai';
import {
	OPENAI_API_KEY,
	UPSTASH_REDIS_REST_TOKEN,
	UPSTASH_REDIS_REST_URL
} from '$env/static/private';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY
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

const SYSTEM_PROMPT = `
You are a master wordsmith with the unique ability to distill lengthy messages into
concise summaries of just 1 to 4 words, capturing the essence of the original content
with precision and brevity. Your task is to skillfully compress extensive information
into a potent, minimal form while retaining the core meaning and impact.

Your response should be a single line, not using any dot points.

Your response should be in the same language as the user input.
`;

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

	const { initialMessage } = await request.json();

	const result = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'system',
				content: SYSTEM_PROMPT
			},
			{
				role: 'user',
				content: initialMessage
			}
		]
	});

	return new Response(
		JSON.stringify({
			title: result.choices[0].message.content.trim()
		}),
		{
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		}
	);
}
