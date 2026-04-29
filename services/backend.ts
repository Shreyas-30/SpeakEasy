const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? process.env.EXPO_PUBLIC_TTS_PROXY_URL ?? '';

export function getBackendUrl(): string {
  return BACKEND_URL;
}

export function buildBackendUrl(pathname: string): string {
  if (!BACKEND_URL) {
    throw new Error('Missing EXPO_PUBLIC_BACKEND_URL');
  }

  return new URL(pathname, BACKEND_URL).toString();
}
