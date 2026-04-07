import { createContext, startTransition, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

import {
  type ImpactDirection,
  type RiskEvent,
  type RiskEventType,
  type RiskLevel,
  type VerificationStatus,
  getFeaturedEvent,
  getLatestEvent,
  getTotalImpacts,
  mockRiskEvents,
} from '@/lib/war-pick-data';

type RiskEventRow = {
  id: string;
  source: string;
  title: string;
  summary_ko: string | null;
  summary_en: string | null;
  event_type: RiskEventType;
  risk_level: RiskLevel;
  verification_status: VerificationStatus;
  country_code: string | null;
  region_name: string | null;
  latitude: number;
  longitude: number;
  occurred_at: string;
  detected_at: string;
};

type AssetImpactRow = {
  id: string;
  risk_event_id: string;
  asset_code: string;
  asset_name: string;
  direction: ImpactDirection;
  confidence: number | string;
  move_hint: string | null;
  rationale: string | null;
};

type RuntimeSource = 'mock' | 'live' | 'live-fallback';
type RefreshReason = 'initial' | 'manual' | 'realtime';

export type WarPickRuntimeConfig = {
  envConfigured: boolean;
  currentSource: RuntimeSource;
  liveDataConnected: boolean;
  diagnosticsLabel: string;
  lastError: string | null;
  lastRefreshAt: string | null;
  refreshCount: number;
  lastRealtimeEvent: string | null;
};

export type WarPickFeedState = {
  featuredEvent: RiskEvent;
  latestEvent: RiskEvent;
  riskEvents: RiskEvent[];
  runtimeConfig: WarPickRuntimeConfig;
  totalImpacts: number;
};

export type WarPickFeedContextValue = WarPickFeedState & {
  isRefreshing: boolean;
  refreshLive: () => Promise<void>;
};

const WarPickFeedContext = createContext<WarPickFeedContextValue | null>(null);

let supabaseClient: SupabaseClient | null | undefined;

function getSupabasePublishableKey() {
  return (
    process.env.EXPO_PUBLIC_SUPABASE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );
}

function getSupabaseClient() {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = getSupabasePublishableKey();

  if (!supabaseUrl || !supabasePublishableKey) {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

function createState(
  riskEvents: RiskEvent[],
  runtimeConfig: WarPickRuntimeConfig,
): WarPickFeedState {
  return {
    featuredEvent: getFeaturedEvent(riskEvents),
    latestEvent: getLatestEvent(riskEvents),
    riskEvents,
    runtimeConfig,
    totalImpacts: getTotalImpacts(riskEvents),
  };
}

function createMockState(runtimeConfig: Partial<WarPickRuntimeConfig> = {}) {
  return createState(mockRiskEvents, {
    envConfigured: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && getSupabasePublishableKey()),
    currentSource: 'mock',
    liveDataConnected: false,
    diagnosticsLabel: '목업 시드 데이터 표시 중',
    lastError: null,
    lastRefreshAt: null,
    refreshCount: 0,
    lastRealtimeEvent: null,
    ...runtimeConfig,
  });
}

function mapRowsToRiskEvents(eventRows: RiskEventRow[], impactRows: AssetImpactRow[]) {
  return eventRows.map((eventRow) => ({
    id: eventRow.id,
    source: eventRow.source,
    title: eventRow.title,
    summary: eventRow.summary_ko ?? eventRow.summary_en ?? '요약이 아직 도착하지 않았습니다.',
    eventType: eventRow.event_type,
    riskLevel: eventRow.risk_level,
    verificationStatus: eventRow.verification_status,
    countryCode: eventRow.country_code ?? '미상',
    regionName: eventRow.region_name ?? '지역 미상',
    latitude: eventRow.latitude,
    longitude: eventRow.longitude,
    occurredAt: eventRow.occurred_at,
    detectedAt: eventRow.detected_at,
    impacts: impactRows
      .filter((impactRow) => impactRow.risk_event_id === eventRow.id)
      .map((impactRow) => ({
        id: impactRow.id,
        assetCode: impactRow.asset_code,
        assetName: impactRow.asset_name,
        direction: impactRow.direction,
        confidence: Number(impactRow.confidence),
        moveHint: impactRow.move_hint ?? '변동 정보 없음',
        rationale: impactRow.rationale ?? '관련 자산 영향 설명이 아직 없습니다.',
      })),
  }));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '알 수 없는 Supabase 오류';
}

async function fetchLiveRiskEvents(liveClient: SupabaseClient) {
  const { data: eventRows, error: eventError } = await liveClient
    .from('risk_events')
    .select(
      'id, source, title, summary_ko, summary_en, event_type, risk_level, verification_status, country_code, region_name, latitude, longitude, occurred_at, detected_at',
    )
    .order('occurred_at', { ascending: false })
    .limit(12);

  if (eventError) {
    throw eventError;
  }

  const riskEventIds = (eventRows ?? []).map((eventRow) => eventRow.id);
  const impactsQuery = liveClient
    .from('asset_impacts')
    .select('id, risk_event_id, asset_code, asset_name, direction, confidence, move_hint, rationale');

  const { data: impactRows, error: impactError } =
    riskEventIds.length > 0 ? await impactsQuery.in('risk_event_id', riskEventIds) : await impactsQuery.limit(0);

  if (impactError) {
    throw impactError;
  }

  return mapRowsToRiskEvents(
    (eventRows ?? []) as RiskEventRow[],
    (impactRows ?? []) as AssetImpactRow[],
  );
}

export function WarPickFeedProvider({ children }: { children: ReactNode }) {
  const [feedState, setFeedState] = useState<WarPickFeedState>(() => createMockState());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const replaceState = (nextState: WarPickFeedState) => {
    if (!mountedRef.current) {
      return;
    }

    startTransition(() => {
      setFeedState(nextState);
    });
  };

  const replaceLiveState = (
    riskEvents: RiskEvent[],
    runtimeBuilder: (currentRuntime: WarPickRuntimeConfig) => WarPickRuntimeConfig,
  ) => {
    if (!mountedRef.current) {
      return;
    }

    startTransition(() => {
      setFeedState((currentState) => createState(riskEvents, runtimeBuilder(currentState.runtimeConfig)));
    });
  };

  const replaceMockRuntime = (
    runtimeBuilder: (currentRuntime: WarPickRuntimeConfig) => Partial<WarPickRuntimeConfig>,
  ) => {
    if (!mountedRef.current) {
      return;
    }

    startTransition(() => {
      setFeedState((currentState) =>
        createMockState({
          ...currentState.runtimeConfig,
          ...runtimeBuilder(currentState.runtimeConfig),
        }),
      );
    });
  };

  const patchRuntime = (runtimePatch: Partial<WarPickRuntimeConfig>) => {
    if (!mountedRef.current) {
      return;
    }

    startTransition(() => {
      setFeedState((currentState) => ({
        ...currentState,
        runtimeConfig: {
          ...currentState.runtimeConfig,
          ...runtimePatch,
        },
      }));
    });
  };

  const refreshLive = async (reason: RefreshReason = 'manual') => {
    const client = getSupabaseClient();
    const nextRefreshAt = new Date().toISOString();

    if (reason !== 'realtime' && mountedRef.current) {
      startTransition(() => {
        setIsRefreshing(true);
      });
    }

    try {
      if (!client) {
        replaceMockRuntime((currentRuntime) => ({
          currentSource: 'mock',
          diagnosticsLabel: '환경 변수가 없어 목업 데이터를 표시합니다',
          liveDataConnected: false,
          lastError: null,
          lastRefreshAt: reason === 'manual' ? nextRefreshAt : currentRuntime.lastRefreshAt,
          refreshCount: reason === 'manual' ? currentRuntime.refreshCount + 1 : currentRuntime.refreshCount,
        }));
        return;
      }

      const liveRiskEvents = await fetchLiveRiskEvents(client);

      if (liveRiskEvents.length === 0) {
        replaceMockRuntime((currentRuntime) => ({
          currentSource: 'live-fallback',
          diagnosticsLabel: '실데이터 테이블이 비어 있어 목업 데이터를 표시합니다',
          envConfigured: true,
          lastError: null,
          liveDataConnected: true,
          lastRefreshAt: nextRefreshAt,
          refreshCount: currentRuntime.refreshCount + 1,
        }));
        return;
      }

      replaceLiveState(liveRiskEvents, (currentRuntime) => ({
        ...currentRuntime,
        envConfigured: true,
        currentSource: 'live',
        liveDataConnected: true,
        diagnosticsLabel: '실시간 Supabase 피드 연결됨',
        lastError: null,
        lastRefreshAt: nextRefreshAt,
        refreshCount: currentRuntime.refreshCount + 1,
      }));
    } catch (error) {
      replaceMockRuntime((currentRuntime) => ({
        currentSource: 'live-fallback',
        diagnosticsLabel: '실데이터 조회 실패로 목업 데이터를 표시합니다',
        envConfigured: true,
        lastError: getErrorMessage(error),
        liveDataConnected: false,
        lastRefreshAt: nextRefreshAt,
        refreshCount: currentRuntime.refreshCount + 1,
      }));
    } finally {
      if (reason !== 'realtime' && mountedRef.current) {
        startTransition(() => {
          setIsRefreshing(false);
        });
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const client = getSupabaseClient();

    if (!client) {
      replaceState(
        createMockState({
          currentSource: 'mock',
          diagnosticsLabel: 'Env missing, mock seed shown',
          liveDataConnected: false,
        }),
      );

      return () => {
        mountedRef.current = false;
      };
    }

    void refreshLive('initial');

    const realtimeChannel: RealtimeChannel = client
      .channel('war-pick-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'risk_events' },
        (payload) => {
          patchRuntime({
            lastRealtimeEvent: `${payload.eventType} risk_events`,
          });
          void refreshLive('realtime');
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asset_impacts' },
        (payload) => {
          patchRuntime({
            lastRealtimeEvent: `${payload.eventType} asset_impacts`,
          });
          void refreshLive('realtime');
        },
      );

    realtimeChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        patchRuntime({
          liveDataConnected: true,
        });
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        patchRuntime({
          diagnosticsLabel: 'Realtime listener unavailable',
          liveDataConnected: false,
        });
      }
    });

    return () => {
      mountedRef.current = false;
      realtimeChannel.unsubscribe().catch(() => {
        // Ignore cleanup errors during unmount.
      });
    };
  }, []);

  return (
    <WarPickFeedContext.Provider
      value={{
        ...feedState,
        isRefreshing,
        refreshLive: () => refreshLive('manual'),
      }}>
      {children}
    </WarPickFeedContext.Provider>
  );
}

export function useWarPickFeed() {
  const context = useContext(WarPickFeedContext);

  if (!context) {
    throw new Error('useWarPickFeed must be used inside WarPickFeedProvider');
  }

  return context;
}
