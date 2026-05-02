import { Colors } from '@/constants/colors';
import { OPENAI_REALTIME_CONFIG, getSpeakingTutorVoice } from '@/constants/voice';
import { SoftUpgradePrompt } from '@/components/SoftUpgradePrompt';
import { createRealtimeConnection, requestRealtimeSession } from '@/services/realtimeService';
import { clearSpeakerRoute, forceSpeakerRoute } from '@/services/speakerRoute';
import {
  createDiscussionSession,
  saveDiscussionMessage,
} from '@/services/supabaseSyncService';
import { useAppStore } from '@/store/useAppStore';
import { DiscussionMessage } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type RealtimeConnection = Awaited<ReturnType<typeof createRealtimeConnection>>;

function createMessage(role: DiscussionMessage['role'], content: string): DiscussionMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
  };
}

function truncatePrompt(text: string, maxLength = 170): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function getArticleSeedQuestion(articleTitle: string, articleContent: string, topic: string): string {
  const excerpt = articleContent
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const firstSentence =
    excerpt.match(/[^.!?]+[.!?]/)?.[0]?.trim() || truncatePrompt(excerpt, 120);
  const topicLabel = topic.toLowerCase();

  if (firstSentence) {
    return `The article says ${firstSentence} Why do you think that matters for ${topicLabel}?`;
  }

  return `This article is about “${truncatePrompt(articleTitle, 72)}”. What problem do you think it is trying to explain?`;
}

function getOpeningAssistantPrompt(
  openingAssistantMessage: DiscussionMessage | undefined,
  isOpeningAssistantTurn: boolean,
  liveAssistantTranscript: string,
  articleTitle: string,
  articleContent: string,
  topic: string,
): string {
  if (isOpeningAssistantTurn && liveAssistantTranscript.trim()) {
    return liveAssistantTranscript.trim();
  }

  if (openingAssistantMessage?.content) {
    return openingAssistantMessage.content;
  }

  return getArticleSeedQuestion(articleTitle, articleContent, topic);
}

function getTrySayingSuggestions(articleTitle: string, topic: string): string[] {
  const compactTitle = truncatePrompt(articleTitle, 44);
  return [
    `“I think this matters because…”`,
    `“The part I noticed was…”`,
    `“In ${topic.toLowerCase()}, this seems…”`,
    `“About ${compactTitle}, I feel…”`,
  ];
}

function getTextDelta(event: any): string {
  return (
    event.delta ??
    event.transcript_delta ??
    event.text_delta ??
    event.part?.transcript ??
    event.part?.text ??
    ''
  );
}

function getFinalText(event: any): string {
  const itemText = event.item?.content
    ?.map((content: any) => content.transcript ?? content.text ?? '')
    ?.join('');

  const outputText = event.response?.output
    ?.flatMap((item: any) => item.content ?? [])
    ?.map((content: any) => content.transcript ?? content.text ?? '')
    ?.join('');

  const candidates = [
    event.transcript,
    event.text,
    event.output_text,
    event.part?.transcript,
    event.part?.text,
    itemText,
    outputText,
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim()) ?? '';
}

function isLikelyEnglishTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(trimmed)) return false;

  const visibleChars = trimmed.replace(/\s/g, '');
  const asciiLetters = visibleChars.match(/[A-Za-z]/g)?.length ?? 0;
  const nonAsciiLetters = visibleChars.match(/[^\x00-\x7F]/g)?.length ?? 0;
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (asciiLetters === 0) return false;
  if (nonAsciiLetters > asciiLetters * 0.25) return false;
  if (words.length === 1 && asciiLetters < 3) return false;

  return true;
}

function isSafeLiveEnglishTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(trimmed)) return false;

  const asciiLetters = trimmed.match(/[A-Za-z]/g)?.length ?? 0;
  const nonAsciiLetters = trimmed.match(/[^\x00-\x7F]/g)?.length ?? 0;

  return asciiLetters > 0 && nonAsciiLetters <= asciiLetters * 0.15;
}

function estimateAssistantAudioTailMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1800;
  return Math.min(Math.max(words * 360, 1800), 7000);
}

export default function DiscussScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const {
    articles,
    savedArticles,
    selectedVoiceId,
    activeSoftPrompt,
    dismissSoftPrompt,
  } = useAppStore();

  const article = [...articles, ...savedArticles].find((item) => item.id === id);
  const tutorVoice = getSpeakingTutorVoice(selectedVoiceId);
  const tutorName = tutorVoice.name;

  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isRecordingTurn, setIsRecordingTurn] = useState(false);
  const [isTurnChanging, setIsTurnChanging] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveAssistantTranscript, setLiveAssistantTranscript] = useState('');
  const [openingAssistantMessageId, setOpeningAssistantMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const discussionSessionIdRef = useRef<string | null>(null);
  const hasStartedRef = useRef(false);
  const wrapUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTranscriptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantAudioReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingTurnRef = useRef(false);
  const submittedUserTurnRef = useRef(false);
  const userTranscriptRef = useRef('');
  const assistantTranscriptRef = useRef('');
  const assistantFinalizedForResponseRef = useRef(false);
  const assistantAudioActiveRef = useRef(false);
  const assistantResponseDoneRef = useRef(false);
  const turnStartedAtRef = useRef(0);
  const isTurnChangingRef = useRef(false);
  const sawUserSpeechRef = useRef(false);
  const lastSpeakerRouteAtRef = useRef(0);
  const openingAssistantMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    isRecordingTurnRef.current = isRecordingTurn;
  }, [isRecordingTurn]);

  useEffect(() => {
    userTranscriptRef.current = liveUserTranscript;
  }, [liveUserTranscript]);

  useEffect(() => {
    assistantTranscriptRef.current = liveAssistantTranscript;
  }, [liveAssistantTranscript]);

  const appendFinalMessage = useCallback((role: DiscussionMessage['role'], content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const message = createMessage(role, trimmed);
    if (role === 'assistant' && !openingAssistantMessageIdRef.current) {
      openingAssistantMessageIdRef.current = message.id;
      setOpeningAssistantMessageId(message.id);
    }
    setMessages((current) => [...current, message]);
    void saveDiscussionMessage(discussionSessionIdRef.current, role, trimmed);
  }, []);

  const sendRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    connectionRef.current?.sendEvent(event);
  }, []);

  const ensureSpeakerRoute = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastSpeakerRouteAtRef.current < 1000) return;
    lastSpeakerRouteAtRef.current = now;
    void forceSpeakerRoute();
  }, []);

  const setConversationAudioMode = useCallback(async (mode: 'record' | 'playback' | 'idle') => {
    try {
      await setAudioModeAsync({
        allowsRecording: mode === 'record',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
        interruptionMode: 'doNotMix',
      });
      if (mode !== 'idle') {
        ensureSpeakerRoute();
      }
    } catch (err) {
      console.warn('Unable to update discussion audio mode:', err);
    }
  }, [ensureSpeakerRoute]);

  const requestAssistantResponse = useCallback((instructions?: string) => {
    assistantResponseDoneRef.current = false;
    assistantAudioActiveRef.current = false;
    if (assistantAudioReleaseTimerRef.current) {
      clearTimeout(assistantAudioReleaseTimerRef.current);
      assistantAudioReleaseTimerRef.current = null;
    }
    sendRealtimeEvent({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        ...(instructions ? { instructions } : {}),
      },
    });
  }, [sendRealtimeEvent]);

  const releaseAssistantTurn = useCallback((delayMs = 700) => {
    if (assistantAudioReleaseTimerRef.current) {
      clearTimeout(assistantAudioReleaseTimerRef.current);
    }
    assistantAudioReleaseTimerRef.current = setTimeout(() => {
      assistantAudioReleaseTimerRef.current = null;
      assistantAudioActiveRef.current = false;
      assistantResponseDoneRef.current = false;
      setIsSpeaking(false);
      void setConversationAudioMode('idle');
    }, delayMs);
  }, [setConversationAudioMode]);

  const toggleUserTurn = useCallback(() => {
    const connection = connectionRef.current;
    if (!connection || isConnecting || isSpeaking || isTurnChangingRef.current) return;

    const runTurnChange = async () => {
      try {
        setError(null);
        isTurnChangingRef.current = true;
        setIsTurnChanging(true);
        if (isRecordingTurnRef.current) {
          const elapsedMs = Date.now() - turnStartedAtRef.current;
          if (elapsedMs < 800) {
            setError('Keep speaking a little longer, then tap again.');
            return;
          }

          isRecordingTurnRef.current = false;
          setIsRecordingTurn(false);
          setIsListening(false);
          await setConversationAudioMode('playback');
          submittedUserTurnRef.current = true;
          await connection.stopUserTurn();
          if (userTranscriptTimeoutRef.current) clearTimeout(userTranscriptTimeoutRef.current);
          userTranscriptTimeoutRef.current = setTimeout(() => {
            if (submittedUserTurnRef.current) {
              submittedUserTurnRef.current = false;
              userTranscriptRef.current = '';
              setLiveUserTranscript('');
              setError('I could not transcribe that clearly. Tap the microphone and try again.');
            }
          }, 7000);
        } else {
          submittedUserTurnRef.current = false;
          sawUserSpeechRef.current = false;
          userTranscriptRef.current = '';
          setLiveUserTranscript('');
          await setConversationAudioMode('record');
          await connection.startUserTurn();
          turnStartedAtRef.current = Date.now();
          isRecordingTurnRef.current = true;
          setIsRecordingTurn(true);
          setIsListening(true);
        }
      } catch (err) {
        console.warn('Push-to-talk turn failed:', err);
        isRecordingTurnRef.current = false;
        submittedUserTurnRef.current = false;
        setIsRecordingTurn(false);
        setIsListening(false);
        setError('Unable to use the microphone. Please try again.');
      } finally {
        isTurnChangingRef.current = false;
        setIsTurnChanging(false);
      }
    };

    void runTurnChange();
  }, [isConnecting, isSpeaking, setConversationAudioMode]);

  const handleRealtimeEvent = useCallback(
    (event: any) => {
      switch (event.type) {
        case 'input_audio_buffer.speech_started':
          if (isRecordingTurnRef.current) {
            sawUserSpeechRef.current = true;
            setIsListening(true);
          }
          break;
        case 'input_audio_buffer.speech_stopped':
          if (!isRecordingTurnRef.current) {
            setIsListening(false);
          }
          break;
        case 'conversation.item.input_audio_transcription.delta':
        case 'response.audio_transcription.delta':
        case 'conversation.item.input_audio_transcription.delta.completed': {
          if (isRecordingTurnRef.current || submittedUserTurnRef.current) {
            const delta = getTextDelta(event);
            if (delta) {
              setLiveUserTranscript((current) => {
                const next = `${current}${delta}`;
                if (!isSafeLiveEnglishTranscript(next)) {
                  return current;
                }
                userTranscriptRef.current = next;
                return next;
              });
            }
          }
          break;
        }
        case 'conversation.item.input_audio_transcription.completed':
        case 'conversation.item.input_audio_transcription.done':
        case 'response.audio_transcription.done': {
          if (!submittedUserTurnRef.current) break;
          const transcript = getFinalText(event) || userTranscriptRef.current;
          submittedUserTurnRef.current = false;
          if (userTranscriptTimeoutRef.current) {
            clearTimeout(userTranscriptTimeoutRef.current);
            userTranscriptTimeoutRef.current = null;
          }
          if (isLikelyEnglishTranscript(transcript)) {
            appendFinalMessage('user', transcript);
            requestAssistantResponse();
          } else {
            setError('I did not catch that clearly in English. Tap the microphone and try again.');
          }
          userTranscriptRef.current = '';
          setLiveUserTranscript('');
          break;
        }
        case 'response.audio.started':
        case 'response.output_item.added':
          void setConversationAudioMode('playback');
          ensureSpeakerRoute(true);
          assistantAudioActiveRef.current = true;
          setIsSpeaking(true);
          setLiveAssistantTranscript('');
          assistantTranscriptRef.current = '';
          assistantFinalizedForResponseRef.current = false;
          break;
        case 'response.audio.delta':
          ensureSpeakerRoute();
          assistantAudioActiveRef.current = true;
          setIsSpeaking(true);
          break;
        case 'response.audio.done':
          assistantAudioActiveRef.current = false;
          if (assistantResponseDoneRef.current) {
            releaseAssistantTurn();
          }
          break;
        case 'response.audio_transcript.delta':
        case 'response.output_audio_transcript.delta':
        case 'response.output_text.delta':
        case 'response.content_part.delta': {
          const delta = getTextDelta(event);
          if (delta) {
            setIsSpeaking(true);
            setLiveAssistantTranscript((current) => {
              const next = `${current}${delta}`;
              assistantTranscriptRef.current = next;
              return next;
            });
          }
          break;
        }
        case 'response.audio_transcript.done':
        case 'response.output_audio_transcript.done':
        case 'response.output_text.done':
        case 'response.content_part.done': {
          const transcript = getFinalText(event) || assistantTranscriptRef.current;
          appendFinalMessage('assistant', transcript);
          assistantTranscriptRef.current = '';
          assistantFinalizedForResponseRef.current = true;
          setLiveAssistantTranscript('');
          break;
        }
        case 'response.done':
          assistantResponseDoneRef.current = true;
          if (!assistantFinalizedForResponseRef.current) {
            if (assistantTranscriptRef.current.trim()) {
              appendFinalMessage('assistant', assistantTranscriptRef.current);
              assistantTranscriptRef.current = '';
              setLiveAssistantTranscript('');
            } else {
              const transcript = getFinalText(event);
              if (transcript) appendFinalMessage('assistant', transcript);
            }
          }
          assistantFinalizedForResponseRef.current = false;
          releaseAssistantTurn(
            assistantAudioActiveRef.current
              ? estimateAssistantAudioTailMs(assistantTranscriptRef.current || getFinalText(event))
              : 700,
          );
          break;
        case 'error':
          if (String(event.error?.message ?? '').includes('buffer too small')) {
            submittedUserTurnRef.current = false;
            if (userTranscriptTimeoutRef.current) {
              clearTimeout(userTranscriptTimeoutRef.current);
              userTranscriptTimeoutRef.current = null;
            }
            setLiveUserTranscript('');
            userTranscriptRef.current = '';
            setError('I did not hear enough audio. Tap the microphone, speak your answer, then tap again.');
            break;
          }

          setError(event.error?.message ?? 'Something went wrong with speaking practice.');
          setIsConnecting(false);
          setIsSpeaking(false);
          setIsListening(false);
          setIsRecordingTurn(false);
          isRecordingTurnRef.current = false;
          submittedUserTurnRef.current = false;
          isTurnChangingRef.current = false;
          setIsTurnChanging(false);
          break;
      }
    },
    [appendFinalMessage, ensureSpeakerRoute, releaseAssistantTurn, requestAssistantResponse, setConversationAudioMode],
  );

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, liveAssistantTranscript, liveUserTranscript]);

  useEffect(() => {
    void setConversationAudioMode('playback');
  }, [setConversationAudioMode]);

  useEffect(() => {
    if (!article || hasStartedRef.current) return;
    hasStartedRef.current = true;

    let isMounted = true;

    const startRealtimeConversation = async () => {
      setIsConnecting(true);
      setError(null);

      try {
        discussionSessionIdRef.current = await createDiscussionSession(article);
        const session = await requestRealtimeSession(article, selectedVoiceId);
        const connection = await createRealtimeConnection({
          clientSecret: session.clientSecret,
          model: session.model,
          onEvent: handleRealtimeEvent,
          onOpen: () => {
            void setConversationAudioMode('playback');
            ensureSpeakerRoute(true);
          },
        });

        if (!isMounted) {
          connection.close();
          return;
        }

        connectionRef.current = connection;
        setIsConnecting(false);
        void setConversationAudioMode('playback');

        requestAssistantResponse(
          `Start the conversation now with exactly one article-specific question.
Do not ask "What did you think?", "Do you agree?", or "What caught your attention?"
Base the question on one concrete detail from this article excerpt.
Use this style: "The article says [specific detail]. Why do you think [specific consequence or tension]?"
Article title: ${article.title}
Article excerpt: ${article.content.slice(0, 900)}`,
        );

        wrapUpTimerRef.current = setTimeout(() => {
          requestAssistantResponse(
            'Begin a natural wrap-up. Ask one final reflection question or briefly summarize the learner’s practice, then close warmly.',
          );
        }, Math.max(OPENAI_REALTIME_CONFIG.sessionTargetMs - OPENAI_REALTIME_CONFIG.wrapUpWarningMs, 30_000));

        hardStopTimerRef.current = setTimeout(() => {
          requestAssistantResponse(
            'Close the conversation now in one short sentence. Thank the learner and encourage them to practice again later.',
          );
        }, OPENAI_REALTIME_CONFIG.sessionHardLimitMs);
      } catch (err) {
        if (!isMounted) return;
        console.warn('Realtime discuss failed:', err);
        const message = err instanceof Error ? err.message : 'Unable to start speaking practice.';
        setError(
          message.includes('mediaDevices') || message.includes('WebRTC')
            ? 'Speaking practice needs a development build or TestFlight build. It is not available in Expo Go.'
            : message,
        );
        setIsConnecting(false);
        setIsRecordingTurn(false);
        setIsListening(false);
      }
    };

    void startRealtimeConversation();

    return () => {
      isMounted = false;
    };
  }, [article, ensureSpeakerRoute, handleRealtimeEvent, requestAssistantResponse, selectedVoiceId, setConversationAudioMode]);

  useEffect(() => {
    return () => {
      if (wrapUpTimerRef.current) clearTimeout(wrapUpTimerRef.current);
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
      if (userTranscriptTimeoutRef.current) clearTimeout(userTranscriptTimeoutRef.current);
      if (assistantAudioReleaseTimerRef.current) clearTimeout(assistantAudioReleaseTimerRef.current);
      isRecordingTurnRef.current = false;
      submittedUserTurnRef.current = false;
      isTurnChangingRef.current = false;
      connectionRef.current?.close();
      connectionRef.current = null;
      void clearSpeakerRoute();
      void setConversationAudioMode('idle');
    };
  }, [setConversationAudioMode]);

  if (!article) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Discussion unavailable</Text>
          <Text style={styles.emptyText}>
            Open the article again from your feed to start an English practice session.
          </Text>
          <TouchableOpacity style={styles.backToArticleButton} onPress={() => router.back()}>
            <Text style={styles.backToArticleText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const openingAssistantMessage = openingAssistantMessageId
    ? messages.find((message) => message.id === openingAssistantMessageId)
    : undefined;
  const isOpeningAssistantTurn = openingAssistantMessageId == null;
  const liveAssistantChatTranscript = !isOpeningAssistantTurn ? liveAssistantTranscript.trim() : '';
  const assistantPrompt = getOpeningAssistantPrompt(
    openingAssistantMessage,
    isOpeningAssistantTurn,
    liveAssistantTranscript,
    article.title,
    article.content,
    article.topic,
  );
  const trySayingSuggestions = getTrySayingSuggestions(article.title, article.topic);
  const historyMessages = messages.filter(
    (message) => message.id !== openingAssistantMessageId,
  );
  const hasConversationMessages = historyMessages.length > 0 || liveAssistantChatTranscript.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#7A7663" />
        </TouchableOpacity>

        <View style={styles.headerCenter} />

        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>{isConnecting ? 'Connecting' : 'Live'}</Text>
        </View>
      </View>

      <View style={styles.contentArea}>
        <View style={styles.articleCard}>
          <Ionicons name="document-text-outline" size={14} color="#7A7663" />
          <View style={styles.articleCardCopy}>
            <Text style={styles.articleCardTitle} numberOfLines={1}>
              {article.title}
            </Text>
            <Text style={styles.articleCardSource} numberOfLines={1}>
              {article.source}
            </Text>
          </View>
        </View>

        {activeSoftPrompt ? (
          <View style={styles.softPromptWrap}>
            <SoftUpgradePrompt
              trigger={activeSoftPrompt}
              onDismiss={() => dismissSoftPrompt()}
              onSeePlans={() => {
                dismissSoftPrompt();
                router.push('/subscription' as any);
              }}
            />
          </View>
        ) : null}

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.promptCard}>
            <View style={styles.promptCardHeader}>
              <View style={styles.promptTutorWrap}>
                <View style={styles.promptAvatar}>
                  <Ionicons name="happy-outline" size={22} color="#1A1A1A" />
                </View>
                <Text style={styles.promptTutorName}>{tutorName}</Text>
              </View>
              {isSpeaking && isOpeningAssistantTurn ? (
                <View style={styles.waveIcon}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.waveBar,
                        { height: 12 + ((index % 3) * 5) },
                      ]}
                    />
                  ))}
                </View>
              ) : (
                <Ionicons name="volume-high-outline" size={22} color="#777568" />
              )}
            </View>

            <View style={styles.promptBody}>
              {isConnecting && !liveAssistantTranscript && messages.length === 0 ? (
                <ActivityIndicator size="small" color="#66643B" />
              ) : (
                <Text style={styles.promptQuestion}>{assistantPrompt}</Text>
              )}
              <Text style={styles.promptHint}>Take your time -- speak naturally</Text>
            </View>
          </View>

          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsLabel}>TRY SAYING</Text>
            <View style={styles.suggestionsRow}>
              {trySayingSuggestions.map((suggestion) => (
                <View key={suggestion} style={styles.suggestionChip}>
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {suggestion}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {hasConversationMessages ? (
            <View style={styles.historySection}>
              {historyMessages.map((msg) => (
                <View
                  key={msg.id}
                  style={[styles.messageRow, msg.role === 'user' ? styles.userRow : styles.aiRow]}
                >
                  {msg.role === 'assistant' && (
                    <View style={styles.avatarSmall}>
                      <Ionicons name="happy-outline" size={14} color="#6A6840" />
                    </View>
                  )}
                  <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                    <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userBubbleText : styles.aiBubbleText]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}
              {liveAssistantChatTranscript ? (
                <View style={[styles.messageRow, styles.aiRow]}>
                  <View style={styles.avatarSmall}>
                    <Ionicons name="happy-outline" size={14} color="#6A6840" />
                  </View>
                  <View style={[styles.bubble, styles.aiBubble]}>
                    <Text style={[styles.bubbleText, styles.aiBubbleText]}>
                      {liveAssistantChatTranscript}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {error != null && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>
      </View>

      <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
        {(isListening || liveUserTranscript) && (
          <View style={styles.transcriptBanner}>
            <Text style={styles.transcriptText} numberOfLines={2}>
              {liveUserTranscript || 'Listening...'}
            </Text>
          </View>
        )}

        <View style={styles.micDock}>
          <View style={styles.secondaryAction} />

          <TouchableOpacity
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={isRecordingTurn ? 'Stop speaking' : 'Start speaking'}
            disabled={isConnecting || isSpeaking || isTurnChanging}
            onPress={toggleUserTurn}
            style={[
              styles.micButton,
              isRecordingTurn && styles.micButtonActive,
              (isConnecting || isSpeaking || isTurnChanging) && styles.micButtonDisabled,
            ]}
          >
            <Ionicons
              name={isRecordingTurn ? 'stop' : 'mic'}
              size={30}
              color={isConnecting || isSpeaking || isTurnChanging ? 'rgba(0,0,0,0.25)' : '#FFFFFF'}
            />
          </TouchableOpacity>

          <View style={styles.secondaryAction} />
        </View>

        <Text style={styles.micHint}>
          {isConnecting
            ? 'Starting speaking practice...'
            : isTurnChanging
              ? 'One moment...'
            : isRecordingTurn
              ? 'Tap again when you are done'
            : isSpeaking
              ? `${tutorName} is responding`
                : 'Tap the microphone to speak'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  contentArea: { flex: 1, backgroundColor: '#F8F7F1' },
  header: {
    height: 72,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerButton: { width: 32, alignItems: 'flex-start', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  liveBadge: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: 'rgba(161,76,76,0.07)',
  },
  liveText: { fontSize: 12, fontWeight: '500', color: '#A14C4C' },
  articleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 22,
    marginTop: 20,
    marginBottom: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F8F7F1',
    borderWidth: 1,
    borderColor: '#DCCEB8',
  },
  articleCardCopy: { flex: 1 },
  articleCardTitle: { fontSize: 12, color: '#1E1E1B', flex: 1, fontWeight: '600' },
  articleCardSource: { marginTop: 3, fontSize: 11, color: '#918E80' },
  softPromptWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#F8F7F1',
  },
  messagesList: { flex: 1 },
  messagesContent: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 24, gap: 20 },
  promptCard: {
    minHeight: 232,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'space-between',
  },
  promptCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promptTutorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promptAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptTutorName: { fontSize: 16, color: '#262621', fontWeight: '600' },
  waveIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
  },
  waveBar: {
    width: 3,
    borderRadius: 999,
    backgroundColor: '#6F6D61',
  },
  promptBody: {
    gap: 18,
  },
  promptQuestion: {
    fontSize: 24,
    lineHeight: 31,
    color: '#050505',
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  promptHint: {
    fontSize: 13,
    color: '#A19D90',
  },
  suggestionsSection: {
    marginTop: 56,
    gap: 12,
  },
  suggestionsLabel: {
    fontSize: 11,
    color: '#A19D90',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestionChip: {
    maxWidth: '48%',
    borderRadius: 999,
    backgroundColor: '#F1EFE7',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  suggestionText: {
    fontSize: 13,
    color: '#8F8B7D',
    fontWeight: '600',
  },
  historySection: {
    gap: 12,
    paddingTop: 18,
  },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  avatarSmall: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#DAD6C7', backgroundColor: '#FFFDF8',
    marginBottom: 2,
  },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: '#66643B', borderBottomRightRadius: 4 },
  aiBubble: {
    backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    minWidth: 48, minHeight: 38, alignItems: 'center', justifyContent: 'center',
  },
  liveBubble: { opacity: 0.78 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userBubbleText: { color: '#FFFFFF' },
  aiBubbleText: { color: '#1A1A1A' },
  errorText: { fontSize: 13, color: Colors.error, textAlign: 'center', marginTop: 8 },
  inputArea: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
  },
  transcriptBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F3F2EC',
    borderRadius: 14,
    minHeight: 40,
    justifyContent: 'center',
  },
  transcriptText: { fontSize: 14, color: '#3A3A3A', lineHeight: 20 },
  micDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 14,
  },
  secondaryAction: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#66643B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#66643B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  micButtonActive: {
    backgroundColor: '#A14C4C',
    shadowColor: '#A14C4C',
  },
  micButtonDisabled: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    shadowOpacity: 0,
    elevation: 0,
  },
  micHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9A9880',
    marginTop: 7,
  },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 10, backgroundColor: '#F8F7F1',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center', color: Colors.textSecondary },
  backToArticleButton: {
    marginTop: 6, paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 12, backgroundColor: '#66643B',
  },
  backToArticleText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});
