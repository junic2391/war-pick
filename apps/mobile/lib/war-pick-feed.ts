import { startTransition, useEffect, useState } from 'react';

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

export type WarPickRuntimeConfig = {
  envConfigured: boolean;
  currentSource: RuntimeSource;
  liveDataConnected: boolean;
  diagnosticsLabel: string;
  lastError: string | null;
};

export type WarPickFeedState = {
  featuredEvent: RiskEvent;
  latestEvent: RiskEvent;
  riskEvents: RiskEvent[];
  runtimeConfig: WarPickRuntimeConfig;
  totalImpacts: number;
};

let supabaseClient: SupabaseClient | null | undefined;

function getSupabaseClient() {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
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
    envConfigured: Boolean(
      process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    ),
    currentSource: 'mock',
    liveDataConnected: false,
    diagnosticsLabel: 'Mock seed active',
    lastError: null,
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
    countryCode: eventRow.country_code ?? 'N/A',
    regionName: eventRow.region_name ?? 'Unknown region',
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
        moveHint: impactRow.move_hint ?? 'n/a',
        rationale: impactRow.rationale ?? '관련 자산 영향 설명이 아직 없습니다.',
      })),
  }));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown Supabase error';
}

export function useWarPickFeed() {
  const [feedState, setFeedState] = useState<WarPickFeedState>(() => createMockState());

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();
    const replaceState = (nextState: WarPickFeedState) => {
      if (!active) {
        return;
      }

      startTransition(() => {
        setFeedState(nextState);
      });
    };
    const patchRuntime = (runtimePatch: Partial<WarPickRuntimeConfig>) => {
      if (!active) {
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

    if (!client) {
      replaceState(
        createMockState({
          currentSource: 'mock',
          diagnosticsLabel: 'Env missing, mock seed shown',
          liveDataConnected: false,
        }),
      );
      return;
    }

    const liveClient = client;
    const loadLiveFeed = async () => {
      try {
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
          .select(
            'id, risk_event_id, asset_code, asset_name, direction, confidence, move_hint, rationale',
          );

        const { data: impactRows, error: impactError } =
          riskEventIds.length > 0
            ? await impactsQuery.in('risk_event_id', riskEventIds)
            : await impactsQuery.limit(0);

        if (impactError) {
          throw impactError;
        }

        const liveRiskEvents = mapRowsToRiskEvents(
          (eventRows ?? []) as RiskEventRow[],
          (impactRows ?? []) as AssetImpactRow[],
        );

        if (liveRiskEvents.length === 0) {
          replaceState(
            createMockState({
              currentSource: 'live-fallback',
              diagnosticsLabel: 'Live table empty, mock seed shown',
              envConfigured: true,
              lastError: null,
              liveDataConnected: true,
            }),
          );
          return;
        }

        replaceState(
          createState(liveRiskEvents, {
            envConfigured: true,
            currentSource: 'live',
            liveDataConnected: true,
            diagnosticsLabel: 'Live Supabase feed active',
            lastError: null,
          }),
        );
      } catch (error) {
        replaceState(
          createMockState({
            currentSource: 'live-fallback',
            diagnosticsLabel: 'Live fetch failed, mock seed shown',
            envConfigured: true,
            lastError: getErrorMessage(error),
            liveDataConnected: false,
          }),
        );
      }
    };

    loadLiveFeed().catch(() => {
      // loadLiveFeed handles its own fallback state.
    });

    const realtimeChannel: RealtimeChannel = liveClient
      .channel('war-pick-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'risk_events' },
        () => {
          loadLiveFeed().catch(() => {
            // loadLiveFeed handles its own fallback state.
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asset_impacts' },
        () => {
          loadLiveFeed().catch(() => {
            // loadLiveFeed handles its own fallback state.
          });
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
      active = false;
      realtimeChannel.unsubscribe().catch(() => {
        // Ignore cleanup errors during unmount.
      });
    };
  }, []);

  return feedState;
}
