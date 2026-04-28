import React from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { consumePendingSubscriptionIntent } from '@/services/subscriptionService';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  const { clearAuthError, error, handleAuthRedirect, isLoading, session, user } = useAuthStore();
  const handledUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    clearAuthError();

    const confirmFromUrl = async () => {
      const nextUrl = url ?? (await Linking.getInitialURL());
      if (!nextUrl || handledUrlRef.current === nextUrl) return;

      handledUrlRef.current = nextUrl;
      await handleAuthRedirect(nextUrl);
    };

    void confirmFromUrl();
  }, [clearAuthError, handleAuthRedirect, url]);

  React.useEffect(() => {
    if (user || session?.user) {
      const routeAfterConfirmation = async () => {
        const pendingIntent = await consumePendingSubscriptionIntent();
        if (pendingIntent) {
          router.replace({
            pathname: '/subscription',
            params: {
              intent: pendingIntent.intent,
              planId: pendingIntent.planId,
            },
          });
          return;
        }

        router.replace('/(tabs)/settings');
      };

      void routeAfterConfirmation();
    }
  }, [session?.user, user]);

  const hasAuthenticated = Boolean(user || session?.user);
  const visibleError = hasAuthenticated ? null : error;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          {visibleError ? (
            <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
          ) : (
            <Ionicons name="mail-open-outline" size={34} color={Colors.accent} />
          )}
        </View>

        <Text style={styles.title}>
          {visibleError ? 'Confirmation failed' : 'Confirming your email'}
        </Text>
        <Text style={styles.subtitle}>
          {visibleError
            ? visibleError
            : 'Hang tight while SpeakEasy finishes signing you in.'}
        </Text>

        {isLoading && !visibleError ? (
          <ActivityIndicator color={Colors.accent} style={styles.loader} />
        ) : null}

        {visibleError ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/auth' as any)}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>Back to sign in</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  loader: {
    marginTop: 24,
    alignSelf: 'flex-start',
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5C5A35',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
