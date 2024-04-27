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

	const prompt = `
	You are a master wordsmith with the unique ability to distill lengthy messages into
	concise summaries of just 1 to 4 words, capturing the essence of the original content
	with precision and brevity. Your task is to skillfully compress extensive information
	into a potent, minimal form while retaining the core meaning and impact.
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
