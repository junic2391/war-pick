import type { RawArticle } from '../functions/_shared/event-types.ts';
import { classifyArticlesWithAi } from '../functions/_shared/ai-classifier.ts';
import {
  buildNormalizedEventFromAiClassification,
  deriveWebEnrichmentDecision,
  getInvalidArticleReason,
} from '../functions/_shared/ai-normalization.ts';

function assertEquals<T>(actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function createArticle(overrides: Partial<RawArticle> = {}): RawArticle {
  return {
    title: 'US lifts sanctions and grants waivers on Iranian petrochemical exports',
    summary: 'Officials said sanctions relief would take effect immediately as part of the new agreement.',
    source: 'BBC News',
    url: 'https://example.com/iran-sanctions-relief',
    publishedAt: '2026-04-07T10:00:00.000Z',
    ...overrides,
  };
}

Deno.test('getInvalidArticleReason rejects malformed article payloads', () => {
  const reason = getInvalidArticleReason(createArticle({
    title: '   ',
  }));

  assertEquals(reason, 'title missing');
});

Deno.test('buildNormalizedEventFromAiClassification applies resolution direction to impacts', () => {
  const event = buildNormalizedEventFromAiClassification(createArticle(), {
    relevant: true,
    sourceLanguage: 'en',
    titleKo: '미국이 이란 석유화학 수출 제재를 해제',
    titleEn: 'US lifts sanctions and grants waivers on Iranian petrochemical exports',
    summaryKo: '새 합의에 따라 제재 완화가 즉시 발효된다고 당국이 밝혔습니다.',
    summaryEn: 'Officials said sanctions relief would take effect immediately as part of the new agreement.',
    eventType: 'sanction',
    eventSubType: 'sanctions_relief',
    eventDirection: 'resolution',
    riskLevel: 'medium',
    importanceScore: 6,
    regionKey: 'iran',
  });

  assert(event !== null, 'expected AI classification to build an event');
  if (event === null) {
    throw new Error('expected event');
  }

  assertEquals(event.eventDirection, 'resolution');
  assertEquals(event.eventType, 'sanction');
  assertEquals(event.importanceScore, 6);
  assertEquals(event.impacts[0]?.direction, 'down');
  assertEquals(event.regionName, 'Iran');
  assertEquals(event.sourceLanguage, 'en');
  assertEquals(event.titleKo, '미국이 이란 석유화학 수출 제재를 해제');
  assertEquals(event.summaryEn, 'Officials said sanctions relief would take effect immediately as part of the new agreement.');
});

Deno.test('buildNormalizedEventFromAiClassification supports diplomatic resolution events', () => {
  const event = buildNormalizedEventFromAiClassification(createArticle({
    title: 'Saudi Arabia and Iran restore ties as mediation deal takes effect',
    summary:
      'Officials said the normalization agreement would reopen diplomatic channels after years of regional tension.',
  }), {
    relevant: true,
    eventType: 'diplomatic',
    eventSubType: 'ties_restored',
    eventDirection: 'resolution',
    riskLevel: 'medium',
    importanceScore: 5,
    regionKey: 'iran',
  });

  assert(event !== null, 'expected AI diplomatic classification to build an event');
  if (event === null) {
    throw new Error('expected event');
  }

  assertEquals(event.eventType, 'diplomatic');
  assertEquals(event.eventDirection, 'resolution');
  assertEquals(event.impacts[0]?.direction, 'down');
});

Deno.test('deriveWebEnrichmentDecision marks high-importance events as pending even without AI recommendation', () => {
  const decision = deriveWebEnrichmentDecision({
    relevant: true,
    eventType: 'missile',
    eventDirection: 'escalation',
    riskLevel: 'high',
    importanceScore: 8,
    webSearchRecommended: false,
  }, {
    providerConfigured: true,
  });

  assertEquals(decision.status, 'pending');
  assertEquals(decision.signals.highImportance, true);
  assertEquals(decision.signals.aiRecommended, false);
  assertEquals(decision.signals.shouldEnrich, true);
});

Deno.test('deriveWebEnrichmentDecision marks verification and contradictions cases as pending', () => {
  const decision = deriveWebEnrichmentDecision({
    relevant: true,
    eventType: 'missile',
    eventDirection: 'escalation',
    riskLevel: 'medium',
    importanceScore: 5,
    requiresVerification: true,
    contradictions: [
      {
        topic: 'casualties',
        description: '초기 casualty 집계가 언론별로 다릅니다.',
        sourceA: 'Reuters',
        sourceB: 'AP',
        status: 'unresolved',
      },
    ],
  }, {
    providerConfigured: true,
  });

  assertEquals(decision.status, 'pending');
  assertEquals(decision.signals.requiresVerification, true);
  assertEquals(decision.signals.hasContradictions, true);
});

Deno.test('buildNormalizedEventFromAiClassification stores web search signals in raw payload', () => {
  const event = buildNormalizedEventFromAiClassification(createArticle({
    title: 'Officials dispute casualty counts after blast near key shipping lane',
  }), {
    relevant: true,
    eventType: 'bombing',
    eventDirection: 'escalation',
    riskLevel: 'medium',
    importanceScore: 5,
    regionKey: 'strait_of_hormuz',
    requiresVerification: true,
    contradictions: [
      {
        topic: 'casualties',
        description: 'Officials and local media gave conflicting casualty counts.',
        sourceA: 'Reuters',
        sourceB: 'Local media',
        status: 'unresolved',
      },
    ],
  });

  assert(event !== null, 'expected classification to build an event');
  if (event === null) {
    throw new Error('expected event');
  }

  assertEquals(event.webEnrichmentStatus, 'skipped_unconfigured');
  assertEquals(
    event.rawPayload.webSearchSignals,
    {
      aiRecommended: false,
      highImportance: false,
      requiresVerification: true,
      hasContradictions: true,
      shouldEnrich: true,
    },
  );
});

Deno.test('classifyArticlesWithAi throws when API key is missing', async () => {
  let error: unknown = null;

  try {
    await classifyArticlesWithAi([{ index: 0, article: createArticle() }], {
      apiKey: '',
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof Error, 'expected missing API key to throw');
  assertEquals((error as Error).message, 'GOOGLE_GENAI_API_KEY가 없어 AI 분류를 실행할 수 없습니다.');
});

Deno.test('classifyArticlesWithAi parses Gemini JSON payload', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    items: [
                      {
                        index: 0,
                        relevant: true,
                        reason: 'sanctions_relief',
                        eventType: 'sanction',
                        eventSubType: 'sanctions_relief',
                        eventDirection: 'resolution',
                        riskLevel: 'medium',
                        importanceScore: 6,
                        regionKey: 'iran',
                        verificationStatus: 'verified',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );

  const result = await classifyArticlesWithAi([{ index: 0, article: createArticle() }], {
    apiKey: 'test-key',
    model: 'gemini-test',
    fetchImpl,
  });

  assertEquals(result.mode, 'ai');
  assertEquals(result.classifications.length, 1);
  assertEquals(result.classifications[0]?.classification.eventDirection, 'resolution');
  assertEquals(result.classifications[0]?.classification.importanceScore, 6);
  assertEquals(result.classifications[0]?.classification.regionKey, 'iran');
  assert(result.metrics.stage1ArticleCount >= 1, 'expected stage 1 metric');
});

Deno.test('classifyArticlesWithAi accepts expanded geopolitical event types', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    items: [
                      {
                        index: 0,
                        relevant: true,
                        reason: 'normalization_deal',
                        eventType: 'diplomatic',
                        eventSubType: 'ties_restored',
                        eventDirection: 'resolution',
                        riskLevel: 'medium',
                        importanceScore: 5,
                        regionKey: 'iran',
                        verificationStatus: 'verified',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );

  const result = await classifyArticlesWithAi([{ index: 0, article: createArticle() }], {
    apiKey: 'test-key',
    model: 'gemini-test',
    fetchImpl,
  });

  assertEquals(result.mode, 'ai');
  assertEquals(result.classifications[0]?.classification.eventType, 'diplomatic');
  assertEquals(result.classifications[0]?.classification.eventSubType, 'ties_restored');
});

Deno.test('classifyArticlesWithAi keeps localized title and summary fields from Gemini payload', async () => {
  let callCount = 0;
  const fetchImpl: typeof fetch = async () => {
    callCount += 1;

    if (callCount === 1) {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      items: [
                        {
                          index: 0,
                          relevant: true,
                          reason: 'shipping_alert',
                          importanceScore: 8,
                          regionKey: 'strait_of_hormuz',
                          requiresVerification: true,
                          eventType: 'missile',
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    items: [
                      {
                        index: 0,
                        relevant: true,
                        reason: 'shipping_alert',
                        sourceLanguage: 'en',
                        titleKo: '호르무즈 인근 유조선 리스크 경보',
                        titleEn: 'Tanker risk alert rises near Hormuz',
                        summaryKo: '해운 보험사들이 호르무즈 인근 긴장 고조를 주시하고 있습니다.',
                        summaryEn: 'Shipping insurers are monitoring rising tension near Hormuz.',
                        eventType: 'missile',
                        eventDirection: 'escalation',
                        riskLevel: 'high',
                        importanceScore: 8,
                        confidenceScore: 0.77,
                        regionKey: 'strait_of_hormuz',
                        marketSentiment: 'risk_off',
                        timeHorizon: 'days',
                        conflictStatus: 'active_conflict',
                        actors: ['Iran'],
                        targets: ['Tanker traffic'],
                        affectedAssets: ['WTI'],
                        macroChannels: ['oil'],
                        facts: [{ claim: 'Missile alert near tanker route' }],
                        numericFacts: [],
                        inferences: ['AI interpretation'],
                        contradictions: [],
                        thesis: 'Hormuz risk matters for oil markets.',
                        scenarioBase: 'Base case',
                        scenarioBull: 'Bull case',
                        scenarioBear: 'Bear case',
                        requiresVerification: true,
                        webSearchRecommended: true,
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  };

  const result = await classifyArticlesWithAi([{ index: 0, article: createArticle() }], {
    apiKey: 'test-key',
    model: 'gemini-test',
    fetchImpl,
  });

  assertEquals(result.classifications[0]?.classification.sourceLanguage, 'en');
  assertEquals(result.classifications[0]?.classification.titleKo, '호르무즈 인근 유조선 리스크 경보');
  assertEquals(result.classifications[0]?.classification.summaryEn, 'Shipping insurers are monitoring rising tension near Hormuz.');
});
