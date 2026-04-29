# SpeakEasy Backend

This folder contains the public backend proxy used by the SpeakEasy mobile app for:

- OpenAI text-to-speech
- OpenAI Realtime speaking practice session creation
- OpenAI-powered vocabulary translation
- server-side news feed fetching
- trusted Supabase subscription entitlement updates

## Local run

From the repo root:

```bash
npm run tts:server
```

This uses the root `.env.server` file.

## Render deployment

This backend can be deployed from the same repo on Render using the repo root.

Recommended settings:

- Service type: `Web Service`
- Root directory: repo root
- Build command: `npm install`
- Start command: `npm run tts:server`

## Required environment variables

- `GUARDIAN_KEY`
- `GNEWS_KEY`
- `OPENAI_API_KEY`
- `OPENAI_TRANSLATION_MODEL`
- `OPENAI_TTS_MODEL`
- `OPENAI_REALTIME_MODEL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `PUBLIC_BASE_URL`
- `ALLOW_ORIGIN`

If `PUBLIC_BASE_URL` is not set, the server will derive its public base URL from the request headers, which works well on Render.
