import type { NormalizedRiskEvent, RawArticle } from '../_shared/event-types.ts';
import { getInvalidArticleReason, normalizeArticle } from '../_shared/ingest-heuristics.ts';
import {
  type PersistenceClient,
  persistNormalizedEvents as persistNormalizedEventsWithClient,
} from '../_shared/ingest-persistence.ts';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request: Request) => {
  try {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const body = await request.json().catch(() => ({}));
    const articles = Array.isArray(body.articles) ? (body.articles as RawArticle[]) : [];
    const dryRun = body.dryRun === true;
    const normalization = normalizeArticles(articles);
    const normalized = normalization.normalized;
    const summary = buildNormalizationSummary(normalized);

    if (normalized.length === 0) {
      return json({
        received: articles.length,
        normalizedCount: 0,
        droppedCount: normalization.dropped.length,
        persistedCount: 0,
        dryRun,
        summary,
        dropped: normalization.dropped,
        normalized,
      });
    }

    const persistence = dryRun
      ? {
          persistedCount: 0,
          note: 'dryRun=true 이라 DB에는 저장하지 않고 정규화 결과만 반환했습니다.',
        }
      : await persistNormalizedEvents(normalized);

    return json({
      received: articles.length,
      normalizedCount: normalized.length,
      droppedCount: normalization.dropped.length,
      persistedCount: persistence.persistedCount,
      dryRun,
      summary,
      dropped: normalization.dropped,
      normalized,
      note: persistence.note,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingest-rss error';

    return json({ error: message }, 500);
  }
});

type DroppedArticle = {
  index: number;
  source: string | null;
  url: string | null;
  reason: string;
};

type NormalizationResult = {
  normalized: NormalizedRiskEvent[];
  dropped: DroppedArticle[];
};

function normalizeArticles(articles: RawArticle[]): NormalizationResult {
  if (articles.length === 0) {
    return {
      normalized: [],
      dropped: [],
    };
  }

  const normalized: NormalizedRiskEvent[] = [];
  const dropped: DroppedArticle[] = [];

  articles.forEach((article, index) => {
    const reason = getInvalidArticleReason(article);

    if (reason) {
      dropped.push({
        index,
        source: article?.source ?? null,
        url: article?.url ?? null,
        reason,
      });
      return;
    }

    const event = normalizeArticle(article);

    if (!event) {
      dropped.push({
        index,
        source: article.source,
        url: article.url,
        reason: 'normalization failed',
      });
      return;
    }

    normalized.push(event);
  });

  return {
    normalized,
    dropped,
  };
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

function buildNormalizationSummary(normalized: NormalizedRiskEvent[]) {
  const eventTypes = Object.fromEntries(countBy(normalized, (event) => event.eventType));
  const riskLevels = Object.fromEntries(countBy(normalized, (event) => event.riskLevel));
  const verificationStatuses = Object.fromEntries(
    countBy(normalized, (event) => event.verificationStatus),
  );
  const regions = Object.fromEntries(
    countBy(normalized, (event) => event.regionName ?? 'Unknown region'),
  );

  return {
    eventTypes,
    riskLevels,
    verificationStatuses,
    regions,
  };
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function createSupabasePersistenceClient(
  supabaseUrl: string,
  secretKey: string,
): PersistenceClient {
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return {
    upsertRiskEvents(rows) {
      return supabase.from('risk_events').upsert(rows, { onConflict: 'source,external_id' });
    },
    fetchPersistedRiskEvents({ sources, externalIds }) {
      return supabase
        .from('risk_events')
        .select('id, source, external_id')
        .in('source', sources)
        .in('external_id', externalIds);
    },
    deleteAssetImpacts(riskEventIds) {
      return supabase.from('asset_impacts').delete().in('risk_event_id', riskEventIds);
    },
    insertAssetImpacts(rows) {
      return supabase.from('asset_impacts').insert(rows);
    },
  };
}

async function persistNormalizedEvents(
  normalized: NormalizedRiskEvent[],
 ) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EXPO_PUBLIC_SUPABASE_URL');
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !secretKey) {
    return {
      persistedCount: 0,
      note:
        'EXPO_PUBLIC_SUPABASE_URL 또는 SUPABASE_SECRET_KEY가 없어 정규화 결과만 반환했습니다.',
    };
  }

  return persistNormalizedEventsWithClient(
    normalized,
    createSupabasePersistenceClient(supabaseUrl, secretKey),
  );
}
