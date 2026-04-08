import * as MapLibreRN from '@maplibre/maplibre-react-native';
import { DarkTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

const warPickTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#06131f',
    border: '#17364a',
    card: '#0b1f30',
    notification: '#ff6b3d',
    primary: '#ff6b3d',
    text: '#edf3fb',
  },
};

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    MapLibreRN.Logger.setLogCallback((log) => {
      return log.level === 'warning' && log.message.includes('Invalid geometry in line layer');
    });

    return () => {
      MapLibreRN.Logger.setLogCallback(() => false);
    };
  }, []);

  return (
    <ThemeProvider value={warPickTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#06131f' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
