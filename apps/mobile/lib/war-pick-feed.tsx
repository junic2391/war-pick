import { createContext, startTransition, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

import {
  type ConflictStatus,
  type ContentLocale,
  type EventDirection,
  type ImpactDirection,
  type LocalizedBriefingBlock,
  type MarketSentiment,
  type NumericFact,
  type RiskEvent,
  type RiskEventType,
  type RiskLevel,
  type SourceConflict,
  type StoryFact,
  type TimeHorizon,
  type VerificationStatus,
  type WebEnrichmentStatus,
  getFeaturedEvent,
  getLatestEvent,
  getTotalImpacts,
  mockRiskEvents,
} from '@/lib/war-pick-data';

type RiskEventRow = {
  id: string;
  source: string;
  title: string;
  title_ko: string | null;
  title_en: string | null;
  summary_ko: string | null;
  summary_en: string | null;
  source_language: 'ko' | 'en' | 'other' | null;
  event_type: RiskEventType;
  event_sub_type: string | null;
  event_direction: EventDirection | null;
  risk_level: RiskLevel;
  importance_score: number | null;
  confidence_score: number | null;
  verification_status: VerificationStatus;
  market_sentiment: MarketSentiment | null;
  time_horizon: TimeHorizon | null;
  conflict_status: ConflictStatus | null;
  story_key: string | null;
  story_sequence: number | null;
  source_count: number | null;
  country_code: string | null;
  region_name: string | null;
  latitude: number;
  longitude: number;
  occurred_at: string;
  detected_at: string;
  thesis: string | null;
  scenario_base: string | null;
  scenario_bull: string | null;
  scenario_bear: string | null;
  actors_json: { items?: string[] } | null;
  targets_json: { items?: string[] } | null;
  affected_assets_json: { items?: string[] } | null;
  macro_channels_json: { items?: string[] } | null;
  facts_json: { items?: StoryFact[] } | null;
  numeric_facts_json: { items?: NumericFact[] } | null;
  inferences_json: { items?: string[] } | null;
  contradictions_json: { items?: SourceConflict[] } | null;
  web_enriched: boolean | null;
  web_enrichment_status: WebEnrichmentStatus | null;
  briefing_localized_json: Partial<Record<ContentLocale, LocalizedBriefingBlock>> | null;
  ai_payload: {
    sourceLanguage?: 'ko' | 'en' | 'other';
    titleKo?: string;
    titleEn?: string;
    summaryKo?: string;
    summaryEn?: string;
    eventDirection?: EventDirection;
    eventSubType?: string;
    importanceScore?: number;
    confidenceScore?: number;
    marketSentiment?: MarketSentiment;
    timeHorizon?: TimeHorizon;
    conflictStatus?: ConflictStatus;
    storyKeyHint?: string;
    actors?: string[];
    targets?: string[];
    affectedAssets?: string[];
    macroChannels?: string[];
    facts?: StoryFact[];
    numericFacts?: NumericFact[];
    inferences?: string[];
    contradictions?: SourceConflict[];
    thesis?: string;
    scenarioBase?: string;
    scenarioBull?: string;
    scenarioBear?: string;
    webSearchRecommended?: boolean;
  } | null;
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
type IngestStatus = 'idle' | 'running' | 'success' | 'error';

type IngestArticle = {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
};

type IngestResult = {
  received: number;
  normalizedCount: number;
  droppedCount: number;
  persistedCount: number;
  dryRun: boolean;
  note: string | null;
  estimatedCostUsd?: number;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  stage1ArticleCount?: number;
  stage2ArticleCount?: number;
};

type IngestRssSuccessResponse = {
  received: number;
  normalizedCount: number;
  droppedCount: number;
  persistedCount: number;
  dryRun: boolean;
  note?: string;
  processingMetrics?: {
    estimatedCostUsd: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    stage1ArticleCount: number;
    stage2ArticleCount: number;
  };
};

type IngestRssErrorResponse = {
  error: string;
};

type IngestRssResponse = IngestRssSuccessResponse | IngestRssErrorResponse;

export type EventBriefingResponse = {
  eventId: string;
  locale: ContentLocale;
  title: string;
  summary: string;
  briefing: LocalizedBriefingBlock;
  cacheHit: boolean;
  degraded?: boolean;
};

export type WarPickRuntimeConfig = {
  envConfigured: boolean;
  currentSource: RuntimeSource;
  liveDataConnected: boolean;
  diagnosticsLabel: string;
  ingestStatus: IngestStatus;
  ingestStatusLabel: string;
  lastError: string | null;
  lastIngestAt: string | null;
  lastIngestError: string | null;
  lastIngestResult: IngestResult | null;
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
  isIngesting: boolean;
  isRefreshing: boolean;
  refreshLive: () => Promise<void>;
  runIngest: () => Promise<void>;
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

function isJwtLikeToken(value: string | undefined) {
  return Boolean(value && value.split('.').length === 3);
}

function getSupabaseFunctionsJwt() {
  const explicitFunctionsJwt = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_JWT;

  if (isJwtLikeToken(explicitFunctionsJwt)) {
    return explicitFunctionsJwt;
  }

  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (isJwtLikeToken(anonKey)) {
    return anonKey;
  }

  const primaryKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

  if (isJwtLikeToken(primaryKey)) {
    return primaryKey;
  }

  const fallbackKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (isJwtLikeToken(fallbackKey)) {
    return fallbackKey;
  }

  return null;
}

function getDirectIngestRssUrl() {
  const directUrl = process.env.EXPO_PUBLIC_INGEST_RSS_URL?.trim();

  if (directUrl) {
    return directUrl;
  }

  return null;
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

function isoMinutesAgo(baseTimestamp: number, minutes: number) {
  return new Date(baseTimestamp - minutes * 60_000).toISOString();
}

function createManualIngestArticles(): IngestArticle[] {
  const now = Date.now();

  return [
    {
      title: 'Reuters: Missile alert raises tanker risk near Strait of Hormuz',
      summary:
        'Shipping insurers warned that repeated missile alerts near the Strait of Hormuz could disrupt crude flows and lift safe-haven demand across global markets.',
      source: 'Reuters',
      url: 'https://example.com/hormuz-alert',
      publishedAt: isoMinutesAgo(now, 6),
    },
    {
      title: 'Drone threat forces carriers to reroute vessels in the Red Sea',
      summary:
        'Major shipping companies said they are reviewing routes after another drone-related threat near the Bab el-Mandeb chokepoint.',
      source: 'Regional Wire',
      url: 'https://example.com/red-sea-drone',
      publishedAt: isoMinutesAgo(now, 14),
    },
    {
      title: 'Port advisory monitors sanctions pressure on Black Sea grain corridor',
      summary:
        'Advisers said a fresh sanctions warning may pressure Black Sea logistics and keep commodity risk sentiment elevated across regional markets.',
      source: 'Market Pulse',
      url: 'https://example.com/black-sea-sanctions',
      publishedAt: isoMinutesAgo(now, 28),
    },
  ];
}

function buildIngestStatusLabel(result: IngestResult) {
  if (result.dryRun) {
    return `${result.normalizedCount}건 분석`;
  }

  if (result.persistedCount > 0) {
    return `${result.persistedCount}건 저장`;
  }

  if (result.normalizedCount > 0) {
    return `${result.normalizedCount}건 정규화`;
  }

  return '0건 반영';
}

function deriveImportanceScoreFromRiskLevel(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case 'critical':
      return 9;
    case 'high':
      return 7;
    case 'medium':
      return 5;
    case 'low':
    default:
      return 3;
  }
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
    ingestStatus: 'idle',
    ingestStatusLabel: '대기 중',
    lastError: null,
    lastIngestAt: null,
    lastIngestError: null,
    lastIngestResult: null,
    lastRefreshAt: null,
    refreshCount: 0,
    lastRealtimeEvent: null,
    ...runtimeConfig,
  });
}

function mapRowsToRiskEvents(eventRows: RiskEventRow[], impactRows: AssetImpactRow[]) {
  return eventRows.map((eventRow) => {
    const importanceScore =
      typeof eventRow.importance_score === 'number'
        ? eventRow.importance_score
        : typeof eventRow.ai_payload?.importanceScore === 'number'
          ? eventRow.ai_payload.importanceScore
          : deriveImportanceScoreFromRiskLevel(eventRow.risk_level);

    return {
      id: eventRow.id,
      source: eventRow.source,
      title: eventRow.title,
      titleKo: eventRow.title_ko ?? eventRow.ai_payload?.titleKo ?? undefined,
      titleEn: eventRow.title_en ?? eventRow.ai_payload?.titleEn ?? undefined,
      summary: eventRow.summary_ko ?? eventRow.summary_en ?? '요약이 아직 도착하지 않았습니다.',
      summaryKo: eventRow.summary_ko ?? eventRow.ai_payload?.summaryKo ?? undefined,
      summaryEn: eventRow.summary_en ?? eventRow.ai_payload?.summaryEn ?? undefined,
      sourceLanguage: eventRow.source_language ?? eventRow.ai_payload?.sourceLanguage ?? 'other',
      eventType: eventRow.event_type,
      eventSubType: eventRow.event_sub_type ?? eventRow.ai_payload?.eventSubType,
      eventDirection: eventRow.event_direction ?? eventRow.ai_payload?.eventDirection ?? 'escalation',
      riskLevel: eventRow.risk_level,
      importanceScore,
      confidenceScore:
        typeof eventRow.confidence_score === 'number'
          ? eventRow.confidence_score
          : typeof eventRow.ai_payload?.confidenceScore === 'number'
            ? eventRow.ai_payload.confidenceScore
            : 0.66,
      verificationStatus: eventRow.verification_status,
      marketSentiment: eventRow.market_sentiment ?? eventRow.ai_payload?.marketSentiment ?? 'neutral',
      timeHorizon: eventRow.time_horizon ?? eventRow.ai_payload?.timeHorizon ?? 'intraday',
      conflictStatus: eventRow.conflict_status ?? eventRow.ai_payload?.conflictStatus ?? 'active_conflict',
      storyKey: eventRow.story_key ?? eventRow.ai_payload?.storyKeyHint ?? eventRow.id,
      storySequence: eventRow.story_sequence ?? 1,
      sourceCount: eventRow.source_count ?? 1,
      countryCode: eventRow.country_code ?? '미상',
      regionName: eventRow.region_name ?? '지역 미상',
      latitude: eventRow.latitude,
      longitude: eventRow.longitude,
      occurredAt: eventRow.occurred_at,
      detectedAt: eventRow.detected_at,
      actors: eventRow.actors_json?.items ?? eventRow.ai_payload?.actors ?? [],
      targets: eventRow.targets_json?.items ?? eventRow.ai_payload?.targets ?? [],
      affectedAssets: eventRow.affected_assets_json?.items ?? eventRow.ai_payload?.affectedAssets ?? [],
      macroChannels: eventRow.macro_channels_json?.items ?? eventRow.ai_payload?.macroChannels ?? [],
      facts: eventRow.facts_json?.items ?? eventRow.ai_payload?.facts ?? [],
      numericFacts: eventRow.numeric_facts_json?.items ?? eventRow.ai_payload?.numericFacts ?? [],
      inferences: eventRow.inferences_json?.items ?? eventRow.ai_payload?.inferences ?? [],
      contradictions: eventRow.contradictions_json?.items ?? eventRow.ai_payload?.contradictions ?? [],
      thesis: eventRow.thesis ?? eventRow.ai_payload?.thesis ?? '시장 해석이 아직 도착하지 않았습니다.',
      scenarioBase:
        eventRow.scenario_base ?? eventRow.ai_payload?.scenarioBase ?? '기본 시나리오가 아직 없습니다.',
      scenarioBull:
        eventRow.scenario_bull ?? eventRow.ai_payload?.scenarioBull ?? '상방 시나리오가 아직 없습니다.',
      scenarioBear:
        eventRow.scenario_bear ?? eventRow.ai_payload?.scenarioBear ?? '하방 시나리오가 아직 없습니다.',
      webEnriched: eventRow.web_enriched ?? false,
      webEnrichmentStatus:
        eventRow.web_enrichment_status ??
        (eventRow.ai_payload?.webSearchRecommended ? 'pending' : 'not_needed'),
      localizedBriefing: eventRow.briefing_localized_json ?? undefined,
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
    };
  });
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
      'id, source, title, title_ko, title_en, summary_ko, summary_en, source_language, event_type, event_sub_type, event_direction, risk_level, importance_score, confidence_score, verification_status, market_sentiment, time_horizon, conflict_status, story_key, story_sequence, source_count, country_code, region_name, latitude, longitude, occurred_at, detected_at, thesis, scenario_base, scenario_bull, scenario_bear, actors_json, targets_json, affected_assets_json, macro_channels_json, facts_json, numeric_facts_json, inferences_json, contradictions_json, web_enriched, web_enrichment_status, briefing_localized_json, ai_payload',
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
  const [isIngesting, setIsIngesting] = useState(false);
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

  const runIngest = async () => {
    const client = getSupabaseClient();
    const nextIngestAt = new Date().toISOString();
    const functionsJwt = getSupabaseFunctionsJwt();
    const directIngestRssUrl = getDirectIngestRssUrl();
    const articles = createManualIngestArticles();

    if (!client && !directIngestRssUrl) {
      patchRuntime({
        ingestStatus: 'error',
        ingestStatusLabel: '환경 변수 필요',
        lastIngestAt: nextIngestAt,
        lastIngestError: 'Supabase client 또는 EXPO_PUBLIC_INGEST_RSS_URL 설정이 없습니다.',
        lastIngestResult: null,
      });
      return;
    }

    if (!directIngestRssUrl && !functionsJwt) {
      patchRuntime({
        ingestStatus: 'error',
        ingestStatusLabel: 'JWT 필요',
        lastIngestAt: nextIngestAt,
        lastIngestError:
          'Edge Function 호출용 JWT가 없습니다. 로컬이면 EXPO_PUBLIC_INGEST_RSS_URL을, 원격이면 EXPO_PUBLIC_SUPABASE_ANON_KEY 또는 EXPO_PUBLIC_SUPABASE_FUNCTIONS_JWT를 설정하세요.',
        lastIngestResult: null,
      });
      return;
    }

    if (mountedRef.current) {
      startTransition(() => {
        setIsIngesting(true);
      });
    }

    patchRuntime({
      ingestStatus: 'running',
      ingestStatusLabel: '실행 중',
      lastIngestAt: nextIngestAt,
      lastIngestError: null,
    });

    try {
      let data: IngestRssResponse | null = null;

      if (directIngestRssUrl) {
        const response = await fetch(directIngestRssUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            articles,
            fetchFromRss: true,
            dryRun: false,
          }),
        });

        const payload = (await response.json().catch(() => null)) as IngestRssResponse | null;

        if (!response.ok) {
          const message =
            payload && 'error' in payload && typeof payload.error === 'string'
              ? payload.error
              : `HTTP ${response.status}`;

          throw new Error(message);
        }

        data = payload;
      } else {
        const invokeJwt = functionsJwt!;
        const response = await client!.functions.invoke<IngestRssResponse>('ingest-rss', {
          body: {
            articles,
            fetchFromRss: true,
            dryRun: false,
          },
          headers: {
            Authorization: `Bearer ${invokeJwt}`,
            apikey: invokeJwt,
          },
        });

        if (response.error) {
          throw response.error;
        }

        data = response.data;
      }

      if (!data) {
        throw new Error('ingest-rss response missing');
      }

      if ('error' in data) {
        throw new Error(data.error);
      }

      const result: IngestResult = {
        received: data.received,
        normalizedCount: data.normalizedCount,
        droppedCount: data.droppedCount,
        persistedCount: data.persistedCount,
        dryRun: data.dryRun,
        note: data.note ?? null,
        estimatedCostUsd: data.processingMetrics?.estimatedCostUsd,
        estimatedInputTokens: data.processingMetrics?.estimatedInputTokens,
        estimatedOutputTokens: data.processingMetrics?.estimatedOutputTokens,
        stage1ArticleCount: data.processingMetrics?.stage1ArticleCount,
        stage2ArticleCount: data.processingMetrics?.stage2ArticleCount,
      };

      patchRuntime({
        ingestStatus: 'success',
        ingestStatusLabel: buildIngestStatusLabel(result),
        lastIngestAt: nextIngestAt,
        lastIngestError: null,
        lastIngestResult: result,
      });

      await refreshLive('manual');
    } catch (error) {
      patchRuntime({
        ingestStatus: 'error',
        ingestStatusLabel: '실패',
        lastIngestAt: nextIngestAt,
        lastIngestError: getErrorMessage(error),
        lastIngestResult: null,
      });
    } finally {
      if (mountedRef.current) {
        startTransition(() => {
          setIsIngesting(false);
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
        isIngesting,
        isRefreshing,
        refreshLive: () => refreshLive('manual'),
        runIngest,
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

export async function fetchEventBriefing(
  eventId: string,
  locale: ContentLocale,
): Promise<EventBriefingResponse> {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const functionsJwt = getSupabaseFunctionsJwt();
  const response = await client.functions.invoke<EventBriefingResponse | { error: string }>(
    'event-briefing',
    {
      body: {
        eventId,
        locale,
      },
      headers: functionsJwt
        ? {
            Authorization: `Bearer ${functionsJwt}`,
            apikey: functionsJwt,
          }
        : undefined,
    },
  );

  if (response.error) {
    throw response.error;
  }

  if (!response.data) {
    throw new Error('event-briefing response missing');
  }

  if ('error' in response.data) {
    throw new Error(response.data.error);
  }

  return response.data;
}
