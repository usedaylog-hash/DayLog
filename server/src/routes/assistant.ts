import { Router } from 'express';

const router = Router();
const MODEL_NAME = 'gemini/flash';
const GEMINI_ENDPOINT = `https://gemini.googleapis.com/v1/models/${MODEL_NAME}:generateText`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function extractAssistantText(responseBody: any): string {
  const candidate = responseBody?.candidates?.[0];
  if (candidate) {
    if (typeof candidate.content === 'string') {
      return candidate.content;
    }
    if (Array.isArray(candidate.content)) {
      return candidate.content.map((block: any) => block.text ?? '').join('');
    }
  }

  if (typeof responseBody?.output === 'string') {
    return responseBody.output;
  }

  if (Array.isArray(responseBody?.output) && responseBody.output.length > 0) {
    const first = responseBody.output[0];
    if (typeof first === 'string') {
      return first;
    }
    if (typeof first?.content === 'string') {
      return first.content;
    }
  }

  return '';
}

router.post('/chat', async (req, res) => {
  const { messages } = req.body as { messages: ChatMessage[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages are required.' });
    return;
  }

  const validated = messages.every((message) =>
    message && typeof message === 'object' &&
    ['system', 'user', 'assistant'].includes(message.role) &&
    typeof message.content === 'string' &&
    message.content.trim().length > 0
  );

  if (!validated) {
    res.status(400).json({ error: 'All messages must include a valid role and non-empty content.' });
    return;
  }

  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    res.status(500).json({ error: 'Missing GOOGLE_API_KEY. Set this secret to enable Gemini Flash chat.' });
    return;
  }

  const promptMessages = messages.map((message) => ({
    role: message.role,
    content: [{ type: 'text', text: message.content }],
  }));

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: { messages: promptMessages },
        temperature: 0.2,
        maxOutputTokens: 512,
        candidateCount: 1,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.error('Gemini Flash error:', response.status, bodyText);
      res.status(500).json({ error: 'AI service returned an error.' });
      return;
    }

    const data = await response.json();
    const text = extractAssistantText(data);

    if (!text) {
      console.error('Gemini Flash response missing text:', JSON.stringify(data));
      res.status(500).json({ error: 'AI response did not include a valid assistant message.' });
      return;
    }

    res.json({ text });
  } catch (error) {
    console.error('Failed to call Gemini Flash:', error);
    res.status(500).json({ error: 'Could not reach the AI service.' });
  }
});

export { router as assistantRouter };
