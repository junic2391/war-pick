import type {
  AiArticleClassification,
  ConflictStatus,
  EventDirection,
  MarketSentiment,
  NumericFact,
  RawArticle,
  RiskEventType,
  RiskLevel,
  SourceConflict,
  StoryFact,
  TimeHorizon,
  VerificationStatus,
} from './event-types.ts';
import { getSupportedRegionKeys } from './geo-regions.ts';

const DEFAULT_GOOGLE_GENAI_MODEL = 'gemini-2.5-flash-lite';
const MAX_BATCH_SIZE = 20;
const MAX_PROMPT_SUMMARY_LENGTH = 360;
const INPUT_COST_PER_MILLION = 0.1;
const OUTPUT_COST_PER_MILLION = 0.4;
const VALID_EVENT_TYPES = new Set<RiskEventType>([
  'missile',
  'drone',
  'bombing',
  'naval',
  'sanction',
  'diplomatic',
  'cyber',
  'nuclear',
  'energy',
  'political',
]);
const VALID_EVENT_DIRECTIONS = new Set<EventDirection>(['escalation', 'deescalation', 'resolution']);
const VALID_RISK_LEVELS = new Set<RiskLevel>(['low', 'medium', 'high', 'critical']);
const VALID_VERIFICATION_STATUSES = new Set<VerificationStatus>(['pending', 'verified', 'rejected']);
const VALID_MARKET_SENTIMENTS = new Set<MarketSentiment>(['risk_on', 'risk_off', 'mixed', 'neutral']);
const VALID_TIME_HORIZONS = new Set<TimeHorizon>(['intraday', 'days', 'weeks', 'months']);
const VALID_CONFLICT_STATUSES = new Set<ConflictStatus>([
  'active_conflict',
  'ceasefire',
  'negotiation',
  'sanctions_cycle',
  'resolved',
]);
const VALID_MACRO_CHANNELS = new Set([
  'oil',
  'gas',
  'shipping',
  'inflation',
  'rates',
  'fx',
  'supply_chain',
  'defense',
]);

type BatchArticle = {
  index: number;
  article: RawArticle;
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

type GeminiTriageItem = {
  index: number;
  relevant: boolean;
  reason?: string;
  eventType?: string;
  importanceScore?: number;
  regionKey?: string;
  requiresVerification?: boolean;
  storyKeyHint?: string;
};

type GeminiEnrichmentItem = {
  index: number;
  relevant: boolean;
  reason?: string;
  sourceLanguage?: string;
  titleKo?: string;
  titleEn?: string;
  summaryKo?: string;
  summaryEn?: string;
  eventType?: string;
  eventSubType?: string;
  eventDirection?: string;
  riskLevel?: string;
  importanceScore?: number;
  confidenceScore?: number;
  regionKey?: string;
  verificationStatus?: string;
  marketSentiment?: string;
  timeHorizon?: string;
  conflictStatus?: string;
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
  requiresVerification?: boolean;
  storyKeyHint?: string;
  webSearchRecommended?: boolean;
};

type GeminiBatchPayload<T> = {
  items?: T[];
};

type StagePromptResult<T> = {
  payload: GeminiBatchPayload<T>;
  promptText: string;
  responseText: string;
};

type ArticleTriage = {
  index: number;
  relevant: boolean;
  reason: string;
  eventType?: RiskEventType;
  importanceScore: number;
  regionKey: string;
  requiresVerification: boolean;
  storyKeyHint?: string;
};

export type AiClassificationMetrics = {
  stage1ArticleCount: number;
  stage2ArticleCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
};

export type AiClassificationBatchResult = {
  mode: 'ai';
  classifications: Array<{
    index: number;
    classification: AiArticleClassification;
  }>;
  metrics: AiClassificationMetrics;
};

type ClassifierOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  publishMinImportance?: number;
};

export function isAiClassifierConfigured(options: Pick<ClassifierOptions, 'apiKey'> = {}) {
  return Boolean(options.apiKey ?? Deno.env.get('GOOGLE_GENAI_API_KEY'));
}

export async function classifyArticlesWithAi(
  articles: BatchArticle[],
  options: ClassifierOptions = {},
): Promise<AiClassificationBatchResult> {
  const apiKey = options.apiKey ?? Deno.env.get('GOOGLE_GENAI_API_KEY');

  if (!apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY가 없어 AI 분류를 실행할 수 없습니다.');
  }

  const model = options.model ?? (Deno.env.get('GOOGLE_GENAI_MODEL') || DEFAULT_GOOGLE_GENAI_MODEL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const publishMinImportance = sanitizeImportanceScore(options.publishMinImportance) ?? 4;
  const supportedRegionKeys = [...getSupportedRegionKeys(), 'unknown'];
  const triaged: ArticleTriage[] = [];
  const classifications: Array<{ index: number; classification: AiArticleClassification }> = [];
  let estimatedInputTokens = 0;
  let estimatedOutputTokens = 0;

  for (const batch of chunkArticles(articles, MAX_BATCH_SIZE)) {
    const triageResult = await classifyBatchWithGemini<GeminiTriageItem>(
      buildTriagePrompt(batch, supportedRegionKeys),
      apiKey,
      model,
      fetchImpl,
    );
    estimatedInputTokens += estimateTokens(triageResult.promptText);
    estimatedOutputTokens += estimateTokens(triageResult.responseText);

    const items = Array.isArray(triageResult.payload.items) ? triageResult.payload.items : [];

    for (const item of items) {
      if (typeof item?.index !== 'number') {
        continue;
      }

      triaged.push(sanitizeTriage(item, supportedRegionKeys));
    }
  }

  const triageByIndex = new Map(triaged.map((item) => [item.index, item]));
  const stage2Candidates = articles.filter(({ index }) => {
    const triage = triageByIndex.get(index);
    return Boolean(
      triage &&
        triage.relevant &&
        (triage.importanceScore >= publishMinImportance || triage.requiresVerification),
    );
  });
  const enrichedByIndex = new Map<number, AiArticleClassification>();

  for (const batch of chunkArticles(stage2Candidates, MAX_BATCH_SIZE)) {
    const triageHints = batch.map(({ index }) => triageByIndex.get(index)).filter(Boolean) as ArticleTriage[];
    const enrichmentResult = await classifyBatchWithGemini<GeminiEnrichmentItem>(
      buildEnrichmentPrompt(batch, triageHints, supportedRegionKeys),
      apiKey,
      model,
      fetchImpl,
    );
    estimatedInputTokens += estimateTokens(enrichmentResult.promptText);
    estimatedOutputTokens += estimateTokens(enrichmentResult.responseText);

    const items = Array.isArray(enrichmentResult.payload.items) ? enrichmentResult.payload.items : [];

    for (const item of items) {
      if (typeof item?.index !== 'number') {
        continue;
      }

      enrichedByIndex.set(
        item.index,
        sanitizeEnrichment(item, triageByIndex.get(item.index), supportedRegionKeys),
      );
    }
  }

  for (const { index } of articles) {
    const triage = triageByIndex.get(index);

    if (!triage) {
      classifications.push({
        index,
        classification: {
          relevant: false,
          reason: 'ai_unclassified',
        },
      });
      continue;
    }

    classifications.push({
      index,
      classification: enrichedByIndex.get(index) ?? buildClassificationFromTriage(triage),
    });
  }

  return {
    mode: 'ai',
    classifications,
    metrics: {
      stage1ArticleCount: articles.length,
      stage2ArticleCount: stage2Candidates.length,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUsd: estimateCostUsd(estimatedInputTokens, estimatedOutputTokens),
    },
  };
}

async function classifyBatchWithGemini<T>(
  promptText: string,
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch,
): Promise<StagePromptResult<T>> {
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini classify failed: ${response.status} ${message}`);
  }

  const data = await response.json() as GeminiResponse;
  const responseText = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();

  if (!responseText) {
    throw new Error('Gemini classify failed: empty response');
  }

  return {
    payload: parseJsonPayload<T>(responseText),
    promptText,
    responseText,
  };
}

function buildTriagePrompt(articles: BatchArticle[], supportedRegionKeys: string[]) {
  return [
    'Triage geopolitical RSS articles for an investor-facing risk feed.',
    'Return JSON only with shape: {"items":[...]}',
    'Each item must include: index, relevant, reason, importanceScore, regionKey, requiresVerification.',
    'Optional when relevant=true: eventType, storyKeyHint.',
    `Allowed eventType: ${[...VALID_EVENT_TYPES].join(', ')}`,
    `Allowed regionKey: ${supportedRegionKeys.join(', ')}`,
    'importanceScore must be an integer from 0 to 10.',
    'Use relevant=true only when there is a concrete geopolitical state change or a high-salience strategic development.',
    'requiresVerification should be true when facts appear incomplete, the headline is unusually market moving, or multiple-source confirmation would materially improve trust.',
    'storyKeyHint should be a short lowercase underscore slug that can group continuing updates about the same incident.',
    'Articles:',
    JSON.stringify(
      articles.map(({ index, article }) => ({
        index,
        title: article.title,
        summary: truncateText(article.summary ?? '', MAX_PROMPT_SUMMARY_LENGTH),
        source: article.source,
        publishedAt: article.publishedAt,
      })),
    ),
  ].join('\n');
}

function buildEnrichmentPrompt(
  articles: BatchArticle[],
  triageHints: ArticleTriage[],
  supportedRegionKeys: string[],
) {
  return [
    'Enrich previously triaged geopolitical RSS articles for an investor-facing risk feed.',
    'Return JSON only with shape: {"items":[...]}',
    'Each item must include: index, relevant, reason, sourceLanguage, titleKo, titleEn, summaryKo, summaryEn, eventType, eventDirection, riskLevel, importanceScore, confidenceScore, regionKey, marketSentiment, timeHorizon, conflictStatus, actors, targets, affectedAssets, macroChannels, facts, numericFacts, inferences, contradictions, thesis, scenarioBase, scenarioBull, scenarioBear, requiresVerification, webSearchRecommended.',
    'Optional: eventSubType, verificationStatus, storyKeyHint.',
    'Allowed sourceLanguage: ko, en, other.',
    'titleKo/titleEn and summaryKo/summaryEn should be concise investor-facing translations. If the source article is already in one target language, keep that target close to the original wording.',
    `Allowed eventType: ${[...VALID_EVENT_TYPES].join(', ')}`,
    `Allowed eventDirection: ${[...VALID_EVENT_DIRECTIONS].join(', ')}`,
    `Allowed riskLevel: ${[...VALID_RISK_LEVELS].join(', ')}`,
    `Allowed verificationStatus: ${[...VALID_VERIFICATION_STATUSES].join(', ')}`,
    `Allowed marketSentiment: ${[...VALID_MARKET_SENTIMENTS].join(', ')}`,
    `Allowed timeHorizon: ${[...VALID_TIME_HORIZONS].join(', ')}`,
    `Allowed conflictStatus: ${[...VALID_CONFLICT_STATUSES].join(', ')}`,
    `Allowed regionKey: ${supportedRegionKeys.join(', ')}`,
    `Allowed macroChannels: ${[...VALID_MACRO_CHANNELS].join(', ')}`,
    'facts must be an array of objects: {claim, value?, asOfDate?, source?}.',
    'numericFacts must be an array of objects: {label, value, unit?, asOfDate?, source?}. Use exact numbers only when supported by the article or clearly state none.',
    'contradictions must be an array of objects: {topic, description, sourceA?, sourceB?, status}. Use status unresolved unless clearly reconciled.',
    'inferences must contain only AI interpretations, not raw facts.',
    'thesis should explain why the event matters for markets in 1-2 sentences.',
    'scenarioBase/Bull/Bear should describe plausible forward scenarios, clearly marked as scenario thinking.',
    'webSearchRecommended should be true only if high-impact details remain unresolved or conflicting.',
    'Triage hints:',
    JSON.stringify(triageHints),
    'Articles:',
    JSON.stringify(
      articles.map(({ index, article }) => ({
        index,
        title: article.title,
        summary: truncateText(article.summary ?? '', MAX_PROMPT_SUMMARY_LENGTH),
        source: article.source,
        publishedAt: article.publishedAt,
      })),
    ),
  ].join('\n');
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function sanitizeTriage(item: GeminiTriageItem, supportedRegionKeys: string[]): ArticleTriage {
  const importanceScore = sanitizeImportanceScore(item.importanceScore) ?? 3;
  return {
    index: item.index,
    relevant: item.relevant === true,
    reason: typeof item.reason === 'string' ? item.reason.trim() : 'ai_irrelevant',
    eventType: VALID_EVENT_TYPES.has(item.eventType as RiskEventType)
      ? item.eventType as RiskEventType
      : undefined,
    importanceScore,
    regionKey: supportedRegionKeys.includes(item.regionKey ?? '') ? item.regionKey ?? 'unknown' : 'unknown',
    requiresVerification: item.requiresVerification === true || importanceScore >= 8,
    storyKeyHint: sanitizeStoryKey(item.storyKeyHint),
  };
}

function buildClassificationFromTriage(triage: ArticleTriage): AiArticleClassification {
  if (!triage.relevant) {
    return {
      relevant: false,
      reason: triage.reason,
    };
  }

  return {
    relevant: true,
    reason: triage.reason,
    eventType: triage.eventType ?? 'bombing',
    importanceScore: triage.importanceScore,
    regionKey: triage.regionKey,
    requiresVerification: triage.requiresVerification,
    storyKeyHint: triage.storyKeyHint,
  };
}

function sanitizeEnrichment(
  item: GeminiEnrichmentItem,
  triage: ArticleTriage | undefined,
  supportedRegionKeys: string[],
): AiArticleClassification {
  if (item.relevant !== true) {
    return {
      relevant: false,
      reason: typeof item.reason === 'string' ? item.reason.trim() : triage?.reason ?? 'ai_irrelevant',
    };
  }

  const riskLevel = VALID_RISK_LEVELS.has(item.riskLevel as RiskLevel)
    ? item.riskLevel as RiskLevel
    : 'medium';
  const importanceScore = sanitizeImportanceScore(item.importanceScore) ??
    triage?.importanceScore ??
    deriveImportanceScoreFromRiskLevel(riskLevel);

  return {
    relevant: true,
    reason: typeof item.reason === 'string' ? item.reason.trim() : triage?.reason,
    sourceLanguage: sanitizeSourceLanguage(item.sourceLanguage),
    titleKo: sanitizeLocalizedText(item.titleKo),
    titleEn: sanitizeLocalizedText(item.titleEn),
    summaryKo: sanitizeLocalizedText(item.summaryKo),
    summaryEn: sanitizeLocalizedText(item.summaryEn),
    eventType: VALID_EVENT_TYPES.has(item.eventType as RiskEventType)
      ? item.eventType as RiskEventType
      : triage?.eventType ?? 'bombing',
    eventSubType: typeof item.eventSubType === 'string' ? item.eventSubType.trim() : undefined,
    eventDirection: VALID_EVENT_DIRECTIONS.has(item.eventDirection as EventDirection)
      ? item.eventDirection as EventDirection
      : 'escalation',
    riskLevel,
    importanceScore,
    confidenceScore: sanitizeProbability(item.confidenceScore) ?? deriveConfidenceScore(importanceScore),
    regionKey: supportedRegionKeys.includes(item.regionKey ?? '') ? item.regionKey ?? 'unknown' : triage?.regionKey ?? 'unknown',
    verificationStatus: VALID_VERIFICATION_STATUSES.has(item.verificationStatus as VerificationStatus)
      ? item.verificationStatus as VerificationStatus
      : undefined,
    marketSentiment: VALID_MARKET_SENTIMENTS.has(item.marketSentiment as MarketSentiment)
      ? item.marketSentiment as MarketSentiment
      : deriveMarketSentiment(item.eventDirection as EventDirection | undefined),
    timeHorizon: VALID_TIME_HORIZONS.has(item.timeHorizon as TimeHorizon)
      ? item.timeHorizon as TimeHorizon
      : deriveTimeHorizon(importanceScore),
    conflictStatus: VALID_CONFLICT_STATUSES.has(item.conflictStatus as ConflictStatus)
      ? item.conflictStatus as ConflictStatus
      : deriveConflictStatus(item.eventDirection as EventDirection | undefined, item.eventType as RiskEventType | undefined),
    actors: sanitizeStringArray(item.actors),
    targets: sanitizeStringArray(item.targets),
    affectedAssets: sanitizeStringArray(item.affectedAssets),
    macroChannels: sanitizeMacroChannels(item.macroChannels),
    facts: sanitizeFacts(item.facts),
    numericFacts: sanitizeNumericFacts(item.numericFacts),
    inferences: sanitizeStringArray(item.inferences),
    contradictions: sanitizeContradictions(item.contradictions),
    thesis: sanitizeNarrative(item.thesis),
    scenarioBase: sanitizeNarrative(item.scenarioBase),
    scenarioBull: sanitizeNarrative(item.scenarioBull),
    scenarioBear: sanitizeNarrative(item.scenarioBear),
    requiresVerification: item.requiresVerification === true || triage?.requiresVerification === true,
    storyKeyHint: sanitizeStoryKey(item.storyKeyHint ?? triage?.storyKeyHint),
    webSearchRecommended: item.webSearchRecommended === true,
  };
}

function sanitizeStringArray(values: string[] | undefined) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean))].slice(0, 8);
}

function sanitizeMacroChannels(values: string[] | undefined) {
  return sanitizeStringArray(values).filter((value) => VALID_MACRO_CHANNELS.has(value));
}

function sanitizeFacts(facts: StoryFact[] | undefined) {
  if (!Array.isArray(facts)) {
    return [];
  }

  return facts
    .map((fact) => ({
      claim: typeof fact?.claim === 'string' ? fact.claim.trim() : '',
      value: typeof fact?.value === 'string' ? fact.value.trim() : undefined,
      asOfDate: typeof fact?.asOfDate === 'string' ? fact.asOfDate.trim() : undefined,
      source: typeof fact?.source === 'string' ? fact.source.trim() : undefined,
    }))
    .filter((fact) => fact.claim)
    .slice(0, 8);
}

function sanitizeNumericFacts(facts: NumericFact[] | undefined) {
  if (!Array.isArray(facts)) {
    return [];
  }

  return facts
    .map((fact) => ({
      label: typeof fact?.label === 'string' ? fact.label.trim() : '',
      value: typeof fact?.value === 'number' && Number.isFinite(fact.value) ? fact.value : NaN,
      unit: typeof fact?.unit === 'string' ? fact.unit.trim() : undefined,
      asOfDate: typeof fact?.asOfDate === 'string' ? fact.asOfDate.trim() : undefined,
      source: typeof fact?.source === 'string' ? fact.source.trim() : undefined,
    }))
    .filter((fact) => fact.label && Number.isFinite(fact.value))
    .slice(0, 8);
}

function sanitizeContradictions(contradictions: SourceConflict[] | undefined) {
  if (!Array.isArray(contradictions)) {
    return [];
  }

  return contradictions
    .map((conflict): SourceConflict => ({
      topic: typeof conflict?.topic === 'string' ? conflict.topic.trim() : '',
      description: typeof conflict?.description === 'string' ? conflict.description.trim() : '',
      sourceA: typeof conflict?.sourceA === 'string' ? conflict.sourceA.trim() : undefined,
      sourceB: typeof conflict?.sourceB === 'string' ? conflict.sourceB.trim() : undefined,
      status: conflict?.status === 'resolved' ? 'resolved' : 'unresolved',
    }))
    .filter((conflict) => conflict.topic && conflict.description)
    .slice(0, 6);
}

function sanitizeNarrative(value: string | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function sanitizeLocalizedText(value: string | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sanitizeSourceLanguage(value: string | undefined) {
  switch (value) {
    case 'ko':
    case 'en':
    case 'other':
      return value;
    default:
      return undefined;
  }
}

function sanitizeStoryKey(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || undefined;
}

function sanitizeImportanceScore(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(10, Math.round(value)));
}

function sanitizeProbability(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
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

function deriveConfidenceScore(importanceScore: number) {
  if (importanceScore >= 9) {
    return 0.82;
  }

  if (importanceScore >= 7) {
    return 0.74;
  }

  if (importanceScore >= 4) {
    return 0.66;
  }

  return 0.58;
}

function deriveMarketSentiment(eventDirection: EventDirection | undefined): MarketSentiment {
  switch (eventDirection) {
    case 'resolution':
      return 'risk_on';
    case 'deescalation':
      return 'neutral';
    case 'escalation':
    default:
      return 'risk_off';
  }
}

function deriveTimeHorizon(importanceScore: number): TimeHorizon {
  if (importanceScore >= 9) {
    return 'weeks';
  }

  if (importanceScore >= 7) {
    return 'days';
  }

  return 'intraday';
}

function deriveConflictStatus(
  eventDirection: EventDirection | undefined,
  eventType: RiskEventType | undefined,
): ConflictStatus {
  if (eventType === 'sanction') {
    return 'sanctions_cycle';
  }

  if (eventDirection === 'resolution') {
    return 'resolved';
  }

  if (eventDirection === 'deescalation') {
    return 'negotiation';
  }

  return 'active_conflict';
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateCostUsd(inputTokens: number, outputTokens: number) {
  return Number(
    (
      (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION +
      (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION
    ).toFixed(6),
  );
}

function parseJsonPayload<T>(responseText: string) {
  const normalizedText = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(normalizedText) as GeminiBatchPayload<T>;
  } catch {
    const firstBrace = normalizedText.indexOf('{');
    const lastBrace = normalizedText.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(normalizedText.slice(firstBrace, lastBrace + 1)) as GeminiBatchPayload<T>;
    }

    throw new Error(`Gemini classify failed: invalid JSON payload ${normalizedText.slice(0, 240)}`);
  }
}

function chunkArticles(items: BatchArticle[], size: number) {
  const chunks: BatchArticle[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
