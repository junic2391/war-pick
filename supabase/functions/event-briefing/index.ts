import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_GOOGLE_GENAI_MODEL = "gemini-2.5-flash-lite";

type SupportedLocale = "ko" | "en";

type EventBriefingRequest = {
  eventId?: string;
  locale?: string;
};

type LocalizedBriefing = {
  fact: string;
  insight: string;
  uncertainty?: string;
  scenarioBase?: string;
  meta?: string;
};

type RiskEventBriefingRow = {
  id: string;
  source: string;
  title: string;
  title_ko: string | null;
  title_en: string | null;
  summary_ko: string | null;
  summary_en: string | null;
  source_language: string | null;
  verification_status: string;
  source_count: number | null;
  web_enriched: boolean | null;
  web_enrichment_status: string | null;
  thesis: string | null;
  scenario_base: string | null;
  facts_json: { items?: Array<{ claim?: string; source?: string }> } | null;
  inferences_json: { items?: string[] } | null;
  contradictions_json: {
    items?: Array<{ description?: string; sourceA?: string; sourceB?: string }>;
  } | null;
  numeric_facts_json: {
    items?: Array<{ label?: string; value?: number; unit?: string; asOfDate?: string }>;
  } | null;
  briefing_localized_json: Record<string, unknown> | null;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

Deno.serve(async (request: Request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await request.json().catch(() => ({})) as EventBriefingRequest;
    const eventId = body.eventId?.trim();
    const locale = body.locale === "en" ? "en" : "ko";

    if (!eventId) {
      return json({ error: "eventId is required" }, 400);
    }

    const supabase = createServiceRoleClient();
    const { data: eventRow, error } = await supabase
      .from("risk_events")
      .select(
        "id, source, title, title_ko, title_en, summary_ko, summary_en, source_language, verification_status, source_count, web_enriched, web_enrichment_status, thesis, scenario_base, facts_json, inferences_json, contradictions_json, numeric_facts_json, briefing_localized_json",
      )
      .eq("id", eventId)
      .maybeSingle<RiskEventBriefingRow>();

    if (error) {
      throw error;
    }

    if (!eventRow) {
      return json({ error: "event not found" }, 404);
    }

    const title = locale === "en"
      ? eventRow.title_en ?? eventRow.title
      : eventRow.title_ko ?? eventRow.title;
    const summary = locale === "en"
      ? eventRow.summary_en ?? eventRow.summary_ko ?? ""
      : eventRow.summary_ko ?? eventRow.summary_en ?? "";
    const cachedBriefing = getCachedBriefing(
      eventRow.briefing_localized_json,
      locale,
    );

    if (cachedBriefing) {
      return json({
        eventId,
        locale,
        title,
        summary,
        briefing: cachedBriefing,
        cacheHit: true,
      });
    }

    const apiKey = Deno.env.get("GOOGLE_GENAI_API_KEY");

    if (!apiKey) {
      return json({
        eventId,
        locale,
        title,
        summary,
        briefing: buildFallbackBriefing(eventRow, locale),
        cacheHit: false,
        degraded: true,
      });
    }

    const briefing = await generateLocalizedBriefing(eventRow, locale, apiKey);
    const nextBriefingJson = {
      ...(eventRow.briefing_localized_json ?? {}),
      [locale]: briefing,
    };
    const { error: updateError } = await supabase
      .from("risk_events")
      .update({
        briefing_localized_json: nextBriefingJson,
      })
      .eq("id", eventId);

    if (updateError) {
      throw updateError;
    }

    return json({
      eventId,
      locale,
      title,
      summary,
      briefing,
      cacheHit: false,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unknown event-briefing error";

    return json({ error: message }, 500);
  }
});

function createServiceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ??
    Deno.env.get("EXPO_PUBLIC_SUPABASE_URL");
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !secretKey) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getCachedBriefing(
  payload: Record<string, unknown> | null,
  locale: SupportedLocale,
) {
  const candidate = payload?.[locale];

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const briefing = candidate as Partial<LocalizedBriefing>;

  if (!briefing.fact || !briefing.insight) {
    return null;
  }

  return {
    fact: briefing.fact,
    insight: briefing.insight,
    uncertainty: briefing.uncertainty,
    scenarioBase: briefing.scenarioBase,
    meta: briefing.meta,
  } satisfies LocalizedBriefing;
}

async function generateLocalizedBriefing(
  eventRow: RiskEventBriefingRow,
  locale: SupportedLocale,
  apiKey: string,
) {
  const model = Deno.env.get("GOOGLE_GENAI_MODEL") || DEFAULT_GOOGLE_GENAI_MODEL;
  const prompt = buildBriefingPrompt(eventRow, locale);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini briefing failed: ${response.status} ${message}`);
  }

  const data = await response.json() as GeminiResponse;
  const responseText = data.candidates?.[0]?.content?.parts?.map((part) =>
    part.text ?? ""
  ).join("").trim();

  if (!responseText) {
    throw new Error("Gemini briefing failed: empty response");
  }

  const payload = parseJsonPayload<LocalizedBriefing>(responseText);

  if (!payload.fact || !payload.insight) {
    throw new Error("Gemini briefing failed: invalid localized briefing");
  }

  return {
    fact: payload.fact.trim(),
    insight: payload.insight.trim(),
    uncertainty: payload.uncertainty?.trim() || undefined,
    scenarioBase: payload.scenarioBase?.trim() || undefined,
    meta: payload.meta?.trim() || undefined,
  } satisfies LocalizedBriefing;
}

function buildBriefingPrompt(
  eventRow: RiskEventBriefingRow,
  locale: SupportedLocale,
) {
  const language = locale === "en" ? "English" : "Korean";

  return [
    "You are localizing a concise investor briefing for a geopolitical risk event.",
    `Write every field in ${language}.`,
    "Return JSON only with shape:",
    '{"fact":"...","insight":"...","uncertainty":"...","scenarioBase":"...","meta":"..."}',
    "fact and insight are required.",
    "uncertainty is optional and should be omitted when there is no conflict.",
    "scenarioBase is optional and should be one short sentence.",
    "meta should be a compact status line mentioning verification, web enrichment, and source count.",
    "Keep each field short and scannable for a mobile bottom sheet.",
    "Do not invent new facts. Use only the provided structured fields.",
    "Structured event data:",
    JSON.stringify({
      source: eventRow.source,
      title: eventRow.title,
      titleKo: eventRow.title_ko,
      titleEn: eventRow.title_en,
      summaryKo: eventRow.summary_ko,
      summaryEn: eventRow.summary_en,
      sourceLanguage: eventRow.source_language,
      verificationStatus: eventRow.verification_status,
      sourceCount: eventRow.source_count,
      webEnriched: eventRow.web_enriched,
      webEnrichmentStatus: eventRow.web_enrichment_status,
      thesis: eventRow.thesis,
      scenarioBase: eventRow.scenario_base,
      facts: eventRow.facts_json?.items ?? [],
      inferences: eventRow.inferences_json?.items ?? [],
      contradictions: eventRow.contradictions_json?.items ?? [],
      numericFacts: eventRow.numeric_facts_json?.items ?? [],
    }),
  ].join("\n");
}

function buildFallbackBriefing(
  eventRow: RiskEventBriefingRow,
  locale: SupportedLocale,
): LocalizedBriefing {
  const fact = eventRow.facts_json?.items?.[0]?.claim?.trim() ||
    (locale === "en"
      ? "Detailed fact briefing is still being prepared."
      : "세부 사실 브리핑을 준비 중입니다.");
  const insight = eventRow.inferences_json?.items?.[0]?.trim() ||
    eventRow.thesis?.trim() ||
    (locale === "en"
      ? "Market interpretation is still being prepared."
      : "시장 해석을 준비 중입니다.");
  const uncertainty = eventRow.contradictions_json?.items?.[0]?.description?.trim();
  const sourceCount = eventRow.source_count ?? 1;
  const meta = locale === "en"
    ? `Verified: ${eventRow.verification_status} · Sources: ${sourceCount} · Web: ${eventRow.web_enrichment_status ?? "n/a"}`
    : `검증 ${eventRow.verification_status} · 출처 ${sourceCount}개 · 웹 ${eventRow.web_enrichment_status ?? "없음"}`;

  return {
    fact,
    insight,
    uncertainty,
    scenarioBase: eventRow.scenario_base ?? undefined,
    meta,
  };
}

function parseJsonPayload<T>(responseText: string) {
  const normalizedText = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(normalizedText) as T;
  } catch {
    const firstBrace = normalizedText.indexOf("{");
    const lastBrace = normalizedText.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(normalizedText.slice(firstBrace, lastBrace + 1)) as T;
    }

    throw new Error(
      `Gemini briefing failed: invalid JSON payload ${
        normalizedText.slice(0, 240)
      }`,
    );
  }
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
