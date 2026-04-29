import { Colors } from '@/constants/colors';
import { OPENAI_REALTIME_CONFIG, getSpeakingTutorVoice } from '@/constants/voice';
import { SoftUpgradePrompt } from '@/components/SoftUpgradePrompt';
import { createRealtimeConnection, requestRealtimeSession } from '@/services/realtimeService';
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

function getCurrentAssistantPrompt(
  messages: DiscussionMessage[],
  liveAssistantTranscript: string,
  articleTitle: string,
  articleContent: string,
  topic: string,
): string {
  if (liveAssistantTranscript.trim()) {
    return liveAssistantTranscript.trim();
  }

  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  if (lastAssistantMessage?.content) {
    return lastAssistantMessage.content;
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveAssistantTranscript, setLiveAssistantTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const discussionSessionIdRef = useRef<string | null>(null);
  const hasStartedRef = useRef(false);
  const wrapUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appendFinalMessage = useCallback((role: DiscussionMessage['role'], content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, createMessage(role, trimmed)]);
    void saveDiscussionMessage(discussionSessionIdRef.current, role, trimmed);
  }, []);

  const sendRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    connectionRef.current?.sendEvent(event);
  }, []);

  const requestAssistantResponse = useCallback((instructions?: string) => {
    sendRealtimeEvent({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        ...(instructions ? { instructions } : {}),
      },
    });
  }, [sendRealtimeEvent]);

  const handleRealtimeEvent = useCallback(
    (event: any) => {
      switch (event.type) {
        case 'input_audio_buffer.speech_started':
          setIsListening(true);
          setLiveUserTranscript('');
          break;
        case 'input_audio_buffer.speech_stopped':
          setIsListening(false);
          break;
        case 'conversation.item.input_audio_transcription.delta':
        case 'response.audio_transcription.delta':
          if (event.delta) {
            setLiveUserTranscript((current) => `${current}${event.delta}`);
          }
          break;
        case 'conversation.item.input_audio_transcription.completed':
        case 'response.audio_transcription.done':
          appendFinalMessage('user', event.transcript ?? liveUserTranscript);
          setLiveUserTranscript('');
          break;
        case 'response.audio.started':
          setIsSpeaking(true);
          setLiveAssistantTranscript('');
          break;
        case 'response.audio_transcript.delta':
        case 'response.output_text.delta':
          if (event.delta) {
            setIsSpeaking(true);
            setLiveAssistantTranscript((current) => `${current}${event.delta}`);
          }
          break;
        case 'response.audio_transcript.done':
        case 'response.output_text.done':
          appendFinalMessage('assistant', event.transcript ?? event.text ?? liveAssistantTranscript);
          setLiveAssistantTranscript('');
          break;
        case 'response.done':
          setIsSpeaking(false);
          break;
        case 'error':
          setError(event.error?.message ?? 'Something went wrong with speaking practice.');
          setIsConnecting(false);
          setIsSpeaking(false);
          setIsListening(false);
          break;
      }
    },
    [appendFinalMessage, liveAssistantTranscript, liveUserTranscript],
  );

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, liveAssistantTranscript, liveUserTranscript]);

  useEffect(() => {
    void setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    });
  }, []);

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
            requestAssistantResponse(
              `Start the conversation now with exactly one article-specific question.
Do not ask "What did you think?", "Do you agree?", or "What caught your attention?"
Base the question on one concrete detail from this article excerpt.
Use this style: "The article says [specific detail]. Why do you think [specific consequence or tension]?"
Article title: ${article.title}
Article excerpt: ${article.content.slice(0, 900)}`,
            );
          },
        });

        if (!isMounted) {
          connection.close();
          return;
        }

        connectionRef.current = connection;
        setIsConnecting(false);

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
      }
    };

    void startRealtimeConversation();

    return () => {
      isMounted = false;
    };
  }, [article, handleRealtimeEvent, requestAssistantResponse, selectedVoiceId]);

  useEffect(() => {
    return () => {
      if (wrapUpTimerRef.current) clearTimeout(wrapUpTimerRef.current);
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
      connectionRef.current?.close();
      connectionRef.current = null;
      void setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      });
    };
  }, []);

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

  const assistantPrompt = getCurrentAssistantPrompt(
    messages,
    liveAssistantTranscript,
    article.title,
    article.content,
    article.topic,
  );
  const trySayingSuggestions = getTrySayingSuggestions(article.title, article.topic);
  const historyMessages = messages.filter(
    (message) => message.role === 'user' || message.content !== assistantPrompt,
  );

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
              {isSpeaking ? (
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

          {historyMessages.length > 0 ? (
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

          <View
            style={[
              styles.micButton,
              isListening && styles.micButtonActive,
              isConnecting && styles.micButtonDisabled,
            ]}
          >
            <Ionicons
              name={isListening ? 'radio-button-on' : 'mic'}
              size={30}
              color={isConnecting ? 'rgba(0,0,0,0.25)' : '#FFFFFF'}
            />
          </View>

          <View style={styles.secondaryAction} />
        </View>

        <Text style={styles.micHint}>
          {isConnecting
            ? 'Starting speaking practice...'
            : isListening
              ? 'Speak naturally'
              : isSpeaking
                ? `${tutorName} is responding`
                : 'Speak when you are ready'}
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
