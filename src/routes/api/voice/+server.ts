import { json } from '@sveltejs/kit';
import { ELEVENLABS_API_KEY } from '$env/static/private';

export async function POST({ request }) {
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

	if (response.ok) {
		const audioStream = await response.blob();
		return new Response(audioStream, {
			headers: {
				'Content-Type': 'audio/mpeg'
			}
		});
	} else {
		return json({ error: 'Failed to generate speech' }, { status: response.status });
	}
}
