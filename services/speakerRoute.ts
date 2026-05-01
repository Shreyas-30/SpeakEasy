import { NativeModules, Platform } from 'react-native';

type SpeakerRouteModule = {
  forceSpeaker?: () => Promise<boolean>;
  clearSpeakerOverride?: () => Promise<boolean>;
};

const nativeSpeakerRoute = NativeModules.SpeakerRouteModule as SpeakerRouteModule | undefined;

export async function forceSpeakerRoute() {
  if (Platform.OS !== 'ios') return;
  try {
    await nativeSpeakerRoute?.forceSpeaker?.();
  } catch (error) {
    console.warn('Unable to force speaker route:', error);
  }
}

export async function clearSpeakerRoute() {
  if (Platform.OS !== 'ios') return;
  try {
    await nativeSpeakerRoute?.clearSpeakerOverride?.();
  } catch (error) {
    console.warn('Unable to clear speaker route:', error);
  }
}
