import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getPinPosition,
  getRelativeTimeLabel,
  getRiskColor,
  getRiskLabel,
} from '@/lib/war-pick-data';
import { useWarPickFeed } from '@/lib/war-pick-feed';

export default function RadarScreen() {
  const { featuredEvent, latestEvent, riskEvents, runtimeConfig } = useWarPickFeed();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>Map-first landing</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{runtimeConfig.diagnosticsLabel}</Text>
          </View>
        </View>
        <Text style={styles.title}>Global conflict radar for market-sensitive signals.</Text>
        <Text style={styles.subtitle}>
          전체 지형보다 핫스팟과 파급 자산을 먼저 보여주는, 최소 분석 도구 톤의 랜딩으로 복구했습니다.
        </Text>
      </View>

      <View style={styles.mapCard}>
        <View style={styles.gridHorizontalTop} />
        <View style={styles.gridHorizontalBottom} />
        <View style={styles.gridVerticalLeft} />
        <View style={styles.gridVerticalRight} />

        {riskEvents.map((event) => {
          const pinPosition = getPinPosition(event.latitude, event.longitude);
          const color = getRiskColor(event.riskLevel);
          const isFeatured = event.id === featuredEvent.id;

          return (
            <View
              key={event.id}
              style={[
                styles.pinWrap,
                {
                  left: pinPosition.left,
                  top: pinPosition.top,
                },
              ]}>
              <View
                style={[
                  styles.pinAura,
                  {
                    backgroundColor: `${color}20`,
                    borderColor: `${color}55`,
                    height: isFeatured ? 72 : 54,
                    width: isFeatured ? 72 : 54,
                  },
                ]}
              />
              <View style={[styles.pinCore, { backgroundColor: color }]} />
              <Text style={styles.pinLabel}>{event.regionName}</Text>
            </View>
          );
        })}

        <View style={styles.mapHudTop}>
          <Text style={styles.mapHudLabel}>WORLD OVERVIEW</Text>
          <Text style={styles.mapHudValue}>{riskEvents.length} hotspots tracked</Text>
        </View>
        <View style={styles.mapHudBottom}>
          <Text style={styles.mapHudLabel}>LATEST EVENT</Text>
          <Text style={styles.mapHudHeadline}>{latestEvent.title}</Text>
          <Text style={styles.mapHudCopy}>
            {getRelativeTimeLabel(latestEvent.occurredAt)} · {latestEvent.summary}
          </Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryEyebrow}>Priority summary</Text>
            <Text style={styles.summaryTitle}>{featuredEvent.title}</Text>
          </View>
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
        <Text style={styles.summaryCopy}>{featuredEvent.summary}</Text>
        <Text style={styles.summaryMeta}>
          {featuredEvent.regionName} · {featuredEvent.eventType} · {featuredEvent.verificationStatus}
        </Text>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>Rebuild queue</Text>
        <View style={styles.timelineItem}>
          <Text style={styles.timelineStep}>1</Text>
          <Text style={styles.timelineCopy}>Supabase client 연결 및 `risk_events` 실조회</Text>
        </View>
        <View style={styles.timelineItem}>
          <Text style={styles.timelineStep}>2</Text>
          <Text style={styles.timelineCopy}>MapLibre 기반 실제 지도 캔버스로 교체</Text>
        </View>
        <View style={styles.timelineItem}>
          <Text style={styles.timelineStep}>3</Text>
          <Text style={styles.timelineCopy}>선택 이벤트와 asset impact 패널을 bottom sheet로 분리</Text>
        </View>
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
    gap: 18,
  },
  header: {
    gap: 12,
  },
  kickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: {
    color: '#7fd4ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pill: {
    backgroundColor: '#0e2638',
    borderColor: '#1e4663',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: {
    color: '#d8e5f2',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#edf3fb',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  subtitle: {
    color: '#9bb1c4',
    fontSize: 15,
    lineHeight: 22,
  },
  mapCard: {
    backgroundColor: '#081521',
    borderColor: '#17364a',
    borderRadius: 30,
    borderWidth: 1,
    height: 410,
    overflow: 'hidden',
    position: 'relative',
  },
  gridHorizontalTop: {
    backgroundColor: '#16344b',
    height: 1,
    left: 24,
    opacity: 0.5,
    position: 'absolute',
    right: 24,
    top: '33%',
  },
  gridHorizontalBottom: {
    backgroundColor: '#16344b',
    height: 1,
    left: 24,
    opacity: 0.3,
    position: 'absolute',
    right: 24,
    top: '62%',
  },
  gridVerticalLeft: {
    backgroundColor: '#16344b',
    bottom: 40,
    left: '32%',
    opacity: 0.3,
    position: 'absolute',
    top: 40,
    width: 1,
  },
  gridVerticalRight: {
    backgroundColor: '#16344b',
    bottom: 40,
    left: '66%',
    opacity: 0.2,
    position: 'absolute',
    top: 40,
    width: 1,
  },
  pinWrap: {
    alignItems: 'center',
    position: 'absolute',
    transform: [{ translateX: -18 }, { translateY: -18 }],
  },
  pinAura: {
    borderRadius: 999,
    borderWidth: 1,
    position: 'absolute',
  },
  pinCore: {
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    height: 14,
    marginTop: 20,
    width: 14,
  },
  pinLabel: {
    color: '#edf3fb',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
  },
  mapHudTop: {
    left: 18,
    position: 'absolute',
    top: 18,
  },
  mapHudBottom: {
    backgroundColor: '#0b1f30ee',
    borderTopColor: '#17364a',
    borderTopWidth: 1,
    bottom: 0,
    gap: 6,
    left: 0,
    paddingHorizontal: 18,
    paddingVertical: 16,
    position: 'absolute',
    right: 0,
  },
  mapHudLabel: {
    color: '#7fd4ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mapHudValue: {
    color: '#edf3fb',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  mapHudHeadline: {
    color: '#edf3fb',
    fontSize: 18,
    fontWeight: '800',
  },
  mapHudCopy: {
    color: '#b4c4d4',
    fontSize: 14,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#0b1f30',
    borderColor: '#17364a',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  summaryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryEyebrow: {
    color: '#7fd4ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryTitle: {
    color: '#edf3fb',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
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
    letterSpacing: 0.5,
  },
  summaryCopy: {
    color: '#c6d6e6',
    fontSize: 15,
    lineHeight: 22,
  },
  summaryMeta: {
    color: '#9bb1c4',
    fontSize: 13,
    fontWeight: '600',
  },
  timelineCard: {
    backgroundColor: '#07111b',
    borderColor: '#17364a',
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  timelineTitle: {
    color: '#edf3fb',
    fontSize: 18,
    fontWeight: '700',
  },
  timelineItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  timelineStep: {
    color: '#06131f',
    backgroundColor: '#7fd4ff',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timelineCopy: {
    color: '#c6d6e6',
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
