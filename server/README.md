# SpeakEasy Backend

This folder contains the public backend proxy used by the SpeakEasy mobile app for:

- ElevenLabs text-to-speech
- ElevenLabs voice listing
- OpenAI-powered vocabulary translation
- server-side news feed fetching

## Local run

From the repo root:

```bash
npm run tts:server
```

This uses the root `.env.server` file.

## Render deployment

This backend can be deployed from the same repo on Render using the `server/` directory.

Recommended settings:

- Service type: `Web Service`
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`

## Required environment variables

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_MODEL_ID`
- `GUARDIAN_KEY`
- `GNEWS_KEY`
- `OPENAI_API_KEY`
- `OPENAI_TRANSLATION_MODEL`

Optional:

- `PUBLIC_BASE_URL`
- `ALLOW_ORIGIN`

If `PUBLIC_BASE_URL` is not set, the server will derive its public base URL from the request headers, which works well on Render.
