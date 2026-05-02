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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { consumePendingSubscriptionIntent } from '@/services/subscriptionService';
import {
  AUTH_CONFIRMATION_SIGN_IN_REQUIRED,
  useAuthStore,
} from '@/store/useAuthStore';

function stringifyParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildCallbackUrlFromParams(params: Record<string, string | string[] | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const nextValue = stringifyParam(value);
    if (nextValue) {
      searchParams.set(key, nextValue);
    }
  });

  const query = searchParams.toString();
  return query ? `speakeasy://auth-callback?${query}` : null;
}

export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  const routeParams = useLocalSearchParams();
  const { clearAuthError, error, handleAuthRedirect, isLoading, session, user } = useAuthStore();
  const handledUrlRef = React.useRef<string | null>(null);
  const hasRoutedRef = React.useRef(false);
  const callbackUrlFromParams = React.useMemo(
    () => buildCallbackUrlFromParams(routeParams as Record<string, string | string[] | undefined>),
    [routeParams],
  );

  const routeAfterConfirmation = React.useCallback(async () => {
    if (hasRoutedRef.current) return;
    hasRoutedRef.current = true;

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
  }, []);

  React.useEffect(() => {
    clearAuthError();
  }, [clearAuthError]);

  React.useEffect(() => {
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const handleCallbackUrl = async (urlToHandle: string) => {
      if (handledUrlRef.current === urlToHandle) return;
      handledUrlRef.current = urlToHandle;

      const didConfirm = await handleAuthRedirect(urlToHandle);
      if (didConfirm) {
        await routeAfterConfirmation();
      }
    };

    const confirmFromUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      const nextUrl = url ?? initialUrl ?? callbackUrlFromParams;
      if (nextUrl) {
        await handleCallbackUrl(nextUrl);
        return;
      }

      fallbackTimer = setTimeout(() => {
        void handleCallbackUrl('speakeasy://auth-callback');
      }, 900);
    };

    void confirmFromUrl();

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [callbackUrlFromParams, handleAuthRedirect, routeAfterConfirmation, url]);

  React.useEffect(() => {
    if (user || session?.user) {
      void routeAfterConfirmation();
    }
  }, [routeAfterConfirmation, session?.user, user]);

  const hasAuthenticated = Boolean(user || session?.user);
  const needsSignIn = !hasAuthenticated && error === AUTH_CONFIRMATION_SIGN_IN_REQUIRED;
  const visibleError = hasAuthenticated || needsSignIn ? null : error;
  const iconName = needsSignIn ? 'checkmark-circle-outline' : visibleError ? 'alert-circle-outline' : 'mail-open-outline';
  const iconColor = needsSignIn ? Colors.accent : visibleError ? Colors.error : Colors.accent;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name={iconName} size={visibleError ? 36 : 34} color={iconColor} />
        </View>

        <Text style={styles.title}>
          {visibleError ? 'Confirmation failed' : needsSignIn ? 'Email confirmed' : 'Confirming your email'}
        </Text>
        <Text style={styles.subtitle}>
          {visibleError
            ? visibleError
            : needsSignIn
              ? AUTH_CONFIRMATION_SIGN_IN_REQUIRED
            : 'Hang tight while SpeakEasy finishes signing you in.'}
        </Text>

        {isLoading && !visibleError ? (
          <ActivityIndicator color={Colors.accent} style={styles.loader} />
        ) : null}

        {visibleError || needsSignIn ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/auth' as any)}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>{needsSignIn ? 'Sign in' : 'Back to sign in'}</Text>
          </TouchableOpacity>
        ) : null}

        {!isLoading && !visibleError && !needsSignIn && !hasAuthenticated ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={async () => {
              const didConfirm = await handleAuthRedirect('speakeasy://auth-callback');
              if (didConfirm) {
                await routeAfterConfirmation();
              }
            }}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
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
