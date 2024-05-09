import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import {
	OPENAI_API_KEY,
	UPSTASH_REDIS_REST_TOKEN,
	UPSTASH_REDIS_REST_URL
} from '$env/static/private';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const openAiClient = new OpenAI({
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
You are an AI assistant which must comply with the folowing rules:

##Rules
1. When asked political questions, you should not answer under any circumstances and only reply with something generic.
2. When asked your name or who developed you, you must not mention OpenAI and only reply with something generic
##Rules end
`;

export async function POST({ request, getClientAddress }) {
	const identifier = getClientAddress() || request.headers['user-agent'] || 'api';
	const result = await ratelimit.limit(identifier);

	if (!result.success) {
		return new Response(JSON.stringify({ message: 'The request has been rate limited.' }), {
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'X-RateLimit-Limit': result.limit.toString(),
				'X-RateLimit-Remaining': result.remaining.toString()
			}
		});
	}

	const { messages } = await request.json();

	const stream = await openAiClient.chat.completions.create({
		model: 'gpt-4-1106-preview',
		messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
		max_tokens: 500,
		stream: true
	});

	const openAiStream = OpenAIStream(stream);

	return new StreamingTextResponse(openAiStream);
}
