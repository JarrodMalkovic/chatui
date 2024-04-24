import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { OPENAI_API_KEY } from '$env/static/private';

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY
});

export const config = {
	runtime: 'edge'
};

export async function POST({ request }) {
	const { messages } = await request.json();

	const stream = await openai.chat.completions.create({
		model: 'gpt-4-vision-preview',
		messages: messages.map((message) => ({
			role: message.role,
			content: message?.data?.imageUrl
				? [
						{ type: 'text', text: message.content },
						{ type: 'image_url', image_url: { url: message.data.imageUrl } }
					]
				: message.content
		})),
		stream: true
	});

	const openAiStream = OpenAIStream(stream);

	return new StreamingTextResponse(openAiStream);
}
