import type { NormalizedRiskEvent } from "./event-types.ts";

const DEFAULT_TAVILY_ENDPOINT = "https://api.tavily.com/search";
const DEFAULT_MAX_RESULTS = 5;

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  published_date?: string;
};

type TavilySearchResponse = {
  query?: string;
  answer?: string;
  response_time?: number;
  request_id?: string;
  results?: TavilySearchResult[];
};

type WebEvidence = {
  title: string;
  url: string;
  source: string;
  snippet?: string;
  score?: number;
  publishedAt?: string;
};

type WebEnrichmentOptions = {
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  now?: () => string;
};

export async function enrichEventsWithWebSearch(
  events: NormalizedRiskEvent[],
  options: WebEnrichmentOptions = {},
): Promise<NormalizedRiskEvent[]> {
  const apiKey = options.apiKey ?? Deno.env.get("TAVILY_API_KEY");

  if (!apiKey) {
    return events.map((event) =>
      event.webEnrichmentStatus === "pending"
        ? {
          ...event,
          webEnrichmentStatus: "skipped_unconfigured",
          rawPayload: {
            ...event.rawPayload,
            webSearch: {
              provider: "tavily",
              status: "skipped_unconfigured",
            },
          },
        }
        : event
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? DEFAULT_TAVILY_ENDPOINT;
  const now = options.now ?? (() => new Date().toISOString());
  const enriched: NormalizedRiskEvent[] = [];

  for (const event of events) {
    if (event.webEnrichmentStatus !== "pending") {
      enriched.push(event);
      continue;
    }

    try {
      const query = buildSearchQuery(event);
      const response = await searchTavily(query, {
        apiKey,
        endpoint,
        fetchImpl,
      });
      const evidence = sanitizeEvidence(response.results);
      const corroboratingSources = getCorroboratingSources(
        evidence,
        event.source,
      );
      const sourceCount = Math.max(
        event.sourceCount,
        1 + corroboratingSources.length,
      );
      const note = buildWebEnrichmentNote(corroboratingSources);

      enriched.push({
        ...event,
        sourceCount,
        webEnriched: evidence.length > 0,
        webEnrichmentStatus: "completed",
        inferences: note
          ? mergeUniqueStrings(event.inferences, [note])
          : event.inferences,
        rawPayload: {
          ...event.rawPayload,
          webSearch: {
            provider: "tavily",
            status: "completed",
            query: response.query ?? query,
            answer: response.answer?.trim() || undefined,
            responseTime: response.response_time,
            requestId: response.request_id,
            corroboratingSourceCount: corroboratingSources.length,
            results: evidence,
            enrichedAt: now(),
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Unknown web enrichment error";

      enriched.push({
        ...event,
        webEnrichmentStatus: "failed",
        rawPayload: {
          ...event.rawPayload,
          webSearch: {
            provider: "tavily",
            status: "failed",
            error: message,
            failedAt: now(),
          },
        },
      });
    }
  }

  return enriched;
}

async function searchTavily(
  query: string,
  options: {
    apiKey: string;
    endpoint: string;
    fetchImpl: typeof fetch;
  },
) {
  const response = await options.fetchImpl(options.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      query,
      topic: "news",
      search_depth: "basic",
      time_range: "week",
      max_results: DEFAULT_MAX_RESULTS,
      include_answer: "basic",
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Tavily search failed: ${response.status} ${message}`);
  }

  return await response.json() as TavilySearchResponse;
}

function buildSearchQuery(event: NormalizedRiskEvent) {
  const title = event.title.trim();
  const region = event.regionName && event.regionName !== "Unknown region"
    ? event.regionName
    : undefined;
  const actors = event.actors.slice(0, 2).join(" ");

  return [`"${title}"`, region, actors].filter(Boolean).join(" ");
}

function sanitizeEvidence(results: TavilySearchResult[] | undefined) {
  if (!Array.isArray(results)) {
    return [];
  }

  const deduped = new Map<string, WebEvidence>();

  for (const result of results) {
    const url = typeof result?.url === "string" ? result.url.trim() : "";

    if (!url) {
      continue;
    }

    deduped.set(url, {
      title: typeof result?.title === "string"
        ? result.title.trim()
        : "Untitled source",
      url,
      source: extractSourceLabel(url),
      snippet: typeof result?.content === "string"
        ? result.content.trim() || undefined
        : undefined,
      score: typeof result?.score === "number" ? result.score : undefined,
      publishedAt: typeof result?.published_date === "string"
        ? result.published_date.trim() || undefined
        : undefined,
    });
  }

  return [...deduped.values()];
}

function extractSourceLabel(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const [root] = hostname.split(".");
    return root ? root.toUpperCase() : hostname;
  } catch {
    return "UNKNOWN";
  }
}

function getCorroboratingSources(
  evidence: WebEvidence[],
  primarySource: string,
) {
  const normalizedPrimarySource = normalizeSourceName(primarySource);
  const sources = new Set<string>();

  for (const item of evidence) {
    const normalizedSource = normalizeSourceName(item.source);

    if (!normalizedSource || normalizedSource === normalizedPrimarySource) {
      continue;
    }

    sources.add(item.source);
  }

  return [...sources];
}

function normalizeSourceName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildWebEnrichmentNote(corroboratingSources: string[]) {
  if (corroboratingSources.length === 0) {
    return "";
  }

  if (corroboratingSources.length === 1) {
    return `웹 보강: ${corroboratingSources[0]} 추가 출처를 조회했습니다.`;
  }

  return `웹 보강: ${corroboratingSources[0]}, ${
    corroboratingSources[1]
  } 등 ${corroboratingSources.length}개 추가 출처를 조회했습니다.`;
}

function mergeUniqueStrings(existing: string[], additions: string[]) {
  const merged = new Set(existing);

  additions.filter(Boolean).forEach((item) => merged.add(item));

  return [...merged];
}
