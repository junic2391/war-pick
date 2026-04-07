import { Tabs } from 'expo-router';
import React from 'react';

import { Colors } from '@/constants/theme';
import { WarPickFeedProvider } from '@/lib/war-pick-feed';

export default function TabLayout() {
  return (
    <WarPickFeedProvider>
      <Tabs
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          sceneStyle: {
            backgroundColor: Colors.dark.background,
          },
          tabBarStyle: {
            display: 'none',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: '홈',
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </WarPickFeedProvider>
  );
}
