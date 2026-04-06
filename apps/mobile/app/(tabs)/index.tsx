import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getDirectionColor,
  getDirectionLabel,
  getRelativeTimeLabel,
  getRiskColor,
  getRiskLabel,
} from '@/lib/war-pick-data';
import { useWarPickFeed } from '@/lib/war-pick-feed';

export default function FeedScreen() {
  const { featuredEvent, riskEvents, runtimeConfig, totalImpacts } = useWarPickFeed();
  const lastRefreshLabel = runtimeConfig.lastRefreshAt
    ? new Date(runtimeConfig.lastRefreshAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'not yet';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>WAR-PICK</Text>
          <Text style={styles.title}>Investor Signal Feed</Text>
          <Text style={styles.subtitle}>
            재설치된 Expo 앱 위에 현재 세션 기준의 피드 구조를 다시 세운 상태입니다.
          </Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{runtimeConfig.diagnosticsLabel}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Feed Diagnostics</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Env configured</Text>
          <Text style={styles.metricValue}>{runtimeConfig.envConfigured ? 'yes' : 'no'}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Current source</Text>
          <Text style={styles.metricValue}>{runtimeConfig.currentSource}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Live connection</Text>
          <Text style={styles.metricValue}>
            {runtimeConfig.liveDataConnected ? 'connected' : 'fallback'}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Seed coverage</Text>
          <Text style={styles.metricValue}>
            {riskEvents.length} events / {totalImpacts} impacts
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Refresh count</Text>
          <Text style={styles.metricValue}>{runtimeConfig.refreshCount}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Last sync</Text>
          <Text style={styles.metricValue}>{lastRefreshLabel}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Last realtime event</Text>
          <Text style={styles.metricValue}>{runtimeConfig.lastRealtimeEvent ?? 'none'}</Text>
        </View>
        {runtimeConfig.lastError ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorLabel}>Last error</Text>
            <Text style={styles.errorValue}>{runtimeConfig.lastError}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Selected Asset Impact</Text>
        <View style={styles.featuredHeader}>
          <Text style={styles.featuredTitle}>{featuredEvent.title}</Text>
          <View
            style={[
              styles.riskBadge,
              {
                borderColor: getRiskColor(featuredEvent.riskLevel),
                backgroundColor: `${getRiskColor(featuredEvent.riskLevel)}22`,
              },
            ]}>
            <Text style={[styles.riskBadgeText, { color: getRiskColor(featuredEvent.riskLevel) }]}>
              {getRiskLabel(featuredEvent.riskLevel)}
            </Text>
          </View>
        </View>
        <Text style={styles.featuredSummary}>{featuredEvent.summary}</Text>
        {featuredEvent.impacts.map((impact) => (
          <View key={impact.id} style={styles.impactCard}>
            <View style={styles.impactHeader}>
              <View>
                <Text style={styles.impactTitle}>
                  {impact.assetCode} · {impact.assetName}
                </Text>
                <Text style={styles.impactMeta}>confidence {(impact.confidence * 100).toFixed(0)}%</Text>
              </View>
              <Text style={[styles.impactMove, { color: getDirectionColor(impact.direction) }]}>
                {impact.moveHint} · {getDirectionLabel(impact.direction)}
              </Text>
            </View>
            <Text style={styles.impactBody}>{impact.rationale}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Event Feed</Text>
        {riskEvents.map((event) => (
          <View key={event.id} style={styles.feedRow}>
            <View style={[styles.feedDot, { backgroundColor: getRiskColor(event.riskLevel) }]} />
            <View style={styles.feedBody}>
              <View style={styles.feedHeader}>
                <Text style={styles.feedTitle}>{event.title}</Text>
                <Text style={styles.feedTime}>{getRelativeTimeLabel(event.occurredAt)}</Text>
              </View>
              <Text style={styles.feedMeta}>
                {event.regionName} · {event.eventType} · {event.verificationStatus}
              </Text>
              <Text style={styles.feedSummary}>{event.summary}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#06131f',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 16,
  },
  headerRow: {
    gap: 12,
  },
  eyebrow: {
    color: '#7fd4ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#edf3fb',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: '#9bb1c4',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#0e2638',
    borderColor: '#1e4663',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillText: {
    color: '#d8e5f2',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0b1f30',
    borderColor: '#17364a',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    color: '#edf3fb',
    fontSize: 18,
    fontWeight: '700',
  },
  metricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: '#9bb1c4',
    fontSize: 14,
  },
  metricValue: {
    color: '#edf3fb',
    fontSize: 14,
    fontWeight: '700',
  },
  errorPanel: {
    backgroundColor: '#081521',
    borderColor: '#17364a',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  errorLabel: {
    color: '#ffbe5c',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  errorValue: {
    color: '#c6d6e6',
    fontSize: 13,
    lineHeight: 18,
  },
  featuredHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  featuredTitle: {
    color: '#edf3fb',
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
  riskBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  featuredSummary: {
    color: '#c6d6e6',
    fontSize: 15,
    lineHeight: 22,
  },
  impactCard: {
    backgroundColor: '#081521',
    borderRadius: 18,
    gap: 8,
    padding: 14,
  },
  impactHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  impactTitle: {
    color: '#edf3fb',
    fontSize: 15,
    fontWeight: '700',
  },
  impactMeta: {
    color: '#7f94a8',
    fontSize: 12,
    marginTop: 4,
  },
  impactMove: {
    fontSize: 13,
    fontWeight: '800',
  },
  impactBody: {
    color: '#c6d6e6',
    fontSize: 14,
    lineHeight: 20,
  },
  feedRow: {
    flexDirection: 'row',
    gap: 12,
  },
  feedDot: {
    borderRadius: 999,
    height: 10,
    marginTop: 8,
    width: 10,
  },
  feedBody: {
    flex: 1,
    gap: 6,
    paddingBottom: 10,
  },
  feedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  feedTitle: {
    color: '#edf3fb',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  feedTime: {
    color: '#7f94a8',
    fontSize: 12,
    fontWeight: '600',
  },
  feedMeta: {
    color: '#7fd4ff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  feedSummary: {
    color: '#b4c4d4',
    fontSize: 14,
    lineHeight: 20,
  },
});
