import type { NormalizedRiskEvent } from './event-types.ts';

export interface PersistenceResult {
  persistedCount: number;
  note: string;
}

export type PersistedRiskEventRow = {
  id: string;
  source: string;
  external_id: string | null;
};

export type RiskEventUpsertRow = {
  source: string;
  source_url: string;
  external_id: string;
  title: string;
  summary_ko: string | null;
  summary_en: string | null;
  event_type: NormalizedRiskEvent['eventType'];
  risk_level: NormalizedRiskEvent['riskLevel'];
  verification_status: NormalizedRiskEvent['verificationStatus'];
  country_code: string | null;
  region_name: string | null;
  latitude: number;
  longitude: number;
  occurred_at: string;
  ai_payload: Record<string, unknown>;
};

export type AssetImpactInsertRow = {
  risk_event_id: string;
  asset_code: string;
  asset_name: string;
  direction: NormalizedRiskEvent['impacts'][number]['direction'];
  confidence: number;
  move_hint: string | null;
  rationale: string | null;
};

type QueryResult<T> = {
  data?: T | null;
  error: unknown | null;
};

export interface PersistenceClient {
  upsertRiskEvents(rows: RiskEventUpsertRow[]): Promise<QueryResult<unknown>>;
  fetchPersistedRiskEvents(filters: {
    sources: string[];
    externalIds: string[];
  }): Promise<QueryResult<PersistedRiskEventRow[]>>;
  deleteAssetImpacts(riskEventIds: string[]): Promise<QueryResult<unknown>>;
  insertAssetImpacts(rows: AssetImpactInsertRow[]): Promise<QueryResult<unknown>>;
}

export async function persistNormalizedEvents(
  normalized: NormalizedRiskEvent[],
  client: PersistenceClient,
): Promise<PersistenceResult> {
  const riskEventRows = normalized.map((event) => ({
    source: event.source,
    source_url: event.sourceUrl,
    external_id: event.externalId ?? event.sourceUrl,
    title: event.title,
    summary_ko: event.summaryKo ?? null,
    summary_en: event.summaryEn ?? null,
    event_type: event.eventType,
    risk_level: event.riskLevel,
    verification_status: event.verificationStatus,
    country_code: event.countryCode ?? null,
    region_name: event.regionName ?? null,
    latitude: event.latitude,
    longitude: event.longitude,
    occurred_at: event.occurredAt,
    ai_payload: event.rawPayload,
  }));

  const { error: upsertError } = await client.upsertRiskEvents(riskEventRows);

  if (upsertError) {
    throw upsertError;
  }

  const eventLookup = normalized.map((event) => ({
    source: event.source,
    externalId: event.externalId ?? event.sourceUrl,
  }));
  const sourceSet = [...new Set(eventLookup.map((event) => event.source))];
  const externalIdSet = [...new Set(eventLookup.map((event) => event.externalId))];

  const { data: persistedEvents, error: fetchError } = await client.fetchPersistedRiskEvents({
    sources: sourceSet,
    externalIds: externalIdSet,
  });

  if (fetchError) {
    throw fetchError;
  }

  const persistedByKey = new Map(
    (persistedEvents ?? []).map((event) => [`${event.source}::${event.external_id}`, event.id]),
  );

  const persistedIds = normalized
    .map((event) => persistedByKey.get(buildEventKey(event.source, event.externalId ?? event.sourceUrl)))
    .filter((eventId): eventId is string => Boolean(eventId));

  if (persistedIds.length === 0) {
    return {
      persistedCount: 0,
      note: 'risk_events upsert 후 이벤트 식별에 실패했습니다.',
    };
  }

  const { error: deleteImpactsError } = await client.deleteAssetImpacts(persistedIds);

  if (deleteImpactsError) {
    throw deleteImpactsError;
  }

  const impactRows = normalized.flatMap((event) => {
    const riskEventId = persistedByKey.get(buildEventKey(event.source, event.externalId ?? event.sourceUrl));

    if (!riskEventId) {
      return [];
    }

    return event.impacts.map((impact) => ({
      risk_event_id: riskEventId,
      asset_code: impact.assetCode,
      asset_name: impact.assetName,
      direction: impact.direction,
      confidence: impact.confidence,
      move_hint: impact.moveHint ?? null,
      rationale: impact.rationale ?? null,
    }));
  });

  if (impactRows.length > 0) {
    const { error: insertImpactsError } = await client.insertAssetImpacts(impactRows);

    if (insertImpactsError) {
      throw insertImpactsError;
    }
  }

  return {
    persistedCount: persistedIds.length,
    note: '정규화 결과를 Supabase risk_events / asset_impacts에 저장했습니다.',
  };
}

function buildEventKey(source: string, externalId: string) {
  return `${source}::${externalId}`;
}
