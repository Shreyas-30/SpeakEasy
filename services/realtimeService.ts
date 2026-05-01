import { Article } from '@/types';
import {
  OPENAI_REALTIME_CONFIG,
  getSpeakingTutorVoice,
} from '@/constants/voice';
import { buildBackendUrl } from '@/services/backend';

type RealtimeSessionResponse = {
  clientSecret: string;
  model: string;
  voiceId: string;
  voiceName: string;
  sessionTargetSeconds: number;
};

export type RealtimeEventHandler = (event: any) => void;

export async function requestRealtimeSession(
  article: Article,
  voiceId?: string | null,
): Promise<RealtimeSessionResponse> {
  const tutorVoice = getSpeakingTutorVoice(voiceId);
  const response = await fetch(buildBackendUrl('/api/realtime/session'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voiceId: tutorVoice.id,
      articleTitle: article.title,
      articleSource: article.source,
      articleContent: article.content,
      difficulty: article.difficulty,
      topic: article.topic,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.clientSecret) {
    throw new Error(payload.error ?? 'Unable to start speaking practice.');
  }

  return payload;
}

export async function createRealtimeConnection({
  clientSecret,
  model,
  onEvent,
  onRemoteStream,
  onOpen,
}: {
  clientSecret: string;
  model?: string;
  onEvent: RealtimeEventHandler;
  onRemoteStream?: (stream: any) => void;
  onOpen?: () => void;
}) {
  const webrtc = require('react-native-webrtc');
  const { mediaDevices, RTCPeerConnection, RTCSessionDescription } = webrtc;

  if (!mediaDevices || !RTCPeerConnection || !RTCSessionDescription) {
    throw new Error('WebRTC is unavailable in this runtime.');
  }

  const localStream = await mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
  const localAudioTrack = (localStream.getAudioTracks?.() ?? localStream.getTracks())[0];
  if (!localAudioTrack) {
    throw new Error('Microphone audio track is unavailable.');
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  const audioSender = pc.addTrack(localAudioTrack, localStream);
  await audioSender.replaceTrack(null);

  pc.ontrack = (event: any) => {
    const [remoteStream] = event.streams ?? [];
    if (remoteStream) {
      onRemoteStream?.(remoteStream);
    }
  };

  const dataChannel = pc.createDataChannel('oai-events');
  const pendingEvents: Record<string, unknown>[] = [];
  const sendJsonEvent = (event: Record<string, unknown>) => {
    if (dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify(event));
    } else {
      pendingEvents.push(event);
    }
  };

  dataChannel.onopen = () => {
    while (pendingEvents.length > 0) {
      const pendingEvent = pendingEvents.shift();
      if (pendingEvent) {
        dataChannel.send(JSON.stringify(pendingEvent));
      }
    }
    onOpen?.();
  };
  dataChannel.onmessage = (event: { data: string }) => {
    try {
      onEvent(JSON.parse(event.data));
    } catch {
      onEvent({ type: 'speakeasy.unparsed_event', raw: event.data });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const realtimeModel = model || OPENAI_REALTIME_CONFIG.model;
  const sdpResponse = await fetch(
    `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(realtimeModel)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    },
  );

  if (!sdpResponse.ok) {
    const errorText = await sdpResponse.text();
    throw new Error(`Realtime connection failed: ${errorText.slice(0, 300)}`);
  }

  const answerSdp = await sdpResponse.text();
  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));

  return {
    pc,
    dataChannel,
    localStream,
    sendEvent(event: Record<string, unknown>) {
      sendJsonEvent(event);
    },
    async startUserTurn() {
      await audioSender.replaceTrack(localAudioTrack);
      sendJsonEvent({ type: 'input_audio_buffer.clear' });
    },
    async stopUserTurn() {
      sendJsonEvent({ type: 'input_audio_buffer.commit' });
      await new Promise((resolve) => setTimeout(resolve, 120));
      await audioSender.replaceTrack(null);
    },
    async cancelUserTurn() {
      await audioSender.replaceTrack(null);
      sendJsonEvent({ type: 'input_audio_buffer.clear' });
    },
    close() {
      try {
        audioSender.replaceTrack(null);
      } catch {}
      try {
        dataChannel.close();
      } catch {}
      try {
        localStream.getTracks().forEach((track: any) => track.stop());
      } catch {}
      try {
        pc.close();
      } catch {}
    },
  };
}
