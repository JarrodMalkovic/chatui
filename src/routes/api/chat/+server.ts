import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { OPENAI_API_KEY, TOGETHERAI_API_KEY } from '$env/static/private';

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

export async function POST({ request }) {
	const { messages, selectedModelName } = await request.json();

	const client = selectedModelName.includes('gpt') ? openAiClient : togetherAiClient;
	const stream = await client.chat.completions.create({
		model: selectedModelName,
		messages: messages.map((message) => ({
			role: message.role,
			content: message?.data?.imageUrl
				? [
						{ type: 'text', text: message.content },
						{ type: 'image_url', image_url: { url: message.data.imageUrl } }
					]
				: message.content
		})),
		max_tokens: 500,
		stream: true
	});

	const openAiStream = OpenAIStream(stream);

	return new StreamingTextResponse(openAiStream);
}
