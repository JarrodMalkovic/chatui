import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse, type Message } from 'ai';
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
		model: 'gpt-3.5-turbo',
		messages,
		stream: true
	});

	const openAiStream = OpenAIStream(stream);

	return new StreamingTextResponse(openAiStream);
}
