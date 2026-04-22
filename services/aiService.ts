const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function buildSystemPrompt(
  articleTitle: string,
  articleSource: string,
  articleContent: string,
  tutorName: string,
): string {
  return `You are ${tutorName}, a friendly English conversation tutor helping a language learner practice their English.

You are discussing the following news article with the user:
Title: "${articleTitle}"
Source: ${articleSource}
Content: ${articleContent}

Your goals:
- Help the user practice speaking and writing English naturally
- Discuss the article in an engaging, conversational way
- Ask follow-up questions to keep the conversation going
- Gently correct grammar mistakes by naturally using the correct form in your reply (do not explicitly call out errors)
- Keep your responses concise — 2 to 3 sentences max so it feels like a real conversation
- Be warm, encouraging and patient`;
}

export async function getAIResponse(
  messages: ChatMessage[],
  articleTitle: string,
  articleSource: string,
  articleContent: string,
  tutorName: string,
): Promise<string> {
    console.log('API KEY:', OPENAI_API_KEY ? 'found' : 'MISSING');
    
  if (!OPENAI_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY');
  }

  const systemMessage: ChatMessage = {
    role: 'system',
    content: buildSystemPrompt(articleTitle, articleSource, articleContent, tutorName),
  };

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [systemMessage, ...messages],
        max_tokens: 150,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? `HTTP error ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() ?? 'Sorry, I could not respond.';
  } catch (e) {
    console.log('FETCH ERROR:', e);
    if (e instanceof TypeError && e.message.includes('Network request failed')) {
      throw new Error('Network error — make sure your phone and computer are on the same WiFi network.');
    }
    throw e;
  }
}