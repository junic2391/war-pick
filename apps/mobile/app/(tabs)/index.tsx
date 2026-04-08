import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as MapLibreRN from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  type ContentLocale,
  type LocalizedBriefingBlock,
  getDirectionColor,
  getDirectionLabel,
  getEventDirectionColor,
  getEventDirectionLabel,
  getEventTypeCode,
  getEventTypeColor,
  getEventTypeLabel,
  getImportanceLabel,
  getMarketSentimentLabel,
  getLocalizedEventSummary,
  getLocalizedEventTitle,
  getRelativeTimeLabel,
  getRiskColor,
  getRiskLabel,
  getVerificationStatusLabel,
  getWebEnrichmentStatusLabel,
} from '@/lib/war-pick-data';
import {
  getLocalizedMapStyle,
  type MapLabelLocale,
  type MapStyleProvider,
} from '@/lib/map-style';
import { fetchEventBriefing, useWarPickFeed } from '@/lib/war-pick-feed';

const MAP_EVENTS_SOURCE_ID = 'war-pick-events';

const markerHaloLayerStyle = {
  circleRadius: ['match', ['get', 'importanceBucket'], 'critical', 28, 'high', 24, 'medium', 20, 17],
  circleColor: [
    'match',
    ['get', 'riskLevel'],
    'critical',
    'rgba(255, 77, 79, 0.12)',
    'high',
    'rgba(255, 139, 94, 0.12)',
    'medium',
    'rgba(255, 190, 92, 0.11)',
    'rgba(127, 212, 255, 0.1)',
  ],
  circleStrokeWidth: 1,
  circleStrokeColor: [
    'match',
    ['get', 'riskLevel'],
    'critical',
    'rgba(255, 77, 79, 0.4)',
    'high',
    'rgba(255, 139, 94, 0.37)',
    'medium',
    'rgba(255, 190, 92, 0.31)',
    'rgba(127, 212, 255, 0.27)',
  ],
  circleOpacity: 1,
  circleSortKey: ['get', 'importanceScore'],
} as const;

const markerDirectionRingLayerStyle = {
  circleRadius: ['match', ['get', 'importanceBucket'], 'critical', 18, 'high', 16, 'medium', 13, 11],
  circleColor: '#081015',
  circleStrokeWidth: 2.5,
  circleStrokeColor: ['get', 'directionColor'],
  circleOpacity: 0.98,
  circleSortKey: ['get', 'importanceScore'],
} as const;

const markerCoreLayerStyle = {
  circleRadius: ['match', ['get', 'importanceBucket'], 'critical', 12, 'high', 11, 'medium', 9, 8],
  circleColor: ['get', 'eventTypeColor'],
  circleStrokeWidth: 3,
  circleStrokeColor: '#071117',
  circleOpacity: 1,
  circleSortKey: ['get', 'importanceScore'],
} as const;

const selectedMarkerRingStyle = {
  circleRadius: ['match', ['get', 'importanceBucket'], 'critical', 33, 'high', 30, 'medium', 26, 22],
  circleColor: '#00000000',
  circleStrokeWidth: 2,
  circleStrokeColor: '#f2ead8',
  circleOpacity: 0.95,
} as const;

function getMapLegend(locale: ContentLocale) {
  return [
    {
      label: locale === 'en' ? 'Size' : '크기',
      value: locale === 'en' ? 'Importance' : '중요도',
      tone: '#ffbe5c',
    },
    {
      label: locale === 'en' ? 'Ring' : '링',
      value: locale === 'en' ? 'Direction' : '방향',
      tone: '#ff5b55',
    },
    {
      label: locale === 'en' ? 'Core' : '코어',
      value: locale === 'en' ? 'Type' : '유형',
      tone: '#4cb4b8',
    },
  ] as const;
}

function summarizeListCount(label: string, count: number) {
  return count > 0 ? `${label} ${count}건` : null;
}

function clampSentence(value: string, maxLength = 96) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function stripAiPrefix(value: string) {
  return value.replace(/^AI 해석:\s*/i, '').trim();
}

function formatNumericFactMeta(
  numericFact:
    | {
        label: string;
        value: number;
        unit?: string;
        asOfDate?: string;
      }
    | undefined,
) {
  if (!numericFact) {
    return null;
  }

  const parts = [
    `${numericFact.label} ${numericFact.value}${numericFact.unit ? ` ${numericFact.unit}` : ''}`,
    numericFact.asOfDate,
  ].filter(Boolean);

  return parts.join(' · ');
}

function isPlaceholderNarrative(value: string) {
  return value.includes('아직 없습니다.') || value.includes('아직 도착하지 않았습니다.');
}

const screenCopy = {
  ko: {
    brandCaption: '지정학 리스크 레이더',
    languageKo: '한글',
    languageEn: 'ENG',
    ingestIdle: 'RSS 수집',
    ingestRunning: '수집 중',
    refreshIdle: '동기화',
    refreshRunning: '동기화 중',
    hotspot: '핫스팟',
    feedStatus: '피드 상태',
    mapProvider: '지도 공급자',
    lastSync: '마지막 동기화',
    rssIngest: 'RSS 수집',
    lastIngest: '최근 수집',
    sheetHint: '지도는 계속 보이고, 브리핑만 아래에서 확장됩니다.',
    close: '닫기',
    compactView: '간략 보기',
    expandedView: '자세히 보기',
    summary: '요약',
    signals: '핵심 신호',
    assets: '자산 반응',
    aiBriefing: 'AI 브리핑',
    confirmedFact: '확인된 사실',
    marketInsight: '시장 해석',
    uncertainty: '불확실성',
    scenario: '기본 시나리오',
    detailContext: '보조 맥락',
    actorsTargets: '행위 주체 / 대상',
    macroPath: '거시 경로',
    webStatus: '웹 보강',
    noAssets: '연결된 자산이 아직 없습니다.',
    noBriefing: '브리핑 생성 중입니다.',
    noDetail: '세부 브리핑 생성 중입니다. 현재는 헤드라인, 요약, 자산 연결 신호를 우선 보여줍니다.',
    selectionHintLabel: '지도 브리핑',
    selectionHintText: '마커를 탭하면 필수 정보와 자산 반응이 먼저 열립니다.',
    selectionHintMuted: '상세 맥락은 하단 시트를 확장해 확인할 수 있습니다.',
    sourceCount: (count: number) => `출처 ${count}개`,
    webEnriched: '웹 보강 반영',
    briefingError: '브리핑을 불러오지 못해 저장된 요약을 표시합니다.',
    validation: '검증',
    sentiment: '심리',
  },
  en: {
    brandCaption: 'Geopolitical Risk Radar',
    languageKo: 'KOR',
    languageEn: 'ENG',
    ingestIdle: 'Ingest RSS',
    ingestRunning: 'Ingesting',
    refreshIdle: 'Refresh',
    refreshRunning: 'Refreshing',
    hotspot: 'Hotspots',
    feedStatus: 'Feed',
    mapProvider: 'Map',
    lastSync: 'Last sync',
    rssIngest: 'RSS',
    lastIngest: 'Last ingest',
    sheetHint: 'Keep the map visible and expand the briefing from below.',
    close: 'Close',
    compactView: 'Compact',
    expandedView: 'Expand',
    summary: 'Summary',
    signals: 'Signals',
    assets: 'Asset reaction',
    aiBriefing: 'AI briefing',
    confirmedFact: 'Confirmed fact',
    marketInsight: 'Market insight',
    uncertainty: 'Uncertainty',
    scenario: 'Base case',
    detailContext: 'Context',
    actorsTargets: 'Actors / targets',
    macroPath: 'Macro path',
    webStatus: 'Web status',
    noAssets: 'No linked assets yet.',
    noBriefing: 'Briefing is being prepared.',
    noDetail: 'Detailed briefing is still being prepared. Headline, summary, and asset signals are shown first.',
    selectionHintLabel: 'Map briefing',
    selectionHintText: 'Tap a marker to open the essential event brief first.',
    selectionHintMuted: 'Expand the bottom sheet for extra context and scenarios.',
    sourceCount: (count: number) => `${count} sources`,
    webEnriched: 'Web enriched',
    briefingError: 'Briefing fetch failed, showing saved summary instead.',
    validation: 'Verify',
    sentiment: 'Sentiment',
  },
} as const;

function buildFallbackBriefing(
  locale: ContentLocale,
  selectedEvent: ReturnType<typeof useWarPickFeed>['riskEvents'][number],
): LocalizedBriefingBlock {
  const copy = screenCopy[locale];
  const fact = selectedEvent.facts[0]?.claim ?? copy.noBriefing;
  const insight = selectedEvent.inferences[0]
    ? stripAiPrefix(selectedEvent.inferences[0])
    : selectedEvent.thesis;
  const uncertainty = selectedEvent.contradictions[0]?.description;
  const meta = [
    copy.sourceCount(selectedEvent.sourceCount),
    getVerificationStatusLabel(selectedEvent.verificationStatus, locale),
    selectedEvent.webEnriched ? copy.webEnriched : null,
  ].filter(Boolean).join(' · ');

  return {
    fact,
    insight,
    uncertainty,
    scenarioBase: isPlaceholderNarrative(selectedEvent.scenarioBase) ? undefined : selectedEvent.scenarioBase,
    meta,
  };
}

function getMarkerTypeLabelLayerStyle(mapProvider: MapStyleProvider) {
  return {
    textField: ['get', 'eventTypeCode'],
    textFont: mapProvider === 'openfreemap' ? ['Noto Sans Bold'] : ['Open Sans Semibold'],
    textSize: ['match', ['get', 'importanceBucket'], 'critical', 10, 'high', 10, 'medium', 9, 8],
    textColor: '#fff8ed',
    textHaloColor: '#061015',
    textHaloWidth: 0.8,
    textAllowOverlap: true,
    textIgnorePlacement: true,
    symbolSortKey: ['get', 'importanceScore'],
  } as const;
}

export default function HomeScreen() {
  const { isIngesting, isRefreshing, refreshLive, riskEvents, runIngest, runtimeConfig } =
    useWarPickFeed();
  const insets = useSafeAreaInsets();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mapLabelLocale, setMapLabelLocale] = useState<MapLabelLocale>('ko');
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [detailBriefing, setDetailBriefing] = useState<LocalizedBriefingBlock | null>(null);
  const [detailBriefingStatus, setDetailBriefingStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [mapStyle, setMapStyle] = useState<string | object>(MapLibreRN.StyleURL.Default);
  const [mapProvider, setMapProvider] = useState<MapStyleProvider>('maplibre-demo');
  const [mapProviderLabel, setMapProviderLabel] = useState('지도 공급자 확인 중');
  const [mapLoadStatusLabel, setMapLoadStatusLabel] = useState<string | null>(null);
  const contentLocale = mapLabelLocale as ContentLocale;
  const copy = screenCopy[contentLocale];

  useEffect(() => {
    setSelectedEventId((currentId) =>
      currentId && riskEvents.some((event) => event.id === currentId) ? currentId : null,
    );
  }, [riskEvents]);

  const selectedEvent = riskEvents.find((event) => event.id === selectedEventId) ?? null;
  const selectedTitle = selectedEvent ? getLocalizedEventTitle(selectedEvent, contentLocale) : '';
  const selectedSummary = selectedEvent ? getLocalizedEventSummary(selectedEvent, contentLocale) : '';
  const storedLocalizedBriefing = selectedEvent?.localizedBriefing?.[contentLocale] ?? null;
  const effectiveBriefing = detailBriefing ?? storedLocalizedBriefing ?? (selectedEvent ? buildFallbackBriefing(contentLocale, selectedEvent) : null);

  useEffect(() => {
    if (!selectedEvent) {
      setDetailExpanded(false);
      setDetailBriefing(null);
      setDetailBriefingStatus('idle');
      return;
    }

    setDetailBriefing(storedLocalizedBriefing);
    setDetailBriefingStatus(storedLocalizedBriefing ? 'ready' : 'loading');

    if (storedLocalizedBriefing) {
      return;
    }

    let isCancelled = false;

    void fetchEventBriefing(selectedEvent.id, contentLocale)
      .then((response) => {
        if (isCancelled) {
          return;
        }

        setDetailBriefing(response.briefing);
        setDetailBriefingStatus('ready');
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setDetailBriefing(buildFallbackBriefing(contentLocale, selectedEvent));
        setDetailBriefingStatus('error');
      });

    return () => {
      isCancelled = true;
    };
  }, [contentLocale, selectedEvent?.id, selectedEvent, storedLocalizedBriefing]);

  const lastSyncLabel = runtimeConfig.lastRefreshAt
    ? new Date(runtimeConfig.lastRefreshAt).toLocaleTimeString(contentLocale === 'en' ? 'en-US' : 'ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : contentLocale === 'en' ? 'Idle' : '대기 중';
  const lastIngestLabel = runtimeConfig.lastIngestAt
    ? new Date(runtimeConfig.lastIngestAt).toLocaleTimeString(contentLocale === 'en' ? 'en-US' : 'ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : contentLocale === 'en' ? 'Idle' : '대기 중';
  const alertMessages: {
    id: string;
    message: string;
    tone: 'danger' | 'success' | 'warning';
  }[] = [];

  if (mapLoadStatusLabel) {
    alertMessages.push({
      id: 'map-style',
      message: mapLoadStatusLabel,
      tone: 'warning',
    });
  }

  if (runtimeConfig.ingestStatus === 'error' && runtimeConfig.lastIngestError) {
    alertMessages.push({
      id: 'ingest-error',
      message: `RSS 수집 실패 · ${runtimeConfig.lastIngestError}`,
      tone: 'danger',
    });
  } else if (runtimeConfig.lastIngestResult) {
    const { droppedCount, normalizedCount, persistedCount, received } = runtimeConfig.lastIngestResult;
    const droppedLabel = droppedCount > 0 ? ` / 제외 ${droppedCount}건` : '';

    alertMessages.push({
      id: 'ingest-success',
      message: `RSS 수집 완료 · 입력 ${received}건 / 정규화 ${normalizedCount}건 / 저장 ${persistedCount}건${droppedLabel}`,
      tone: 'success',
    });
  }

  useEffect(() => {
    let isCancelled = false;

    void getLocalizedMapStyle(mapLabelLocale)
      .then(({ mapStyle: nextStyle, provider, providerLabel }) => {
        if (!isCancelled) {
          setMapStyle(nextStyle);
          setMapProvider(provider);
          setMapProviderLabel(providerLabel);
          setMapLoadStatusLabel(null);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setMapStyle(MapLibreRN.StyleURL.Default);
          setMapProvider('maplibre-demo');
          setMapProviderLabel('기본 지도 스타일');
          setMapLoadStatusLabel('외부 지도 스타일을 불러오지 못해 기본 지도로 전환했습니다');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [mapLabelLocale]);

  const handleMapLoadFailure = () => {
    if (mapProvider === 'maplibre-demo') {
      return;
    }

    setMapStyle(MapLibreRN.StyleURL.Default);
    setMapProvider('maplibre-demo');
    setMapProviderLabel('MapLibre Demo 복구');
    setMapLoadStatusLabel('OpenFreeMap 연결이 끊겨 기본 지도로 자동 복구했습니다');
  };

  const topBarTop = insets.top + 8;
  const statusRailTop = insets.top + 68;
  const alertTop = insets.top + 138;
  const bottomInsetOffset = Math.max(insets.bottom, 12) + 12;
  const cameraPaddingTop = insets.top + 84;
  const cameraPaddingBottom = insets.bottom + (selectedEvent ? (detailExpanded ? 408 : 286) : 116);
  const factMetaParts = [
    summarizeListCount(contentLocale === 'en' ? 'More facts' : '추가 사실', Math.max(0, (selectedEvent?.facts.length ?? 0) - 1)),
    formatNumericFactMeta(selectedEvent?.numericFacts[0]),
    selectedEvent?.facts[0]?.source ? `${contentLocale === 'en' ? 'Source' : '출처'} ${selectedEvent.facts[0].source}` : null,
  ].filter(Boolean);
  const scenarioBullSummary = selectedEvent ? clampSentence(selectedEvent.scenarioBull, 72) : '';
  const scenarioBearSummary = selectedEvent ? clampSentence(selectedEvent.scenarioBear, 72) : '';
  const hasScenarioSection = selectedEvent ? !isPlaceholderNarrative(selectedEvent.scenarioBase) : false;
  const markerTypeLabelLayerStyle = getMarkerTypeLabelLayerStyle(mapProvider);
  const mapEventsShape: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: 'FeatureCollection',
    features: riskEvents.map((event) => ({
      type: 'Feature' as const,
      id: event.id,
      properties: {
        eventId: event.id,
        riskLevel: event.riskLevel,
        importanceScore: event.importanceScore,
        importanceBucket:
          event.importanceScore >= 9
            ? 'critical'
            : event.importanceScore >= 7
              ? 'high'
              : event.importanceScore >= 4
                ? 'medium'
                : 'low',
        markerColor: getRiskColor(event.riskLevel),
        directionColor: getEventDirectionColor(event.eventDirection),
        eventTypeColor: getEventTypeColor(event.eventType),
        eventTypeCode: getEventTypeCode(event.eventType),
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [event.longitude, event.latitude],
      },
    })),
  };

  return (
    <View style={styles.mapScreen}>
      <View style={styles.mapBackgroundGlowLarge} />
      <View style={styles.mapBackgroundGlowSmall} />

      <View style={styles.mapShell}>
        <View style={styles.mapViewport}>
          <MapLibreRN.MapView
            attributionEnabled
            compassEnabled={false}
            logoEnabled={false}
            mapStyle={mapStyle}
            onDidFailLoadingMap={handleMapLoadFailure}
            rotateEnabled={false}
            style={styles.map}
            zoomEnabled>
            <MapLibreRN.Camera
              defaultSettings={{
                animationDuration: 0,
                bounds: {
                  ne: [160, 72],
                  sw: [-160, -55],
                },
                padding: {
                  paddingBottom: cameraPaddingBottom,
                  paddingLeft: 24,
                  paddingRight: 24,
                  paddingTop: cameraPaddingTop,
                },
                pitch: 0,
                zoomLevel: 1,
              }}
            />

            <MapLibreRN.ShapeSource
              hitbox={{
                width: 64,
                height: 64,
              }}
              id={MAP_EVENTS_SOURCE_ID}
              onPress={(event) => {
                const pressedFeature = event.features[0];
                const pressedEventId = pressedFeature?.properties?.eventId;

                if (typeof pressedEventId === 'string') {
                  setSelectedEventId(pressedEventId);
                }
              }}
              shape={mapEventsShape}>
              <MapLibreRN.CircleLayer
                id="war-pick-marker-halo"
                sourceID={MAP_EVENTS_SOURCE_ID}
                style={markerHaloLayerStyle}
              />
              <MapLibreRN.CircleLayer
                id="war-pick-marker-direction-ring"
                sourceID={MAP_EVENTS_SOURCE_ID}
                style={markerDirectionRingLayerStyle}
              />
              <MapLibreRN.CircleLayer
                id="war-pick-marker-core"
                sourceID={MAP_EVENTS_SOURCE_ID}
                style={markerCoreLayerStyle}
              />
              <MapLibreRN.SymbolLayer
                id="war-pick-marker-type-label"
                sourceID={MAP_EVENTS_SOURCE_ID}
                style={markerTypeLabelLayerStyle}
              />
              <MapLibreRN.CircleLayer
                filter={['==', ['get', 'eventId'], selectedEventId ?? '']}
                id="war-pick-marker-selected"
                sourceID={MAP_EVENTS_SOURCE_ID}
                style={selectedMarkerRingStyle}
              />
            </MapLibreRN.ShapeSource>
          </MapLibreRN.MapView>

          <View style={[styles.topBar, { top: topBarTop }]}>
            <View style={styles.brandBlock}>
              <Text style={styles.brand}>WAR-PICK</Text>
              <Text style={styles.brandCaption}>{copy.brandCaption}</Text>
            </View>

            <View style={styles.topBarActions}>
              <View style={styles.languageSwitch}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMapLabelLocale('ko');
                  }}
                  style={({ pressed }) => [
                    styles.languageButton,
                    mapLabelLocale === 'ko' && styles.languageButtonActive,
                    pressed && styles.languageButtonPressed,
                    ]}>
                    <Text
                      style={[
                        styles.languageButtonText,
                        mapLabelLocale === 'ko' && styles.languageButtonTextActive,
                      ]}>
                    {copy.languageKo}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMapLabelLocale('en');
                  }}
                  style={({ pressed }) => [
                    styles.languageButton,
                    mapLabelLocale === 'en' && styles.languageButtonActive,
                    pressed && styles.languageButtonPressed,
                    ]}>
                    <Text
                      style={[
                        styles.languageButtonText,
                        mapLabelLocale === 'en' && styles.languageButtonTextActive,
                      ]}>
                    {copy.languageEn}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={isRefreshing || isIngesting}
                onPress={() => {
                  void runIngest();
                }}
                style={({ pressed }) => [
                  styles.refreshButton,
                  styles.ingestButton,
                  (isRefreshing || isIngesting) && styles.refreshButtonDisabled,
                  pressed && !(isRefreshing || isIngesting) && styles.refreshButtonPressed,
                ]}>
                <Text style={styles.refreshButtonText}>
                  {isIngesting ? copy.ingestRunning : copy.ingestIdle}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={isRefreshing || isIngesting}
                onPress={() => {
                  void refreshLive();
                }}
                style={({ pressed }) => [
                  styles.refreshButton,
                  (isRefreshing || isIngesting) && styles.refreshButtonDisabled,
                  pressed && !(isRefreshing || isIngesting) && styles.refreshButtonPressed,
                ]}>
                <Text style={styles.refreshButtonText}>
                  {isRefreshing ? copy.refreshRunning : copy.refreshIdle}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.mapStatusRail, { top: statusRailTop }]}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>{copy.hotspot}</Text>
              <Text style={styles.statusPillValue}>{riskEvents.length}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>{copy.feedStatus}</Text>
              <Text numberOfLines={1} style={styles.statusPillValueMuted}>
                {runtimeConfig.diagnosticsLabel}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>{copy.mapProvider}</Text>
              <Text numberOfLines={1} style={styles.statusPillValueMuted}>
                {mapProviderLabel}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>{copy.lastSync}</Text>
              <Text numberOfLines={1} style={styles.statusPillValueMuted}>
                {lastSyncLabel}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>{copy.rssIngest}</Text>
              <Text numberOfLines={1} style={styles.statusPillValueMuted}>
                {runtimeConfig.ingestStatusLabel}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>{copy.lastIngest}</Text>
              <Text numberOfLines={1} style={styles.statusPillValueMuted}>
                {lastIngestLabel}
              </Text>
            </View>
          </View>

          {alertMessages.length > 0 ? (
            <View style={[styles.alertStack, { top: alertTop }]}>
              {alertMessages.map((alert) => (
                <View
                  key={alert.id}
                  style={[
                    styles.mapAlertPill,
                    alert.tone === 'danger'
                      ? styles.mapAlertPillDanger
                      : alert.tone === 'success'
                        ? styles.mapAlertPillSuccess
                        : styles.mapAlertPillWarning,
                  ]}>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.mapAlertText,
                      alert.tone === 'danger'
                        ? styles.mapAlertTextDanger
                        : alert.tone === 'success'
                          ? styles.mapAlertTextSuccess
                          : styles.mapAlertTextWarning,
                    ]}>
                    {alert.message}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {!selectedEvent ? (
            <View style={[styles.mapLegendDock, { bottom: bottomInsetOffset + 86 }]}>
              <Text style={styles.mapLegendHeading}>
                {contentLocale === 'en' ? 'Map legend' : '지도 표기'}
              </Text>
              <View style={styles.mapLegendRow}>
                {getMapLegend(contentLocale).map((item) => (
                  <View key={item.label} style={styles.mapLegendItem}>
                    <View
                      style={[
                        styles.mapLegendSwatch,
                        {
                          backgroundColor: item.tone,
                        },
                      ]}
                    />
                    <View style={styles.mapLegendCopy}>
                      <Text style={styles.mapLegendLabel}>{item.label}</Text>
                      <Text style={styles.mapLegendValue}>{item.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {selectedEvent ? (
            <View
              style={[
                styles.bottomSheetDock,
                styles.bottomSheetShell,
                detailExpanded ? styles.bottomSheetExpanded : styles.bottomSheetPeek,
                { bottom: bottomInsetOffset },
              ]}>
              <View style={styles.bottomSheetHandle} />

              <View style={styles.bottomSheetToolbar}>
                <Text style={styles.bottomSheetHint}>{copy.sheetHint}</Text>
                <View style={styles.bottomSheetToolbarActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setDetailExpanded((current) => !current);
                    }}
                    style={({ pressed }) => [
                      styles.bottomSheetAction,
                      pressed && styles.closeButtonPressed,
                    ]}>
                    <Text style={styles.bottomSheetActionText}>
                      {detailExpanded ? copy.compactView : copy.expandedView}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedEventId(null);
                    }}
                    style={({ pressed }) => [
                      styles.closeButton,
                      pressed && styles.closeButtonPressed,
                    ]}>
                    <Text style={styles.closeButtonText}>{copy.close}</Text>
                  </Pressable>
                </View>
              </View>

              <ScrollView
                contentContainerStyle={styles.bottomSheetScrollContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.bottomSheetHeader}>
                  <View style={styles.bottomSheetSourceRow}>
                    <Text style={styles.bottomSheetSource}>{selectedEvent.source}</Text>
                    <Text style={styles.bottomSheetSourceDivider}>/</Text>
                    <Text style={styles.bottomSheetTime}>
                      {selectedEvent.regionName} · {getRelativeTimeLabel(selectedEvent.occurredAt, contentLocale)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.riskBadge,
                      {
                        borderColor: getRiskColor(selectedEvent.riskLevel),
                        backgroundColor: `${getRiskColor(selectedEvent.riskLevel)}18`,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.riskBadgeText,
                        {
                          color: getRiskColor(selectedEvent.riskLevel),
                        },
                      ]}>
                      {getRiskLabel(selectedEvent.riskLevel, contentLocale)}
                    </Text>
                  </View>
                </View>

                <Text numberOfLines={3} style={styles.bottomSheetTitle}>
                  {selectedTitle}
                </Text>
                <Text numberOfLines={3} style={styles.bottomSheetSummary}>
                  {selectedSummary}
                </Text>

                <View style={styles.signalChipRow}>
                  <View
                    style={[
                      styles.signalChip,
                      {
                        borderColor: getRiskColor(selectedEvent.riskLevel),
                      },
                    ]}>
                    <Text style={styles.signalChipLabel}>Risk</Text>
                    <Text style={[styles.signalChipValue, { color: getRiskColor(selectedEvent.riskLevel) }]}>
                      {selectedEvent.importanceScore}/10 · {getImportanceLabel(selectedEvent.importanceScore, contentLocale)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.signalChip,
                      {
                        borderColor: getEventDirectionColor(selectedEvent.eventDirection),
                      },
                    ]}>
                    <Text style={styles.signalChipLabel}>Flow</Text>
                    <Text style={[styles.signalChipValue, { color: getEventDirectionColor(selectedEvent.eventDirection) }]}>
                      {getEventDirectionLabel(selectedEvent.eventDirection, contentLocale)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.signalChip,
                      {
                        borderColor: getEventTypeColor(selectedEvent.eventType),
                      },
                    ]}>
                    <Text style={styles.signalChipLabel}>Type</Text>
                    <Text style={[styles.signalChipValue, { color: getEventTypeColor(selectedEvent.eventType) }]}>
                      {getEventTypeLabel(selectedEvent.eventType, contentLocale)}
                    </Text>
                  </View>
                  <View style={styles.signalChip}>
                    <Text style={styles.signalChipLabel}>{copy.validation}</Text>
                    <Text style={styles.signalChipValue}>
                      {getVerificationStatusLabel(selectedEvent.verificationStatus, contentLocale)}
                    </Text>
                  </View>
                </View>

                <View style={styles.bottomSheetSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>{copy.assets}</Text>
                    <Text style={styles.sectionMetaText}>
                      {copy.sentiment} · {getMarketSentimentLabel(selectedEvent.marketSentiment, contentLocale)}
                    </Text>
                  </View>
                  {selectedEvent.impacts.length > 0 ? (
                    selectedEvent.impacts.slice(0, detailExpanded ? 4 : 3).map((impact) => (
                      <View key={impact.id} style={styles.assetBarRow}>
                        <View style={styles.assetBarHeader}>
                          <Text style={styles.assetBarCode}>{impact.assetCode}</Text>
                          <Text style={styles.assetBarDirection}>
                            {getDirectionLabel(impact.direction, contentLocale)}
                          </Text>
                          <Text
                            style={[
                              styles.assetBarMove,
                              { color: getDirectionColor(impact.direction) },
                            ]}>
                            {impact.moveHint}
                          </Text>
                        </View>
                        <View style={styles.assetBarTrack}>
                          <View
                            style={[
                              styles.assetBarFill,
                              {
                                backgroundColor: getDirectionColor(impact.direction),
                                width: `${Math.max(16, Math.round(impact.confidence * 100))}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptySectionText}>{copy.noAssets}</Text>
                  )}
                </View>

                <View style={styles.bottomSheetSection}>
                  <Text style={styles.sectionTitle}>{copy.aiBriefing}</Text>
                  {effectiveBriefing ? (
                    <View style={styles.unifiedBriefingCard}>
                      <View style={styles.briefingLine}>
                        <Text style={styles.briefingLineLabel}>{copy.confirmedFact}</Text>
                        <Text numberOfLines={2} style={styles.briefingLineBody}>
                          {effectiveBriefing.fact}
                        </Text>
                      </View>
                      <View style={styles.briefingLine}>
                        <Text style={styles.briefingLineLabel}>{copy.marketInsight}</Text>
                        <Text numberOfLines={2} style={styles.briefingLineBody}>
                          {effectiveBriefing.insight}
                        </Text>
                      </View>
                      {effectiveBriefing.uncertainty ? (
                        <View style={styles.briefingLine}>
                          <Text style={styles.briefingLineLabel}>{copy.uncertainty}</Text>
                          <Text numberOfLines={2} style={styles.briefingLineBody}>
                            {effectiveBriefing.uncertainty}
                          </Text>
                        </View>
                      ) : null}
                      {effectiveBriefing.meta ? (
                        <Text numberOfLines={2} style={styles.briefingMeta}>
                          {effectiveBriefing.meta}
                        </Text>
                      ) : factMetaParts.length > 0 ? (
                        <Text numberOfLines={2} style={styles.briefingMeta}>
                          {factMetaParts.join(' · ')}
                        </Text>
                      ) : null}
                      {detailBriefingStatus === 'error' ? (
                        <Text style={styles.briefingErrorText}>{copy.briefingError}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.emptySectionText}>
                      {detailBriefingStatus === 'loading' ? copy.noBriefing : copy.noDetail}
                    </Text>
                  )}
                </View>

                {detailExpanded ? (
                  <View style={styles.bottomSheetSection}>
                    <Text style={styles.sectionTitle}>{copy.detailContext}</Text>
                    <View style={styles.expandedGrid}>
                      <View style={styles.expandedCard}>
                        <Text style={styles.expandedCardLabel}>{copy.actorsTargets}</Text>
                        <Text style={styles.expandedCardBody}>
                          {selectedEvent.actors.length > 0 ? selectedEvent.actors.join(', ') : 'n/a'}
                          {' · '}
                          {selectedEvent.targets.length > 0 ? selectedEvent.targets.join(', ') : 'n/a'}
                        </Text>
                      </View>
                      <View style={styles.expandedCard}>
                        <Text style={styles.expandedCardLabel}>{copy.macroPath}</Text>
                        <Text style={styles.expandedCardBody}>
                          {selectedEvent.macroChannels.length > 0
                            ? selectedEvent.macroChannels.join(' · ')
                            : 'n/a'}
                        </Text>
                      </View>
                      <View style={styles.expandedCard}>
                        <Text style={styles.expandedCardLabel}>{copy.webStatus}</Text>
                        <Text style={styles.expandedCardBody}>
                          {copy.sourceCount(selectedEvent.sourceCount)} · {getWebEnrichmentStatusLabel(selectedEvent.webEnrichmentStatus, contentLocale)}
                        </Text>
                      </View>
                      {hasScenarioSection ? (
                        <View style={styles.expandedCardWide}>
                          <Text style={styles.expandedCardLabel}>{copy.scenario}</Text>
                          <Text style={styles.expandedCardBody}>{selectedEvent.scenarioBase}</Text>
                          <Text style={styles.expandedCardMeta}>
                            Bull: {scenarioBullSummary}
                          </Text>
                          <Text style={styles.expandedCardMeta}>
                            Bear: {scenarioBearSummary}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          ) : (
            <View style={[styles.selectionHint, { bottom: bottomInsetOffset }]}>
              <Text style={styles.selectionHintLabel}>{copy.selectionHintLabel}</Text>
              <Text style={styles.selectionHintText}>
                {copy.selectionHintText}
              </Text>
              <Text style={styles.selectionHintTextMuted}>
                {copy.selectionHintMuted}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapScreen: {
    flex: 1,
    backgroundColor: '#04090d',
  },
  mapShell: {
    flex: 1,
  },
  mapBackgroundGlowLarge: {
    position: 'absolute',
    right: -80,
    top: 40,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: '#496d2b',
    opacity: 0.1,
  },
  mapBackgroundGlowSmall: {
    position: 'absolute',
    left: -80,
    bottom: 160,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: '#18465d',
    opacity: 0.12,
  },
  topBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 2,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandBlock: {
    gap: 2,
  },
  brand: {
    color: '#d8dfd9',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  brandCaption: {
    color: '#6d808a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  topBarActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  languageSwitch: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#23363f',
    backgroundColor: '#091118d8',
    padding: 3,
  },
  languageButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  languageButtonActive: {
    backgroundColor: '#d8c06b',
  },
  languageButtonPressed: {
    opacity: 0.9,
  },
  languageButtonText: {
    color: '#8ea0aa',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  languageButtonTextActive: {
    color: '#18150f',
  },
  refreshButton: {
    backgroundColor: '#101a20eb',
    borderColor: '#2a4048',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ingestButton: {
    backgroundColor: '#1d170be8',
    borderColor: '#5c4a20',
  },
  refreshButtonDisabled: {
    opacity: 0.68,
  },
  refreshButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  refreshButtonText: {
    color: '#e3ebe4',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  mapViewport: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#081116',
  },
  map: {
    flex: 1,
  },
  mapStatusRail: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    zIndex: 2,
  },
  alertStack: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 2,
  },
  mapLegendDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 2,
  },
  mapLegendHeading: {
    color: '#dccb95',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  mapLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mapLegendItem: {
    minWidth: 98,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1c3038',
    backgroundColor: '#081118dc',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  mapLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  mapLegendCopy: {
    gap: 1,
  },
  mapLegendLabel: {
    color: '#7f939d',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  mapLegendValue: {
    color: '#e9efe5',
    fontSize: 12,
    fontWeight: '800',
  },
  mapAlertPill: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mapAlertPillWarning: {
    borderColor: '#4f3d1d',
    backgroundColor: '#1e1710e8',
  },
  mapAlertPillDanger: {
    borderColor: '#5b292c',
    backgroundColor: '#241114ee',
  },
  mapAlertPillSuccess: {
    borderColor: '#254a33',
    backgroundColor: '#0f1d17ee',
  },
  mapAlertText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  mapAlertTextWarning: {
    color: '#dfc98d',
  },
  mapAlertTextDanger: {
    color: '#ffb1b8',
  },
  mapAlertTextSuccess: {
    color: '#9ae6b4',
  },
  statusPill: {
    minWidth: 92,
    gap: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f333c',
    backgroundColor: '#081118d8',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statusPillLabel: {
    color: '#80939c',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusPillValue: {
    color: '#edf0e6',
    fontSize: 14,
    fontWeight: '800',
  },
  statusPillValueMuted: {
    color: '#b5c0c5',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 2,
  },
  briefingPanel: {
    backgroundColor: '#091118f2',
    borderColor: '#1b2b32',
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
  },
  briefingUtilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  briefingHint: {
    flex: 1,
    color: '#72858f',
    fontSize: 11,
    fontWeight: '700',
  },
  closeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#24414f',
    backgroundColor: '#0d171d',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  closeButtonPressed: {
    opacity: 0.9,
  },
  closeButtonText: {
    color: '#d9e3dd',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  briefingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  briefingTitleBlock: {
    flex: 1,
    gap: 6,
  },
  briefingRegion: {
    color: '#a3b2b9',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  briefingTitle: {
    color: '#f1f3ed',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
  },
  riskBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#10171b',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  briefingSummary: {
    color: '#c3cdc7',
    fontSize: 14,
    lineHeight: 21,
  },
  briefingThesis: {
    color: '#edf0d8',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  signalCommandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  commandPill: {
    minWidth: 96,
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#0d171d',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commandPillLabel: {
    color: '#71858e',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  commandPillValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  briefingSignalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  signalPill: {
    minWidth: 92,
    gap: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#162830',
    backgroundColor: '#0d171d',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  signalPillWide: {
    flexGrow: 1,
    minWidth: 190,
    gap: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#162830',
    backgroundColor: '#0d171d',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  signalPillLabel: {
    color: '#738690',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  signalPillValue: {
    color: '#ecf0e7',
    fontSize: 12,
    fontWeight: '700',
  },
  signalPillValueMuted: {
    color: '#bfd0d1',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  impactInlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  storySection: {
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#16272e',
    backgroundColor: '#091117',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  storySectionLabel: {
    color: '#90a3ab',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  storySectionBody: {
    color: '#edf0e8',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  storySectionMeta: {
    color: '#aebfc3',
    fontSize: 12,
    lineHeight: 18,
  },
  impactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#0d181e',
    borderColor: '#1e323a',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  impactChipAsset: {
    color: '#eef2e9',
    fontSize: 12,
    fontWeight: '800',
  },
  impactChipDirection: {
    color: '#7f929c',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  impactChipMove: {
    maxWidth: 116,
    fontSize: 12,
    fontWeight: '900',
  },
  bottomSheetDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 3,
  },
  bottomSheetShell: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1b313b',
    backgroundColor: '#081118ee',
    overflow: 'hidden',
  },
  bottomSheetPeek: {
    maxHeight: 312,
  },
  bottomSheetExpanded: {
    maxHeight: 508,
  },
  bottomSheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#28404b',
    marginTop: 10,
    marginBottom: 10,
  },
  bottomSheetToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  bottomSheetHint: {
    flex: 1,
    color: '#81949d',
    fontSize: 12,
    lineHeight: 17,
  },
  bottomSheetToolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomSheetAction: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#29404b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#101921',
  },
  bottomSheetActionText: {
    color: '#d8dfd9',
    fontSize: 12,
    fontWeight: '800',
  },
  bottomSheetScrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 14,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomSheetSourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  bottomSheetSource: {
    color: '#d8c06b',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  bottomSheetSourceDivider: {
    color: '#4c6470',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomSheetTime: {
    color: '#9fb0b8',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomSheetTitle: {
    color: '#edf2ee',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  bottomSheetSummary: {
    color: '#b9c7c4',
    fontSize: 14,
    lineHeight: 20,
  },
  signalChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  signalChip: {
    minWidth: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#223743',
    backgroundColor: '#0f1921',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  signalChipLabel: {
    color: '#728690',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  signalChipValue: {
    color: '#e5ece7',
    fontSize: 12,
    fontWeight: '900',
  },
  bottomSheetSection: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#18303b',
    backgroundColor: '#0b141b',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: '#edf2ee',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionMetaText: {
    color: '#758892',
    fontSize: 12,
    fontWeight: '700',
  },
  assetBarRow: {
    gap: 8,
  },
  assetBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assetBarCode: {
    color: '#edf2ee',
    fontSize: 13,
    fontWeight: '900',
    minWidth: 42,
  },
  assetBarDirection: {
    color: '#9ab0b8',
    fontSize: 12,
    fontWeight: '800',
  },
  assetBarMove: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '900',
  },
  assetBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#14232d',
    overflow: 'hidden',
  },
  assetBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  unifiedBriefingCard: {
    gap: 12,
  },
  briefingLine: {
    gap: 4,
  },
  briefingLineLabel: {
    color: '#d8c06b',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  briefingLineBody: {
    color: '#d7e1de',
    fontSize: 14,
    lineHeight: 20,
  },
  briefingMeta: {
    color: '#7e919a',
    fontSize: 12,
    lineHeight: 17,
  },
  briefingErrorText: {
    color: '#f0b84f',
    fontSize: 12,
    lineHeight: 17,
  },
  emptySectionText: {
    color: '#93a7af',
    fontSize: 13,
    lineHeight: 18,
  },
  expandedGrid: {
    gap: 10,
  },
  expandedCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#17303b',
    backgroundColor: '#0e181f',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  expandedCardWide: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#17303b',
    backgroundColor: '#0e181f',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  expandedCardLabel: {
    color: '#7d95a0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  expandedCardBody: {
    color: '#d8e2df',
    fontSize: 13,
    lineHeight: 18,
  },
  expandedCardMeta: {
    color: '#93a7af',
    fontSize: 12,
    lineHeight: 17,
  },
  selectionHint: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1b313b',
    backgroundColor: '#081118db',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    zIndex: 2,
  },
  selectionHintLabel: {
    color: '#d8c06b',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  selectionHintText: {
    color: '#c1ccc7',
    fontSize: 13,
    lineHeight: 18,
  },
  selectionHintTextMuted: {
    color: '#81949d',
    fontSize: 12,
    lineHeight: 17,
  },
});
