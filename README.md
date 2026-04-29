# SpeakEasy

SpeakEasy is a mobile English-learning app built with Expo and React Native.

The app helps learners practice English through:
- personalized news-based reading
- tap-to-lookup vocabulary support
- translated vocabulary help based on native language
- article and word audio playback
- saved vocabulary and liked articles
- an AI discussion experience for speaking practice

## Stack

- Expo
- React Native
- Expo Router
- TypeScript
- Zustand
- OpenAI API
- Supabase

## Run locally

```bash
npm install
npx expo start
```

To use the backend for feed, text-to-speech, Realtime speaking practice, and translation, create local env files from:
- `.env.example`
- `.env.server.example`

Then start the proxy:

```bash
npm run tts:server
```

## Notes

- Real API keys should stay only in local env files and must not be committed.
- Realtime speaking practice requires a development or EAS build because it uses native WebRTC.
