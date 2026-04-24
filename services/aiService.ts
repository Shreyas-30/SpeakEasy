const BACKEND_URL = process.env.EXPO_PUBLIC_TTS_PROXY_URL ?? '';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function getAIResponse(
  messages: ChatMessage[],
  articleTitle: string,
  articleSource: string,
  articleContent: string,
  tutorName: string,
): Promise<string> {
  if (!BACKEND_URL) {
    throw new Error('Missing EXPO_PUBLIC_TTS_PROXY_URL');
  }

  try {
    const response = await fetch(new URL('/api/chat', BACKEND_URL).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, articleTitle, articleSource, articleContent, tutorName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error ?? `HTTP error ${response.status}`);
    }

    const data = await response.json();
    return data.reply ?? 'Sorry, I could not respond.';
  } catch (e) {
    if (e instanceof TypeError && e.message.includes('Network request failed')) {
      throw new Error('Network error — make sure your phone and computer are on the same WiFi network.');
    }
    throw e;
  }
}
