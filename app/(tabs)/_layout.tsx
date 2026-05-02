import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

type IoniconsName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, activeName, color, focused, size }: {
  name: IoniconsName;
  activeName: IoniconsName;
  color: string;
  focused: boolean;
  size: number;
}) {
  return (
    <View style={styles.iconWrapper}>
      <Ionicons name={focused ? activeName : name} size={size} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabBar.active,
        tabBarInactiveTintColor: Colors.tabBar.inactive,
        tabBarStyle: [styles.tabBar, {
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
        }],
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="home-outline" activeName="home" color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="bookmark-outline" activeName="bookmark" color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="settings-outline" activeName="settings" color={color} focused={focused} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBar.background,
    borderTopColor: Colors.tabBar.border,
    borderTopWidth: 1,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
