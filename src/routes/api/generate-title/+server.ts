import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse, Message, strea } from 'ai';
import { OPENAI_API_KEY } from '$env/static/private';

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY
});

export const config = {
	runtime: 'edge'
};

export async function POST({ request }) {
	const { initialMessage } = await request.json();

	console;
	const prompt = `
        You are an expert wordsmith, whose goal is to take in an initial message,
        and shorten it into a 1-4 word summary.
    `;

	const result = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'system',
				content: prompt
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
