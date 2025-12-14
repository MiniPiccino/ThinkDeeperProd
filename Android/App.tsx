import React, {useState} from 'react';
import {Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {FocusTools} from './src/screens/FocusTools';
import {Pricing} from './src/screens/Pricing';

const queryClient = new QueryClient();

type TabKey = 'focus' | 'pricing';

const tabs: Array<{key: TabKey; label: string; icon: string}> = [
  {key: 'focus', label: 'Focus tools', icon: '🎯'},
  {key: 'pricing', label: 'Pricing', icon: '💎'},
];

function App(): React.JSX.Element {
  const [selectedTab, setSelectedTab] = useState<TabKey>('focus');

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <SafeAreaView style={styles.shell}>
        <View style={styles.contentArea}>
          {selectedTab === 'focus' ? <FocusTools /> : <Pricing />}
        </View>
        <View style={styles.navBar}>
          {tabs.map(tab => {
            const isActive = tab.key === selectedTab;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setSelectedTab(tab.key)}
                style={({pressed}) => [
                  styles.navItem,
                  pressed && styles.navItemPressed,
                ]}>
                <View
                  style={[
                    styles.navIconBadge,
                    isActive && styles.navIconBadgeActive,
                  ]}>
                  <Text
                    style={[
                      styles.navIcon,
                      isActive && styles.navIconActive,
                    ]}>
                    {tab.icon}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.navLabel,
                    isActive && styles.navLabelActive,
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </QueryClientProvider>
  );
}

export default App;

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  contentArea: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(15,23,42,0.96)',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  navItemPressed: {
    opacity: 0.85,
    transform: [{scale: 0.98}],
  },
  navIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  navIconBadgeActive: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderColor: 'rgba(52,211,153,0.5)',
  },
  navIcon: {
    fontSize: 18,
  },
  navIconActive: {
    fontSize: 20,
  },
  navLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: '#34d399',
    fontWeight: '700',
  },
});
