import type { NormalizedRiskEvent } from "../functions/_shared/event-types.ts";
import { enrichEventsWithWebSearch } from "../functions/_shared/web-enrichment.ts";

function assertEquals<T>(actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function createEvent(
  overrides: Partial<NormalizedRiskEvent> = {},
): NormalizedRiskEvent {
  return {
    title: "Missile alert raises tanker risk near Strait of Hormuz",
    source: "Reuters",
    sourceUrl: "https://www.reuters.com/world/middle-east/hormuz-alert",
    externalId: "hormuz-alert",
    summaryKo: "요약",
    summaryEn: "Summary",
    eventType: "missile",
    eventDirection: "escalation",
    riskLevel: "high",
    importanceScore: 8,
    confidenceScore: 0.78,
    verificationStatus: "pending",
    marketSentiment: "risk_off",
    timeHorizon: "days",
    conflictStatus: "active_conflict",
    storyKey: "missile_hormuz_iran",
    storySequence: 1,
    sourceCount: 1,
    countryCode: "IR",
    regionName: "Strait of Hormuz",
    latitude: 26.566,
    longitude: 56.249,
    occurredAt: "2026-04-08T08:00:00.000Z",
    actors: ["Iran"],
    targets: ["Tanker traffic"],
    affectedAssets: ["WTI"],
    macroChannels: ["oil"],
    facts: [{ claim: "Missile alert raised tanker risk", source: "Reuters" }],
    numericFacts: [],
    inferences: ["AI 해석: 유가 리스크 프리미엄이 확대될 수 있습니다."],
    contradictions: [],
    thesis: "호르무즈 해협 리스크는 원유와 안전자산에 직접 연결됩니다.",
    scenarioBase: "기본 시나리오",
    scenarioBull: "상방 시나리오",
    scenarioBear: "하방 시나리오",
    webEnriched: false,
    webEnrichmentStatus: "pending",
    impacts: [
      {
        assetCode: "WTI",
        assetName: "Oil",
        direction: "up",
        confidence: 0.82,
      },
    ],
    rawPayload: {
      aiClassification: {
        webSearchRecommended: true,
      },
    },
    ...overrides,
  };
}

Deno.test("enrichEventsWithWebSearch marks pending events completed and updates source count", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        query:
          '"Missile alert raises tanker risk near Strait of Hormuz" Strait of Hormuz Iran',
        answer: "Multiple outlets reported similar shipping risk concerns.",
        response_time: 1.24,
        results: [
          {
            title: "AP confirms shipping insurers react to Hormuz alert",
            url: "https://apnews.com/article/hormuz-alert",
            content:
              "AP reported that shipping insurers reviewed tanker routes.",
            score: 0.89,
          },
          {
            title: "BBC tracks Hormuz escalation",
            url: "https://www.bbc.com/news/articles/hormuz-escalation",
            content:
              "BBC said shipping and oil traders were monitoring the situation.",
            score: 0.83,
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  const [event] = await enrichEventsWithWebSearch([createEvent()], {
    apiKey: "tvly-test",
    fetchImpl,
    now: () => "2026-04-08T12:00:00.000Z",
  });

  assertEquals(event.webEnrichmentStatus, "completed");
  assertEquals(event.webEnriched, true);
  assertEquals(event.sourceCount, 3);
  assert(
    event.inferences.some((item) => item.includes("2개 추가 출처")),
    "expected investor-facing web enrichment note",
  );
  assertEquals(
    (event.rawPayload.webSearch as { provider?: string }).provider,
    "tavily",
  );
});

Deno.test("enrichEventsWithWebSearch marks pending events failed when provider errors", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("upstream failure", {
      status: 502,
      headers: { "content-type": "text/plain" },
    });

  const [event] = await enrichEventsWithWebSearch([createEvent()], {
    apiKey: "tvly-test",
    fetchImpl,
    now: () => "2026-04-08T12:00:00.000Z",
  });

  assertEquals(event.webEnrichmentStatus, "failed");
  assertEquals(event.webEnriched, false);
  assert(
    typeof (event.rawPayload.webSearch as { error?: string }).error ===
      "string",
    "expected raw payload to keep failure reason",
  );
});
