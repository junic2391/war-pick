import type { NormalizedRiskEvent, RawArticle } from '../_shared/event-types.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const body = await request.json().catch(() => ({}));
    const articles = Array.isArray(body.articles) ? (body.articles as RawArticle[]) : [];

    const normalized = await normalizeArticles(articles);

    if (normalized.length === 0) {
      return json({
        received: articles.length,
        normalizedCount: 0,
        persistedCount: 0,
        normalized,
      });
    }

    const persistence = await persistNormalizedEvents(normalized);

    return json({
      received: articles.length,
      normalizedCount: normalized.length,
      persistedCount: persistence.persistedCount,
      normalized,
      note: persistence.note,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingest-rss error';

    return json({ error: message }, 500);
  }
});

async function normalizeArticles(articles: RawArticle[]): Promise<NormalizedRiskEvent[]> {
  if (articles.length === 0) {
    return [];
  }

  return articles.map((article) => ({
    title: article.title,
    source: article.source,
    sourceUrl: article.url,
    externalId: article.url,
    summaryKo: article.summary,
    summaryEn: article.summary,
    eventType: classifyEventType(article.title),
    riskLevel: classifyRiskLevel(article.title),
    countryCode: undefined,
    regionName: 'Unknown region',
    latitude: 0,
    longitude: 0,
    occurredAt: article.publishedAt,
    impacts: [],
    rawPayload: {
      article,
      todo: 'Replace heuristics with Gemini extraction and source verification.',
    },
  }));
}

function classifyEventType(title: string): NormalizedRiskEvent['eventType'] {
  const lowered = title.toLowerCase();

  if (lowered.includes('drone')) {
    return 'drone';
  }

  if (lowered.includes('missile')) {
    return 'missile';
  }

  if (lowered.includes('sanction')) {
    return 'sanction';
  }

  if (lowered.includes('naval') || lowered.includes('ship')) {
    return 'naval';
  }

  return 'bombing';
}

function classifyRiskLevel(title: string): NormalizedRiskEvent['riskLevel'] {
  const lowered = title.toLowerCase();

  if (
    lowered.includes('strait') ||
    lowered.includes('oil') ||
    lowered.includes('port') ||
    lowered.includes('terminal')
  ) {
    return 'high';
  }

  return 'medium';
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

interface PersistenceResult {
  persistedCount: number;
  note: string;
}

async function persistNormalizedEvents(
  normalized: NormalizedRiskEvent[],
): Promise<PersistenceResult> {
  const supabaseUrl = Deno.env.get('EXPO_PUBLIC_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      persistedCount: 0,
      note:
        'EXPO_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없어 정규화 결과만 반환했습니다.',
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const riskEventRows = normalized.map((event) => ({
    source: event.source,
    source_url: event.sourceUrl,
    external_id: event.externalId ?? event.sourceUrl,
    title: event.title,
    summary_ko: event.summaryKo ?? null,
    summary_en: event.summaryEn ?? null,
    event_type: event.eventType,
    risk_level: event.riskLevel,
    country_code: event.countryCode ?? null,
    region_name: event.regionName ?? null,
    latitude: event.latitude,
    longitude: event.longitude,
    occurred_at: event.occurredAt,
    ai_payload: event.rawPayload,
  }));

  const { error: upsertError } = await supabase
    .from('risk_events')
    .upsert(riskEventRows, { onConflict: 'source,external_id' });

  if (upsertError) {
    throw upsertError;
  }

  const eventLookup = normalized.map((event) => ({
    source: event.source,
    externalId: event.externalId ?? event.sourceUrl,
  }));

  const sourceSet = [...new Set(eventLookup.map((event) => event.source))];
  const externalIdSet = [...new Set(eventLookup.map((event) => event.externalId))];

  const { data: persistedEvents, error: fetchError } = await supabase
    .from('risk_events')
    .select('id, source, external_id')
    .in('source', sourceSet)
    .in('external_id', externalIdSet);

  if (fetchError) {
    throw fetchError;
  }

  const persistedByKey = new Map(
    (persistedEvents ?? []).map((event) => [`${event.source}::${event.external_id}`, event.id]),
  );

  const persistedIds = normalized
    .map((event) => persistedByKey.get(`${event.source}::${event.externalId ?? event.sourceUrl}`))
    .filter((eventId): eventId is string => Boolean(eventId));

  if (persistedIds.length === 0) {
    return {
      persistedCount: 0,
      note: 'risk_events upsert 후 이벤트 식별에 실패했습니다.',
    };
  }

  const { error: deleteImpactsError } = await supabase
    .from('asset_impacts')
    .delete()
    .in('risk_event_id', persistedIds);

  if (deleteImpactsError) {
    throw deleteImpactsError;
  }

  const impactRows = normalized.flatMap((event) => {
    const riskEventId = persistedByKey.get(`${event.source}::${event.externalId ?? event.sourceUrl}`);

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
    const { error: insertImpactsError } = await supabase.from('asset_impacts').insert(impactRows);

    if (insertImpactsError) {
      throw insertImpactsError;
    }
  }

  return {
    persistedCount: persistedIds.length,
    note: '정규화 결과를 Supabase risk_events / asset_impacts에 저장했습니다.',
  };
}
