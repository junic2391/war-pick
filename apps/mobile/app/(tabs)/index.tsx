import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as MapLibreRN from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getDirectionColor,
  getDirectionLabel,
  getEventTypeLabel,
  getRelativeTimeLabel,
  getRiskColor,
  getRiskLabel,
  getVerificationStatusLabel,
} from '@/lib/war-pick-data';
import {
  getLocalizedMapStyle,
  type MapLabelLocale,
  type MapStyleProvider,
} from '@/lib/map-style';
import { useWarPickFeed } from '@/lib/war-pick-feed';

const MAP_EVENTS_SOURCE_ID = 'war-pick-events';

const markerHaloLayerStyle = {
  circleRadius: ['match', ['get', 'riskLevel'], 'critical', 20, 'high', 18, 'medium', 16, 14],
  circleColor: [
    'match',
    ['get', 'riskLevel'],
    'critical',
    'rgba(255, 77, 79, 0.13)',
    'high',
    'rgba(255, 139, 94, 0.13)',
    'medium',
    'rgba(255, 190, 92, 0.12)',
    'rgba(127, 212, 255, 0.11)',
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
  circleSortKey: ['get', 'riskRank'],
} as const;

const markerCoreLayerStyle = {
  circleRadius: ['match', ['get', 'riskLevel'], 'critical', 10, 'high', 9, 'medium', 8, 7],
  circleColor: ['get', 'markerColor'],
  circleStrokeWidth: 3,
  circleStrokeColor: '#071117',
  circleOpacity: 1,
  circleSortKey: ['get', 'riskRank'],
} as const;

const markerCenterLayerStyle = {
  circleRadius: 3,
  circleColor: '#fff7e8',
  circleOpacity: 0.98,
  circleSortKey: ['get', 'riskRank'],
} as const;

const selectedMarkerRingStyle = {
  circleRadius: ['match', ['get', 'riskLevel'], 'critical', 25, 'high', 23, 'medium', 21, 19],
  circleColor: '#00000000',
  circleStrokeWidth: 3,
  circleStrokeColor: ['get', 'markerColor'],
  circleOpacity: 0.95,
} as const;

export default function HomeScreen() {
  const { isRefreshing, refreshLive, riskEvents, runtimeConfig } = useWarPickFeed();
  const insets = useSafeAreaInsets();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mapLabelLocale, setMapLabelLocale] = useState<MapLabelLocale>('ko');
  const [mapStyle, setMapStyle] = useState<string | object>(MapLibreRN.StyleURL.Default);
  const [mapProvider, setMapProvider] = useState<MapStyleProvider>('maplibre-demo');
  const [mapProviderLabel, setMapProviderLabel] = useState('지도 공급자 확인 중');
  const [mapLoadStatusLabel, setMapLoadStatusLabel] = useState<string | null>(null);

  useEffect(() => {
    setSelectedEventId((currentId) =>
      currentId && riskEvents.some((event) => event.id === currentId) ? currentId : null,
    );
  }, [riskEvents]);

  const selectedEvent = riskEvents.find((event) => event.id === selectedEventId) ?? null;
  const lastSyncLabel = runtimeConfig.lastRefreshAt
    ? new Date(runtimeConfig.lastRefreshAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '대기 중';

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
  const cameraPaddingBottom = insets.bottom + 116;
  const mapEventsShape: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: 'FeatureCollection',
    features: riskEvents.map((event) => ({
      type: 'Feature' as const,
      id: event.id,
      properties: {
        eventId: event.id,
        riskLevel: event.riskLevel,
        riskRank:
          event.riskLevel === 'critical' ? 4 : event.riskLevel === 'high' ? 3 : event.riskLevel === 'medium' ? 2 : 1,
        markerColor:
          event.riskLevel === 'critical'
            ? '#ff4d4f'
            : event.riskLevel === 'high'
              ? '#ff8b5e'
              : event.riskLevel === 'medium'
                ? '#ffbe5c'
                : '#7fd4ff',
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
                id="war-pick-marker-core"
                sourceID={MAP_EVENTS_SOURCE_ID}
                style={markerCoreLayerStyle}
              />
              <MapLibreRN.CircleLayer
                id="war-pick-marker-center"
                sourceID={MAP_EVENTS_SOURCE_ID}
                style={markerCenterLayerStyle}
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
              <Text style={styles.brandCaption}>지정학 리스크 레이더</Text>
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
                    한글
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
                    ENG
                  </Text>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={isRefreshing}
                onPress={() => {
                  void refreshLive();
                }}
                style={({ pressed }) => [
                  styles.refreshButton,
                  isRefreshing && styles.refreshButtonDisabled,
                  pressed && !isRefreshing && styles.refreshButtonPressed,
                ]}>
                <Text style={styles.refreshButtonText}>
                  {isRefreshing ? '새로고침 중' : '새로고침'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.mapStatusRail, { top: statusRailTop }]}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>핫스팟</Text>
              <Text style={styles.statusPillValue}>{riskEvents.length}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>피드 상태</Text>
              <Text numberOfLines={1} style={styles.statusPillValueMuted}>
                {runtimeConfig.diagnosticsLabel}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>지도 공급자</Text>
              <Text numberOfLines={1} style={styles.statusPillValueMuted}>
                {mapProviderLabel}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>마지막 동기화</Text>
              <Text numberOfLines={1} style={styles.statusPillValueMuted}>
                {lastSyncLabel}
              </Text>
            </View>
          </View>

          {mapLoadStatusLabel ? (
            <View style={[styles.mapAlertPill, { top: alertTop }]}>
              <Text numberOfLines={2} style={styles.mapAlertText}>
                {mapLoadStatusLabel}
              </Text>
            </View>
          ) : null}

          {selectedEvent ? (
            <View style={[styles.bottomOverlay, { bottom: bottomInsetOffset }]}>
              <View style={styles.briefingPanel}>
                <View style={styles.briefingUtilityRow}>
                  <Text style={styles.briefingHint}>다른 마커를 누르면 포커스를 전환합니다</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedEventId(null);
                    }}
                    style={({ pressed }) => [
                      styles.closeButton,
                      pressed && styles.closeButtonPressed,
                    ]}>
                    <Text style={styles.closeButtonText}>닫기</Text>
                  </Pressable>
                </View>

                <View style={styles.briefingHeader}>
                  <View style={styles.briefingTitleBlock}>
                    <Text style={styles.briefingRegion}>
                      {selectedEvent.regionName} / {getRelativeTimeLabel(selectedEvent.occurredAt)}
                    </Text>
                    <Text numberOfLines={3} style={styles.briefingTitle}>
                      {selectedEvent.title}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.riskBadge,
                      {
                        borderColor: getRiskColor(selectedEvent.riskLevel),
                      },
                    ]}>
                    <Text
                      style={[
                        styles.riskBadgeText,
                        {
                          color: getRiskColor(selectedEvent.riskLevel),
                        },
                      ]}>
                      {getRiskLabel(selectedEvent.riskLevel)}
                    </Text>
                  </View>
                </View>

                <Text numberOfLines={2} style={styles.briefingSummary}>
                  {selectedEvent.summary}
                </Text>

                <View style={styles.briefingSignalRow}>
                  <View style={styles.signalPill}>
                    <Text style={styles.signalPillLabel}>이벤트 유형</Text>
                    <Text style={styles.signalPillValue}>
                      {getEventTypeLabel(selectedEvent.eventType)}
                    </Text>
                  </View>
                  <View style={styles.signalPill}>
                    <Text style={styles.signalPillLabel}>검증 상태</Text>
                    <Text style={styles.signalPillValue}>
                      {getVerificationStatusLabel(selectedEvent.verificationStatus)}
                    </Text>
                  </View>
                  <View style={styles.signalPill}>
                    <Text style={styles.signalPillLabel}>연결 자산</Text>
                    <Text style={styles.signalPillValue}>{selectedEvent.impacts.length}개</Text>
                  </View>
                </View>

                <View style={styles.impactInlineRow}>
                  {selectedEvent.impacts.length > 0 ? (
                    selectedEvent.impacts.slice(0, 2).map((impact) => (
                      <View key={impact.id} style={styles.impactChip}>
                        <Text style={styles.impactChipAsset}>{impact.assetCode}</Text>
                        <Text style={styles.impactChipDirection}>
                          {getDirectionLabel(impact.direction)}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.impactChipMove,
                            {
                              color: getDirectionColor(impact.direction),
                            },
                          ]}>
                          {impact.moveHint}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.impactChip}>
                      <Text style={styles.impactChipAsset}>연결된 자산이 아직 없습니다</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.selectionHint, { bottom: bottomInsetOffset }]}>
              <Text style={styles.selectionHintLabel}>지도 브리핑</Text>
              <Text style={styles.selectionHintText}>
                지도의 이벤트 마커를 탭하면 브리핑이 열립니다.
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
    gap: 8,
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
  mapAlertPill: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4f3d1d',
    backgroundColor: '#1e1710e8',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mapAlertText: {
    color: '#dfc98d',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
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
    paddingBottom: 14,
    gap: 10,
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
  impactInlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
});
