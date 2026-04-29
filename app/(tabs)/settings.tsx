import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { TOPICS } from '@/constants/topics';
import { NativeLanguage, TtsVoiceOption } from '@/types';
import { getPlanById } from '@/constants/subscription';
import {
  SPEAKING_TUTOR_VOICES,
  getSpeakingTutorVoice,
} from '@/constants/voice';

const NATIVE_LANGUAGE_LABELS: Record<NativeLanguage, string> = {
  ar: 'Arabic',
  es: 'Spanish',
  hi: 'Hindi',
  zh: 'Chinese',
  id: 'Indonesian',
  ko: 'Korean',
  ja: 'Japanese',
  fr: 'French',
  de: 'German',
};

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  rightComponent?: React.ReactNode;
}

function getVoiceMeta(voice: TtsVoiceOption): string {
  return 'meta' in voice && typeof voice.meta === 'string' ? voice.meta : voice.category || 'Voice';
}

function SettingRow({ icon, label, value, onPress, showChevron = true, rightComponent }: SettingRowProps) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon as any} size={20} color={Colors.text} />
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {rightComponent}
        {showChevron && onPress && (
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const {
    selectedTopics,
    toggleTopicSelection,
    customTopics,
    selectedVoiceId,
    selectedVoiceName,
    nativeLanguage,
    subscriptionEntitlement,
    setSelectedVoice,
  } = useAppStore();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [dailyReminder, setDailyReminder] = React.useState(false);
  const { user, isLoading: authLoading, error: authError, signOut, syncCurrentUserData } = useAuthStore();

  const myPredefinedTopics = TOPICS.filter((t) => selectedTopics.includes(t.id));
  const myCustomTopics = customTopics.filter((t) => selectedTopics.includes(t.id));
  const myTopics = [...myPredefinedTopics, ...myCustomTopics];
  const currentPlan = getPlanById(subscriptionEntitlement.planId);

  React.useEffect(() => {
    const normalizedVoice = getSpeakingTutorVoice(selectedVoiceId);
    if (selectedVoiceId !== normalizedVoice.id || selectedVoiceName !== normalizedVoice.name) {
      setSelectedVoice(normalizedVoice);
    }
  }, [selectedVoiceId, selectedVoiceName, setSelectedVoice]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity style={styles.avatarButton}>
          <Ionicons name="person-circle-outline" size={26} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* My Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>My Categories</Text>
          <View style={styles.card}>
            <View style={styles.topicsGrid}>
              {myTopics.length === 0 ? (
                <Text style={styles.noTopicsText}>No topics selected yet.</Text>
              ) : (
                myTopics.map((topic) => (
                  <View key={topic.id} style={[styles.topicChip, { backgroundColor: topic.color + '22' }]}>
                    <View style={[styles.topicDot, { backgroundColor: topic.color }]} />
                    <Text style={[styles.topicChipText, { color: topic.color }]}>{topic.name}</Text>
                    <TouchableOpacity onPress={() => toggleTopicSelection(topic.id)}>
                      <Ionicons name="close" size={12} color={topic.color} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
            <TouchableOpacity
              style={styles.editTopicsButton}
              onPress={() =>
                router.push({
                  pathname: '/onboarding',
                  params: { step: 'topics', returnTo: 'settings' },
                })
              }
            >
              <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
              <Text style={styles.editTopicsText}>Edit topics</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Language</Text>
          <View style={styles.card}>
            <SettingRow
              icon="language-outline"
              label="Target language"
              value="English"
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="chatbox-ellipses-outline"
              label="Native language"
              value={nativeLanguage ? NATIVE_LANGUAGE_LABELS[nativeLanguage] : 'Not set'}
              onPress={() =>
                router.push({
                  pathname: '/onboarding',
                  params: { step: 'language', returnTo: 'settings' },
                })
              }
            />
            <View style={styles.divider} />
            <SettingRow
              icon="school-outline"
              label="My level"
              value="Beginner"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Voice */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AI Voice</Text>
          <View style={styles.card}>
            <View style={styles.voiceHeader}>
              <View style={styles.voiceHeaderCopy}>
                <Text style={styles.voiceHeaderTitle}>Speaking tutor</Text>
                <Text style={styles.voiceHeaderSubtitle}>
                  {selectedVoiceName
                    ? `Current voice: ${selectedVoiceName}`
                    : 'Choose the voice used for conversations and pronunciation'}
                </Text>
                <Text style={styles.voiceHelperText}>
                  This voice is used for article discussions, article playback, and vocabulary pronunciation.
                </Text>
              </View>
              <View style={styles.voiceBadge}>
                <Ionicons name="volume-high-outline" size={14} color={Colors.accent} />
              </View>
            </View>

            <View style={styles.voiceList}>
              {SPEAKING_TUTOR_VOICES.map((voice) => {
                const isSelected = voice.id === getSpeakingTutorVoice(selectedVoiceId).id;
                const accentRole = getVoiceMeta(voice);

                return (
                  <TouchableOpacity
                    key={voice.id}
                    style={[
                      styles.voiceOption,
                      isSelected && styles.voiceOptionSelected,
                    ]}
                    onPress={() => setSelectedVoice(voice)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.voiceOptionTop}>
                      <View>
                        <Text
                          style={[
                            styles.voiceOptionName,
                            isSelected && styles.voiceOptionNameSelected,
                          ]}
                        >
                          {voice.name}
                        </Text>
                        <Text style={styles.voiceOptionMeta}>{accentRole}</Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={18}
                          color={Colors.textMuted}
                        />
                      )}
                    </View>
                    {voice.description ? (
                      <Text style={styles.voiceOptionDescription} numberOfLines={2}>
                        {voice.description}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notifications</Text>
          <View style={styles.card}>
            <SettingRow
              icon="notifications-outline"
              label="Push notifications"
              showChevron={false}
              rightComponent={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <View style={styles.divider} />
            <SettingRow
              icon="time-outline"
              label="Daily reminder"
              showChevron={false}
              rightComponent={
                <Switch
                  value={dailyReminder}
                  onValueChange={setDailyReminder}
                  trackColor={{ true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              }
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <SettingRow
              icon="person-outline"
              label="Profile"
              value={user?.email ?? 'Not signed in'}
              onPress={() => router.push('/auth' as any)}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="card-outline"
              label="Subscription"
              value={currentPlan.name}
              onPress={() => router.push('/subscription' as any)}
            />
            <View style={styles.divider} />
            {user ? (
              <>
                <SettingRow
                  icon="cloud-upload-outline"
                  label="Sync now"
                  value={authLoading ? 'Syncing...' : undefined}
                  onPress={() => {
                    void syncCurrentUserData();
                  }}
                />
                <View style={styles.divider} />
              </>
            ) : null}
            <SettingRow icon="lock-closed-outline" label="Privacy" onPress={() => {}} />
            <View style={styles.divider} />
            <SettingRow icon="help-circle-outline" label="Help & Support" onPress={() => {}} />
          </View>
          {authError ? <Text style={styles.accountError}>{authError}</Text> : null}
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.signOutRow}
              onPress={() => {
                if (user) {
                  void signOut();
                } else {
                  router.push('/auth' as any);
                }
              }}
              disabled={authLoading}
              activeOpacity={0.8}
            >
              <Ionicons
                name={user ? 'log-out-outline' : 'log-in-outline'}
                size={20}
                color={user ? Colors.error : Colors.accent}
              />
              <Text style={[styles.signOutText, !user && styles.signInText]}>
                {user ? 'Sign out' : 'Sign in or create account'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.version}>SpeakEasy v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  avatarButton: {
    position: 'absolute',
    right: 14,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 2,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    overflow: 'hidden',
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  topicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noTopicsText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  editTopicsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 12,
  },
  editTopicsText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingValue: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 46,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  voiceHeaderCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  voiceHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  voiceHeaderSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  voiceHelperText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  voiceBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
  },
  voiceList: {
    padding: 12,
    gap: 10,
  },
  voiceOption: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  voiceOptionSelected: {
    borderColor: '#B8D0FF',
    backgroundColor: '#F5F8FF',
  },
  voiceOptionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  voiceOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  voiceOptionNameSelected: {
    color: Colors.accent,
  },
  voiceOptionMeta: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  voiceOptionDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  signOutText: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
  signInText: {
    color: Colors.accent,
  },
  accountError: {
    marginTop: 8,
    paddingHorizontal: 4,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.error,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 16,
  },
});
