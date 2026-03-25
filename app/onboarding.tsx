import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { NICHE_SUGGESTIONS } from '@/constants/suggestions';
import { TOPICS } from '@/constants/topics';
import { useAppStore } from '@/store/useAppStore';
import { CustomTopic, NativeLanguage, Topic } from '@/types';

type OnboardingStep = 'language' | 'topics';
type SuggestionSource = 'predefined' | 'curated';

type LanguageOption = {
  id: NativeLanguage;
  label: string;
  flag: string;
};

type TopicVisual = {
  backgroundColor: string;
  iconUrl?: string;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
};

type TopicSuggestion = {
  id: string;
  name: string;
  source: SuggestionSource;
  color?: string;
  isSelected?: boolean;
};

const BUTTON_COLOR = '#5C5A35';
const BUTTON_DISABLED = '#B8B59A';
const SELECTED_CHIP = '#A59D47';
const SOFT_BEIGE = 'rgba(231,227,209,0.42)';
const SEARCH_BG = '#F7F6F3';

const NATIVE_LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'ar', label: 'Arabic', flag: '🇸🇦' },
  { id: 'es', label: 'Spanish', flag: '🇪🇸' },
  { id: 'hi', label: 'Hindi', flag: '🇮🇳' },
  { id: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { id: 'id', label: 'Indonesian', flag: '🇮🇩' },
  { id: 'ko', label: 'Korean', flag: '🇰🇷' },
  { id: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { id: 'fr', label: 'French', flag: '🇫🇷' },
  { id: 'de', label: 'German', flag: '🇩🇪' },
];

const TOPIC_VISUALS: Record<string, TopicVisual> = {
  technology: {
    backgroundColor: '#E7EEF4',
    iconUrl: 'https://www.figma.com/api/mcp/asset/f8830e1a-49aa-4f9a-b9fd-5b8a97de9b09',
    fallbackIcon: 'desktop-outline',
  },
  sports: {
    backgroundColor: '#F4F0E8',
    iconUrl: 'https://www.figma.com/api/mcp/asset/0d6bc9fb-07cc-4856-8674-93e6b09b6e5b',
    fallbackIcon: 'football-outline',
  },
  food: {
    backgroundColor: '#F4ECE8',
    iconUrl: 'https://www.figma.com/api/mcp/asset/58ca7351-2f7f-4a4d-8ab7-478d4cf08069',
    fallbackIcon: 'restaurant-outline',
  },
  travel: {
    backgroundColor: '#E8F1F4',
    iconUrl: 'https://www.figma.com/api/mcp/asset/336f723a-fa6a-4981-976e-c50ce63427ed',
    fallbackIcon: 'airplane-outline',
  },
  music: {
    backgroundColor: '#ECE8F4',
    iconUrl: 'https://www.figma.com/api/mcp/asset/63f2318c-b279-49df-9396-57f694973aaa',
    fallbackIcon: 'musical-notes-outline',
  },
  science: {
    backgroundColor: '#ECF4E8',
    iconUrl: 'https://www.figma.com/api/mcp/asset/e06b3d55-ee73-4797-b687-96993106fae4',
    fallbackIcon: 'flask-outline',
  },
  health: {
    backgroundColor: '#F4F2E8',
    iconUrl: 'https://www.figma.com/api/mcp/asset/5f900ba0-d2b7-4eab-9868-4ea85f5cf965',
    fallbackIcon: 'barbell-outline',
  },
  business: {
    backgroundColor: '#F4E8E8',
    iconUrl: 'https://www.figma.com/api/mcp/asset/0115e651-cdbb-4b4a-a4e8-c7057c2ee91e',
    fallbackIcon: 'stats-chart-outline',
  },
  anime: {
    backgroundColor: '#E8F3F4',
    iconUrl: 'https://www.figma.com/api/mcp/asset/c2875fd0-6649-4a4f-ae26-8ed6e9a5e401',
    fallbackIcon: 'sparkles-outline',
  },
  gaming: {
    backgroundColor: '#E8ECF4',
    iconUrl: 'https://www.figma.com/api/mcp/asset/1e0776e0-2f77-478e-b841-668af5b9f8eb',
    fallbackIcon: 'game-controller-outline',
  },
  fashion: {
    backgroundColor: '#F4E8F3',
    iconUrl: 'https://www.figma.com/api/mcp/asset/eaf6f119-1c48-4f75-8669-1a389fcd3a0a',
    fallbackIcon: 'shirt-outline',
  },
  nature: {
    backgroundColor: '#EAF4E8',
    iconUrl: 'https://www.figma.com/api/mcp/asset/243561c8-7e13-443d-8475-84034ca19581',
    fallbackIcon: 'leaf-outline',
  },
  arts: {
    backgroundColor: '#F4EEE8',
    fallbackIcon: 'color-palette-outline',
  },
  politics: {
    backgroundColor: '#ECEEF2',
    fallbackIcon: 'megaphone-outline',
  },
  gardening: {
    backgroundColor: '#ECF4E8',
    fallbackIcon: 'flower-outline',
  },
  movies: {
    backgroundColor: '#F4E8EA',
    fallbackIcon: 'film-outline',
  },
};

function BouncingDot({ delay }: { delay: number }) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateY, {
          toValue: -10,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [delay, translateY]);

  return <Animated.View style={[styles.overlayDot, { transform: [{ translateY }] }]} />;
}

function StepIndicator({ step }: { step: OnboardingStep }) {
  return (
    <View style={styles.stepIndicator}>
      <View style={[styles.stepBar, step === 'language' && styles.stepBarActive]} />
      <View style={[styles.stepDot, step === 'topics' && styles.stepDotActive]} />
    </View>
  );
}

function buildSelectedMeta(
  selectedTopics: string[],
  customTopics: CustomTopic[],
): { id: string; name: string; color: string }[] {
  return [
    ...TOPICS.filter((topic) => selectedTopics.includes(topic.id)).map((topic) => ({
      id: topic.id,
      name: topic.name,
      color: topic.color,
    })),
    ...customTopics.filter((topic) => selectedTopics.includes(topic.id)),
  ];
}

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ step?: string; returnTo?: string }>();
  const currentStep: OnboardingStep = params.step === 'topics' ? 'topics' : 'language';
  const returnToSettings = params.returnTo === 'settings';

  const [search, setSearch] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);

  const {
    hasCompletedOnboarding,
    selectedTopics,
    nativeLanguage,
    toggleTopicSelection,
    completeOnboarding,
    setNativeLanguage,
    fetchFeed,
    customTopics,
    addCustomTopic,
    removeCustomTopic,
  } = useAppStore();

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const searchTrimmed = search.trim();
  const searchLower = searchTrimmed.toLowerCase();

  const filteredTopics = useMemo(() => {
    if (!searchLower) return TOPICS;

    return TOPICS.filter((topic) => topic.name.toLowerCase().includes(searchLower));
  }, [searchLower]);

  const topicSuggestions = useMemo<TopicSuggestion[]>(() => {
    if (!searchLower) return [];

    const predefined = TOPICS
      .filter((topic) => topic.name.toLowerCase().includes(searchLower))
      .slice(0, 4)
      .map((topic) => ({
        id: topic.id,
        name: topic.name,
        source: 'predefined' as const,
        color: topic.color,
        isSelected: selectedTopics.includes(topic.id),
      }));

    const curated = NICHE_SUGGESTIONS
      .filter((topic) => topic.name.toLowerCase().includes(searchLower))
      .slice(0, 4)
      .map((topic) => ({
        id: topic.id,
        name: topic.name,
        source: 'curated' as const,
      }));

    return [...predefined, ...curated].slice(0, 6);
  }, [searchLower, selectedTopics]);

  const hasExactPredefinedMatch = TOPICS.some((topic) => topic.name.toLowerCase() === searchLower);
  const hasExactCuratedMatch = NICHE_SUGGESTIONS.some((topic) => topic.id === searchLower);
  const hasCustomMatch = customTopics.some((topic) => topic.id === searchLower);
  const canAddCustomTopic =
    searchTrimmed.length > 1 &&
    !hasExactPredefinedMatch &&
    !hasExactCuratedMatch &&
    !hasCustomMatch;

  const allSelectedMeta = useMemo(
    () => buildSelectedMeta(selectedTopics, customTopics),
    [customTopics, selectedTopics],
  );

  const handleAddCustomTopic = () => {
    if (!canAddCustomTopic) return;
    addCustomTopic(searchTrimmed);
    setSearch('');
  };

  const handleSuggestionTap = (suggestion: TopicSuggestion) => {
    if (suggestion.source === 'predefined') {
      toggleTopicSelection(suggestion.id);
      return;
    }

    addCustomTopic(suggestion.name);
    setSearch('');
  };

  const goToTopicsStep = () => {
    if (!nativeLanguage) return;

    router.push({
      pathname: '/onboarding',
      params: {
        step: 'topics',
        ...(returnToSettings ? { returnTo: 'settings' } : {}),
      },
    });
  };

  const handleComplete = async () => {
    if (!nativeLanguage || selectedTopics.length === 0) return;

    setIsBuilding(true);
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();

    completeOnboarding(selectedTopics, nativeLanguage);
    await fetchFeed();

    if (returnToSettings || hasCompletedOnboarding) {
      router.replace('/(tabs)/settings');
      return;
    }

    router.replace('/(tabs)');
  };

  const renderLanguageItem = ({ item }: { item: LanguageOption }) => {
    const isSelected = nativeLanguage === item.id;

    return (
      <TouchableOpacity
        style={[styles.languageCard, isSelected && styles.languageCardSelected]}
        onPress={() => setNativeLanguage(item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.languageCardLeft}>
          <Text style={styles.languageFlag}>{item.flag}</Text>
          <Text style={styles.languageTitle}>{item.label}</Text>
        </View>

        <View style={[styles.languageRadio, isSelected && styles.languageRadioSelected]}>
          {isSelected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTopicCard = ({ item }: { item: Topic }) => {
    const isSelected = selectedTopics.includes(item.id);
    const visual = TOPIC_VISUALS[item.id] ?? {
      backgroundColor: '#EEF1F5',
      fallbackIcon: 'grid-outline' as const,
    };

    return (
      <TouchableOpacity
        style={[
          styles.topicCard,
          { backgroundColor: visual.backgroundColor },
          isSelected && styles.topicCardSelected,
        ]}
        onPress={() => toggleTopicSelection(item.id)}
        activeOpacity={0.86}
      >
        <View style={styles.topicCardRow}>
          <View style={styles.topicIconWrap}>
            {visual.iconUrl ? (
              <Image source={{ uri: visual.iconUrl }} style={styles.topicIcon} resizeMode="contain" />
            ) : (
              <Ionicons name={visual.fallbackIcon} size={22} color={Colors.text} />
            )}
          </View>
          <Text style={styles.topicCardTitle}>{item.name}</Text>
        </View>

        {isSelected ? (
          <View style={styles.topicCheck}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (currentStep === 'language') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.screenInner}>
          <StepIndicator step="language" />

          <View style={styles.copyBlock}>
            <Text style={styles.title}>What’s your native language?</Text>
            <Text style={styles.subtitle}>
              We&apos;ll use this to help explain words you don&apos;t know
            </Text>
          </View>

          <FlatList
            data={NATIVE_LANGUAGE_OPTIONS}
            keyExtractor={(item) => item.id}
            renderItem={renderLanguageItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.languageList}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                !nativeLanguage && styles.primaryButtonDisabled,
              ]}
              onPress={goToTopicsStep}
              activeOpacity={0.88}
              disabled={!nativeLanguage}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.screenInner}>
        <StepIndicator step="topics" />

        <View style={styles.copyBlock}>
          <Text style={styles.title}>What are you interested in?</Text>
          <Text style={styles.subtitle}>
            Pick as many as you like, or add your own topics
          </Text>
        </View>

        <View style={styles.searchShell}>
          <Ionicons name="search-outline" size={20} color="#A6A6A6" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search or add a custom topic..."
            placeholderTextColor="#B3B3B3"
            style={styles.searchInput}
            returnKeyType="done"
            onSubmitEditing={handleAddCustomTopic}
          />
          {searchTrimmed.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#B3B3B3" />
            </TouchableOpacity>
          ) : null}
        </View>

        {canAddCustomTopic ? (
          <TouchableOpacity style={styles.addTopicChip} onPress={handleAddCustomTopic} activeOpacity={0.85}>
            <Ionicons name="add" size={16} color={BUTTON_COLOR} />
            <Text style={styles.addTopicChipText}>Add “{searchTrimmed}”</Text>
          </TouchableOpacity>
        ) : null}

        {topicSuggestions.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionScroll}
            contentContainerStyle={styles.suggestionRow}
            keyboardShouldPersistTaps="handled"
          >
            {topicSuggestions.map((suggestion) => {
              const isPredefined = suggestion.source === 'predefined';
              const isSelected = Boolean(suggestion.isSelected);

              return (
                <TouchableOpacity
                  key={`${suggestion.source}-${suggestion.id}`}
                  style={[
                    styles.suggestionChip,
                    isSelected && suggestion.color
                      ? {
                          borderColor: suggestion.color,
                          backgroundColor: `${suggestion.color}18`,
                        }
                      : null,
                  ]}
                  onPress={() => handleSuggestionTap(suggestion)}
                  activeOpacity={0.82}
                >
                  {isSelected && suggestion.color ? (
                    <Ionicons name="checkmark" size={12} color={suggestion.color} />
                  ) : null}
                  <Text
                    style={[
                      styles.suggestionChipText,
                      isSelected && suggestion.color ? { color: suggestion.color } : null,
                    ]}
                  >
                    {suggestion.name}
                  </Text>
                  {!isPredefined ? (
                    <Ionicons name="add" size={12} color={Colors.textSecondary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {customTopics.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.customTopicScroll}
            contentContainerStyle={styles.customTopicRow}
          >
            {customTopics.map((topic) => {
              const isSelected = selectedTopics.includes(topic.id);

              return (
                <View
                  key={topic.id}
                  style={[
                    styles.customTopicChip,
                    { borderColor: topic.color, backgroundColor: `${topic.color}18` },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.customTopicChipBody}
                    onPress={() => toggleTopicSelection(topic.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.customTopicDot, { backgroundColor: topic.color }]} />
                    <Text
                      style={[
                        styles.customTopicName,
                        { color: isSelected ? topic.color : Colors.textSecondary },
                      ]}
                    >
                      {topic.name}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => removeCustomTopic(topic.id)}
                    hitSlop={8}
                    style={styles.customTopicRemoveButton}
                  >
                    <Ionicons name="close" size={14} color={topic.color} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        <FlatList
          data={filteredTopics}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.topicRow}
          contentContainerStyle={[
            styles.topicGrid,
            searchTrimmed.length > 0 && styles.topicGridSearching,
            customTopics.length > 0 && styles.topicGridWithCustomTopics,
          ]}
          renderItem={renderTopicCard}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No matching topics yet</Text>
              <Text style={styles.emptyStateText}>
                Try a broader search or add a custom topic for your feed.
              </Text>
            </View>
          }
        />

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (selectedTopics.length === 0 || isBuilding) && styles.primaryButtonDisabled,
            ]}
            onPress={handleComplete}
            activeOpacity={0.88}
            disabled={selectedTopics.length === 0 || isBuilding}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isBuilding ? (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>SpeakEasy</Text>
            <View style={styles.overlayDots}>
              <BouncingDot delay={0} />
              <BouncingDot delay={140} />
              <BouncingDot delay={280} />
            </View>
            <Text style={styles.overlayMessage}>Building your feed…</Text>
            <Text style={styles.overlaySubMessage}>Personalizing content for your topics</Text>

            <View style={styles.overlayChipWrap}>
              {allSelectedMeta.map((topic) => (
                <View
                  key={topic.id}
                  style={[styles.overlayChip, { backgroundColor: `${topic.color}20` }]}
                >
                  <View style={[styles.overlayChipDot, { backgroundColor: topic.color }]} />
                  <Text style={[styles.overlayChipText, { color: topic.color }]}>{topic.name}</Text>
                </View>
              ))}
            </View>

            <ActivityIndicator color={BUTTON_COLOR} style={styles.overlaySpinner} />
          </View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenInner: {
    flex: 1,
    paddingHorizontal: 22,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    paddingBottom: 28,
  },
  stepBar: {
    width: 28,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D6D6D6',
  },
  stepBarActive: {
    backgroundColor: '#8B8B8B',
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D6D6D6',
  },
  stepDotActive: {
    width: 28,
    backgroundColor: '#8B8B8B',
  },
  copyBlock: {
    paddingBottom: 18,
  },
  title: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '500',
    color: '#050505',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(0,0,0,0.5)',
    maxWidth: 228,
  },
  languageList: {
    paddingTop: 14,
    paddingBottom: 20,
    gap: 12,
  },
  languageCard: {
    minHeight: 53,
    borderRadius: 35,
    backgroundColor: SOFT_BEIGE,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageCardSelected: {
    backgroundColor: 'rgba(195,181,129,0.3)',
  },
  languageCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  languageFlag: {
    fontSize: 17,
  },
  languageTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: Colors.text,
  },
  languageRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E0DED6',
    backgroundColor: '#FFFFFFAA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageRadioSelected: {
    borderColor: SELECTED_CHIP,
    backgroundColor: SELECTED_CHIP,
  },
  searchShell: {
    minHeight: 53,
    borderRadius: 35,
    backgroundColor: SEARCH_BG,
    paddingHorizontal: 18,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 14,
  },
  addTopicChip: {
    marginTop: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F0ECDC',
  },
  addTopicChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: BUTTON_COLOR,
  },
  suggestionScroll: {
    marginTop: 2,
    marginHorizontal: -2,
  },
  suggestionRow: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#FFFFFF',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  suggestionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  customTopicRow: {
    alignItems: 'center',
    minHeight: 54,
    gap: 10,
    paddingTop: 6,
    paddingBottom: 10,
    paddingRight: 6,
  },
  customTopicScroll: {
    minHeight: 54,
    marginBottom: 10,
  },
  customTopicChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 42,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
  },
  customTopicChipBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  customTopicDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  customTopicName: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 24,
    maxWidth: 170,
  },
  customTopicRemoveButton: {
    marginLeft: 4,
  },
  topicGrid: {
    paddingTop: 16,
    paddingBottom: 18,
    gap: 10,
  },
  topicGridSearching: {
    paddingTop: 6,
  },
  topicGridWithCustomTopics: {
    paddingTop: 8,
  },
  topicRow: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  topicCard: {
    width: '48.6%',
    minHeight: 68,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 15,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  topicCardSelected: {
    borderColor: BUTTON_COLOR,
  },
  topicCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topicIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicIcon: {
    width: 28,
    height: 28,
  },
  topicCardTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: Colors.text,
  },
  topicCheck: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SELECTED_CHIP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 16,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  emptyStateText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 18,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: BUTTON_DISABLED,
  },
  primaryButtonText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  overlayCard: {
    width: '100%',
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 10,
  },
  overlayTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  overlayDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 18,
  },
  overlayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BUTTON_COLOR,
  },
  overlayMessage: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  overlaySubMessage: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  overlayChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  overlayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  overlayChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  overlayChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  overlaySpinner: {
    marginTop: 20,
  },
});
