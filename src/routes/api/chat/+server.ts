import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import {
	OPENAI_API_KEY,
	TOGETHERAI_API_KEY,
	UPSTASH_REDIS_REST_TOKEN,
	UPSTASH_REDIS_REST_URL
} from '$env/static/private';
import type { ChatCompletionTool } from 'openai/resources/index.mjs';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const openAiClient = new OpenAI({
	apiKey: OPENAI_API_KEY
});
const togetherAiClient = new OpenAI({
	apiKey: TOGETHERAI_API_KEY,
	baseURL: 'https://api.together.xyz/v1'
});

export const config = {
	runtime: 'edge'
};

const tools: ChatCompletionTool[] = [
	{
		type: 'function',
		function: {
			name: 'generate_image',
			parameters: {
				type: 'object',
				properties: {
					description: {
						type: 'string',
						description:
							'A short description of the image to generate, best for logos and photographs'
					}
				}
			},

			description:
				'This function should be called rarely, and only when a user explicitly asks to generate an image, e.g a photograph or a logo'
		}
	}
];

function convertMessages(messages): any[] {
	const systemPrompt = `
		You have access to a generate_image function. This should only be used when a user specifically requests an image to be generated.
		If you are not sure if the user wants an image, you should NOT mention anything about your ability to generate an image, or ask them if they would want an image or text response, in these cases, you should only respond with text.
	`;

	return [
		{ role: 'system', content: systemPrompt },
		...messages.map((message) => ({
			role: message.role,
			content: message?.data?.imageUrl
				? [
						{ type: 'text', text: message.content },
						{ type: 'image_url', image_url: { url: message.data.imageUrl } }
					]
				: message.content,
			...(message?.tool_calls ? { tool_calls: message.tool_calls } : null),
			...(message?.tool_call_id ? { tool_call_id: message.tool_call_id } : null)
		}))
	];
}

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

	const { messages, selectedModelName } = await request.json();
	const client = selectedModelName?.includes('gpt') ? openAiClient : togetherAiClient;
	const stream = await client.chat.completions.create({
		model: selectedModelName,
		messages: convertMessages(messages),
		tools,
		tool_choice: 'auto',
		max_tokens: 500,
		stream: true
	});

	const openAiStream = OpenAIStream(stream, {
		experimental_onToolCall: async () => {},
		onFinal: (completion: string) => {
			console.log(completion);
		}
	});

	return new StreamingTextResponse(openAiStream);
}
