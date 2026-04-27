import { Colors } from '@/constants/colors';
import { ChatMessage, getAIResponse } from '@/services/aiService';
import {
  getTtsMode,
  requestSpeechUrl,
  speakTextOnDevice,
  stopDeviceSpeech,
} from '@/services/ttsService';
import { useAppStore } from '@/store/useAppStore';
import { SoftUpgradePrompt } from '@/components/SoftUpgradePrompt';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function DiscussScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    articles,
    savedArticles,
    selectedVoiceName,
    selectedVoiceId,
    activeSoftPrompt,
    dismissSoftPrompt,
  } = useAppStore();

  const article = [...articles, ...savedArticles].find((item) => item.id === id);
  const tutorName = selectedVoiceName ?? 'Sophia';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const player = useAudioPlayer(null, { downloadFirst: true, updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);

  // ── Speech recognition events ──────────────────────────────────────────────

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setLiveTranscript('');
  });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    setLiveTranscript(transcript);
    if (event.isFinal && transcript.trim()) {
      void handleSend(transcript.trim());
    }
  });
  useSpeechRecognitionEvent('error', () => {
    setIsListening(false);
    setLiveTranscript('');
  });

  // ── TTS helpers ────────────────────────────────────────────────────────────

  const speakMessage = useCallback(
    async (text: string) => {
      setIsSpeaking(true);
      try {
        if (getTtsMode() === 'elevenlabs-proxy') {
          const url = await requestSpeechUrl(text, selectedVoiceId);
          player.replace(url);
          player.play();
        } else {
          await speakTextOnDevice(text, {
            onDone: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
          });
        }
      } catch {
        setIsSpeaking(false);
      }
    },
    [selectedVoiceId, player],
  );

  useEffect(() => {
    if (getTtsMode() !== 'elevenlabs-proxy') return;
    if (playerStatus.playing) {
      setIsSpeaking(true);
    } else if (playerStatus.didJustFinish) {
      setIsSpeaking(false);
    }
  }, [playerStatus.playing, playerStatus.didJustFinish]);

  // ── Scroll & cleanup ───────────────────────────────────────────────────────

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  useEffect(() => {
    return () => {
      void stopDeviceSpeech();
      ExpoSpeechRecognitionModule.stop();
      try { player.pause(); } catch {}
    };
  }, [player]);

  // ── Opening message ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!article || hasStarted) return;
    setHasStarted(true);
    void sendOpeningMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article]);

  const sendOpeningMessage = async () => {
    if (!article) return;
    setIsLoading(true);
    setError(null);
    try {
      const aiText = await getAIResponse([], article.title, article.source, article.content, tutorName);
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'assistant', content: aiText };
      setMessages([aiMessage]);
      await speakMessage(aiText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log('DISCUSS ERROR:', msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSend = async (text: string) => {
    if (!text || isLoading || !article) return;

    setInputText('');
    setError(null);

    const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const history: ChatMessage[] = updatedMessages.map((m) => ({ role: m.role, content: m.content }));
      const aiText = await getAIResponse(history, article.title, article.source, article.content, tutorName);
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'assistant', content: aiText };
      setMessages((prev) => [...prev, aiMessage]);
      await speakMessage(aiText);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Mic button ─────────────────────────────────────────────────────────────

  const handleMicPress = async () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setError('Microphone permission is required to speak.');
      return;
    }
    setLiveTranscript('');
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
  };

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!article) {
    return (
      <SafeAreaView style={styles.container}>
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

  const canSendText = inputText.trim().length > 0 && !isLoading;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#7A7663" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.tutorAvatar}>
            <Ionicons name="happy-outline" size={16} color="#6A6840" />
          </View>
          <Text style={styles.headerTutorName}>{tutorName}</Text>
          {isSpeaking && (
            <View style={styles.speakingIndicator}>
              <Text style={styles.speakingText}>speaking...</Text>
            </View>
          )}
        </View>

        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>• Live</Text>
        </View>
      </View>

      {/* ── Article context strip ── */}
      <View style={styles.articleCard}>
        <Ionicons name="document-text-outline" size={14} color="#7A7663" />
        <Text style={styles.articleCardTitle} numberOfLines={1}>
          {article.title}
        </Text>
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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Messages ── */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && isLoading && (
            <View style={styles.aiRow}>
              <View style={styles.avatarSmall}>
                <Ionicons name="happy-outline" size={14} color="#6A6840" />
              </View>
              <View style={styles.aiBubble}>
                <ActivityIndicator size="small" color="#66643B" />
              </View>
            </View>
          )}

          {messages.map((msg) => (
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

          {isLoading && messages.length > 0 && (
            <View style={[styles.messageRow, styles.aiRow]}>
              <View style={styles.avatarSmall}>
                <Ionicons name="happy-outline" size={14} color="#6A6840" />
              </View>
              <View style={[styles.aiBubble, styles.thinkingBubble]}>
                <ActivityIndicator size="small" color="#66643B" />
              </View>
            </View>
          )}

          {error != null && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        {/* ── Input area ── */}
        <View style={styles.inputArea}>

          {/* Live transcript preview */}
          {isListening && (
            <View style={styles.transcriptBanner}>
              <Text style={styles.transcriptText} numberOfLines={2}>
                {liveTranscript || 'Listening...'}
              </Text>
            </View>
          )}

          {/* Text input row — shown when keyboard mode toggled */}
          {showTextInput && (
            <View style={styles.textRow}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type your response..."
                placeholderTextColor="rgba(0,0,0,0.35)"
                multiline
                maxLength={500}
                autoFocus
                returnKeyType="send"
                onSubmitEditing={() => { if (canSendText) void handleSend(inputText.trim()); }}
              />
              <TouchableOpacity
                style={[styles.sendButton, !canSendText && styles.sendButtonDisabled]}
                onPress={() => { if (canSendText) void handleSend(inputText.trim()); }}
                disabled={!canSendText}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up" size={20} color={canSendText ? '#FFFFFF' : 'rgba(0,0,0,0.3)'} />
              </TouchableOpacity>
            </View>
          )}

          {/* Mic dock */}
          <View style={styles.micDock}>
            {/* Keyboard toggle */}
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => setShowTextInput((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showTextInput ? 'mic-outline' : 'create-outline'}
                size={22}
                color="#7A7663"
              />
            </TouchableOpacity>

            {/* Primary mic button */}
            <TouchableOpacity
              style={[styles.micButton, isListening && styles.micButtonActive, isLoading && styles.micButtonDisabled]}
              onPress={handleMicPress}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isListening ? 'stop' : 'mic'}
                size={30}
                color={isLoading ? 'rgba(0,0,0,0.25)' : '#FFFFFF'}
              />
            </TouchableOpacity>

            {/* Spacer to balance the layout */}
            <View style={styles.secondaryAction} />
          </View>

          <Text style={styles.micHint}>
            {isListening ? 'Tap to stop' : isLoading ? 'Thinking...' : showTextInput ? 'Tap mic to go back to speaking' : 'Tap to speak or type'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F8F7F1' },

  // Header
  header: {
    height: 60,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerButton: { width: 28, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  tutorAvatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#DAD6C7', backgroundColor: '#FFFDF8',
  },
  headerTutorName: { fontSize: 15, fontWeight: '600', color: '#3A3A3A' },
  speakingIndicator: {
    backgroundColor: 'rgba(102,100,59,0.1)', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  speakingText: { fontSize: 11, color: '#66643B', fontWeight: '500' },
  liveBadge: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: 'rgba(161,76,76,0.07)',
  },
  liveText: { fontSize: 12, fontWeight: '500', color: '#A14C4C' },

  // Article strip
  articleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 10,
    backgroundColor: 'rgba(161,114,76,0.06)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(161,114,76,0.15)',
  },
  articleCardTitle: { fontSize: 12, color: '#7A7663', flex: 1, fontWeight: '500' },
  softPromptWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#F8F7F1',
  },

  // Messages
  messagesList: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, gap: 12 },
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
  thinkingBubble: { paddingHorizontal: 16, paddingVertical: 10 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userBubbleText: { color: '#FFFFFF' },
  aiBubbleText: { color: '#1A1A1A' },
  errorText: { fontSize: 13, color: Colors.error, textAlign: 'center', marginTop: 8 },

  // Input area
  inputArea: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
    paddingBottom: 8,
  },

  // Live transcript
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

  // Text input row
  textRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    backgroundColor: '#F3F2EC',
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 21,
  },
  sendButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#66643B',
    alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: 'rgba(0,0,0,0.08)' },

  // Mic dock
  micDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 16,
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
    marginTop: 8,
    marginBottom: 4,
  },

  // Empty state
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
