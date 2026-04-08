import type {
  NormalizedRiskEvent,
  RawArticle,
} from "../_shared/event-types.ts";
import {
  buildNormalizedEventFromAiClassification,
  decorateStoryMetadata,
  getInvalidArticleReason,
} from "../_shared/ai-normalization.ts";
import { enrichEventsWithWebSearch } from "../_shared/web-enrichment.ts";
import {
  type PersistenceClient,
  persistNormalizedEvents as persistNormalizedEventsWithClient,
} from "../_shared/ingest-persistence.ts";
import {
  type AiClassificationMetrics,
  classifyArticlesWithAi,
} from "../_shared/ai-classifier.ts";
import {
  fetchArticlesFromRssSourceUrls,
  parseRssSourceUrls,
} from "../_shared/rss-fetch.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request: Request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await request.json().catch(() => ({}));
    const requestArticles = Array.isArray(body.articles)
      ? (body.articles as RawArticle[])
      : [];
    const requestedSourceUrls = Array.isArray(body.sourceUrls)
      ? body.sourceUrls.filter((item: unknown): item is string =>
        typeof item === "string"
      )
      : [];
    const configuredSourceUrls = parseRssSourceUrls(
      Deno.env.get("RSS_SOURCE_URLS"),
    );
    const sourceUrls = requestedSourceUrls.length > 0
      ? requestedSourceUrls
      : configuredSourceUrls;
    const fetchFromRss = body.fetchFromRss === true;
    const dryRun = body.dryRun === true;
    const articles =
      sourceUrls.length > 0 && (fetchFromRss || requestArticles.length === 0)
        ? await fetchArticlesFromRssSourceUrls(sourceUrls)
        : requestArticles;
    const usesRssSourceFetch = sourceUrls.length > 0 &&
      (fetchFromRss || requestArticles.length === 0);

    if (articles.length === 0 && sourceUrls.length === 0) {
      return json(
        {
          error: "No articles provided and RSS_SOURCE_URLS is empty.",
        },
        400,
      );
    }

    const normalization = await normalizeArticles(articles);
    const normalized = normalization.normalized;
    const summary = buildNormalizationSummary(
      normalized,
      normalization.dropped,
      normalization.processingMetrics,
    );
    const articleSource = usesRssSourceFetch
      ? "rss-source-urls"
      : "request-body";

    if (normalized.length === 0) {
      return json({
        articleSource,
        received: articles.length,
        normalizedCount: 0,
        droppedCount: normalization.dropped.length,
        persistedCount: 0,
        dryRun,
        sourceUrlsUsed: sourceUrls,
        classifierMode: normalization.classifierMode,
        processingMetrics: normalization.processingMetrics,
        summary,
        dropped: normalization.dropped,
        normalized,
        note: normalization.note,
      });
    }

    const persistence = dryRun
      ? {
        persistedCount: 0,
        note:
          "dryRun=true 이라 DB에는 저장하지 않고 정규화 결과만 반환했습니다.",
      }
      : await persistNormalizedEvents(normalized);

    return json({
      articleSource,
      received: articles.length,
      normalizedCount: normalized.length,
      droppedCount: normalization.dropped.length,
      persistedCount: persistence.persistedCount,
      dryRun,
      sourceUrlsUsed: sourceUrls,
      classifierMode: normalization.classifierMode,
      processingMetrics: normalization.processingMetrics,
      summary,
      dropped: normalization.dropped,
      normalized,
      note:
        [normalization.note, persistence.note].filter(Boolean).join(" | ") ||
        undefined,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unknown ingest-rss error";

    return json({ error: message }, 500);
  }
});

type DroppedArticle = {
  index: number;
  title: string | null;
  source: string | null;
  url: string | null;
  reason: string;
};

type NormalizationResult = {
  normalized: NormalizedRiskEvent[];
  dropped: DroppedArticle[];
  classifierMode: "ai";
  processingMetrics: AiClassificationMetrics;
  note?: string;
};

async function normalizeArticles(
  articles: RawArticle[],
): Promise<NormalizationResult> {
  if (articles.length === 0) {
    return {
      normalized: [],
      dropped: [],
      classifierMode: "ai",
      processingMetrics: emptyAiMetrics(),
    };
  }

  const normalized: NormalizedRiskEvent[] = [];
  const dropped: DroppedArticle[] = [];
  const aiCandidates: Array<{ index: number; article: RawArticle }> = [];
  const publishMinImportance = getPublishMinImportance();

  articles.forEach((article, index) => {
    const reason = getInvalidArticleReason(article);

    if (reason) {
      dropped.push({
        index,
        title: article?.title ?? null,
        source: article?.source ?? null,
        url: article?.url ?? null,
        reason,
      });
      return;
    }

    aiCandidates.push({ index, article });
  });

  const aiResult = await classifyArticlesWithAi(aiCandidates, {
    publishMinImportance,
  });

  const classificationMap = new Map(
    aiResult.classifications.map((
      { index, classification },
    ) => [index, classification]),
  );

  aiCandidates.forEach(({ index, article }) => {
    const classification = classificationMap.get(index);

    if (!classification) {
      dropped.push({
        index,
        title: article.title,
        source: article.source,
        url: article.url,
        reason: "ai_unclassified",
      });
      return;
    }

    if (!classification.relevant) {
      dropped.push({
        index,
        title: article.title,
        source: article.source,
        url: article.url,
        reason: classification.reason ?? "ai_irrelevant",
      });
      return;
    }

    if ((classification.importanceScore ?? 0) < publishMinImportance) {
      dropped.push({
        index,
        title: article.title,
        source: article.source,
        url: article.url,
        reason: `below_publish_threshold_${publishMinImportance}`,
      });
      return;
    }

    const event = buildNormalizedEventFromAiClassification(
      article,
      classification,
    );

    if (!event) {
      dropped.push({
        index,
        title: article.title,
        source: article.source,
        url: article.url,
        reason: "ai_invalid_classification",
      });
      return;
    }

    normalized.push(event);
  });

  return {
    normalized: await enrichEventsWithWebSearch(
      decorateStoryMetadata(normalized),
    ),
    dropped,
    classifierMode: "ai",
    processingMetrics: aiResult.metrics,
    note:
      `Stage 1 triage ${aiResult.metrics.stage1ArticleCount}건 / Stage 2 enrich ${aiResult.metrics.stage2ArticleCount}건 처리 후 importanceScore ${publishMinImportance}+ 이벤트만 publish했습니다.`,
  };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function buildNormalizationSummary(
  normalized: NormalizedRiskEvent[],
  dropped: DroppedArticle[],
  processingMetrics?: AiClassificationMetrics,
) {
  const eventTypes = Object.fromEntries(
    countBy(normalized, (event) => event.eventType),
  );
  const eventSubTypes = Object.fromEntries(
    countBy(normalized, (event) => event.eventSubType ?? "unknown_subtype"),
  );
  const eventDirections = Object.fromEntries(
    countBy(normalized, (event) => event.eventDirection),
  );
  const riskLevels = Object.fromEntries(
    countBy(normalized, (event) => event.riskLevel),
  );
  const importanceBands = Object.fromEntries(
    countBy(normalized, (event) => getImportanceBand(event.importanceScore)),
  );
  const verificationStatuses = Object.fromEntries(
    countBy(normalized, (event) => event.verificationStatus),
  );
  const regions = Object.fromEntries(
    countBy(normalized, (event) => event.regionName ?? "Unknown region"),
  );
  const droppedReasons = Object.fromEntries(
    countBy(dropped, (article) => article.reason),
  );
  const marketSentiments = Object.fromEntries(
    countBy(normalized, (event) => event.marketSentiment),
  );
  const conflictStatuses = Object.fromEntries(
    countBy(normalized, (event) => event.conflictStatus),
  );
  const webEnrichmentStatuses = Object.fromEntries(
    countBy(normalized, (event) => event.webEnrichmentStatus),
  );
  const storyKeys = Object.fromEntries(
    countBy(normalized, (event) => event.storyKey),
  );

  return {
    eventTypes,
    eventSubTypes,
    eventDirections,
    riskLevels,
    importanceBands,
    verificationStatuses,
    marketSentiments,
    conflictStatuses,
    webEnrichmentStatuses,
    regions,
    storyKeys,
    droppedReasons,
    processingMetrics,
  };
}

function getImportanceBand(importanceScore: number) {
  if (importanceScore >= 9) {
    return "critical_9_10";
  }

  if (importanceScore >= 7) {
    return "high_7_8";
  }

  if (importanceScore >= 4) {
    return "medium_4_6";
  }

  return "low_0_3";
}

function getPublishMinImportance() {
  const value = Number(Deno.env.get("AI_PUBLISH_MIN_IMPORTANCE") ?? "4");

  if (!Number.isFinite(value)) {
    return 4;
  }

  return Math.max(0, Math.min(10, Math.round(value)));
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return [...counts.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
}

function emptyAiMetrics(): AiClassificationMetrics {
  return {
    stage1ArticleCount: 0,
    stage2ArticleCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedCostUsd: 0,
  };
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
      return supabase.from("risk_events").upsert(rows, {
        onConflict: "source,external_id",
      });
    },
    fetchPersistedRiskEvents({ sources, externalIds }) {
      return supabase
        .from("risk_events")
        .select("id, source, external_id")
        .in("source", sources)
        .in("external_id", externalIds);
    },
    deleteAssetImpacts(riskEventIds) {
      return supabase.from("asset_impacts").delete().in(
        "risk_event_id",
        riskEventIds,
      );
    },
    insertAssetImpacts(rows) {
      return supabase.from("asset_impacts").insert(rows);
    },
  };
}

async function persistNormalizedEvents(
  normalized: NormalizedRiskEvent[],
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ??
    Deno.env.get("EXPO_PUBLIC_SUPABASE_URL");
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !secretKey) {
    return {
      persistedCount: 0,
      note:
        "EXPO_PUBLIC_SUPABASE_URL 또는 SUPABASE_SECRET_KEY가 없어 정규화 결과만 반환했습니다.",
    };
  }

  return persistNormalizedEventsWithClient(
    normalized,
    createSupabasePersistenceClient(supabaseUrl, secretKey),
  );
}
