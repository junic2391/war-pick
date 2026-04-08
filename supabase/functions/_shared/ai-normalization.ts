import type {
  AiArticleClassification,
  EventDirection,
  MarketSentiment,
  NormalizedRiskEvent,
  RawArticle,
  RiskEventType,
  SourceConflict,
  StoryFact,
  VerificationStatus,
  WebEnrichmentStatus,
} from './event-types.ts';
import { findRegionProfile, getRegionProfileByKey } from './geo-regions.ts';

type WebEnrichmentDecision = {
  status: WebEnrichmentStatus;
  signals: {
    aiRecommended: boolean;
    highImportance: boolean;
    requiresVerification: boolean;
    hasContradictions: boolean;
    shouldEnrich: boolean;
  };
};

const trustedSourceTokens = [
  'reuters',
  'associated press',
  'ap',
  'bbc',
  'bloomberg',
  'financial times',
  'wsj',
  'wall street journal',
  'al jazeera',
  'nikkei',
  'yonhap',
];

const defaultImpacts: Record<RiskEventType, NormalizedRiskEvent['impacts']> = {
  missile: [
    {
      assetCode: 'XAU',
      assetName: 'Gold',
      direction: 'up',
      confidence: 0.65,
      moveHint: '+0.7%',
      rationale: '직접적인 군사 충돌 신호는 안전자산 선호를 자극할 수 있습니다.',
    },
  ],
  drone: [
    {
      assetCode: 'DEFENSE',
      assetName: 'Defense',
      direction: 'up',
      confidence: 0.61,
      moveHint: '+0.9%',
      rationale: '드론 위협 확대는 방산 관련 기대를 키울 수 있습니다.',
    },
  ],
  bombing: [
    {
      assetCode: 'XAU',
      assetName: 'Gold',
      direction: 'up',
      confidence: 0.63,
      moveHint: '+0.8%',
      rationale: '폭발 및 타격 뉴스는 리스크 오프 심리를 자극할 수 있습니다.',
    },
  ],
  naval: [
    {
      assetCode: 'BDI',
      assetName: 'Freight',
      direction: 'up',
      confidence: 0.66,
      moveHint: '+1.1%',
      rationale: '해상 운송 리스크는 운임과 물류 불확실성을 끌어올릴 수 있습니다.',
    },
  ],
  sanction: [
    {
      assetCode: 'DXY',
      assetName: 'Dollar',
      direction: 'up',
      confidence: 0.58,
      moveHint: '+0.4%',
      rationale: '제재 확대는 글로벌 리스크 회피 심리를 자극할 수 있습니다.',
    },
  ],
  diplomatic: [
    {
      assetCode: 'XAU',
      assetName: 'Gold',
      direction: 'up',
      confidence: 0.55,
      moveHint: '+0.3%',
      rationale: '외교 단절과 협상 결렬은 안전자산 선호를 높일 수 있습니다.',
    },
  ],
  cyber: [
    {
      assetCode: 'SOX',
      assetName: 'Semis',
      direction: 'down',
      confidence: 0.57,
      moveHint: '-0.7%',
      rationale: '국가 배후 사이버 공격은 기술 인프라와 공급망 심리를 훼손할 수 있습니다.',
    },
  ],
  nuclear: [
    {
      assetCode: 'XAU',
      assetName: 'Gold',
      direction: 'up',
      confidence: 0.7,
      moveHint: '+1.0%',
      rationale: '핵 리스크 고조는 전형적인 글로벌 리스크 오프 자극 요인입니다.',
    },
  ],
  energy: [
    {
      assetCode: 'WTI',
      assetName: 'Oil',
      direction: 'up',
      confidence: 0.68,
      moveHint: '+1.4%',
      rationale: '국가간 에너지 공급 차질은 원유와 가스 가격의 상방 압력을 키울 수 있습니다.',
    },
  ],
  political: [
    {
      assetCode: 'DXY',
      assetName: 'Dollar',
      direction: 'up',
      confidence: 0.54,
      moveHint: '+0.2%',
      rationale: '정권 불안과 비상통치 이슈는 위험자산 선호를 약화시킬 수 있습니다.',
    },
  ],
};

export function buildNormalizedEventFromAiClassification(
  article: RawArticle,
  classification: AiArticleClassification,
): NormalizedRiskEvent | null {
  if (
    !classification.relevant ||
    !classification.eventType ||
    !classification.eventDirection ||
    !classification.riskLevel ||
    typeof classification.importanceScore !== 'number'
  ) {
    return null;
  }

  const canonicalTitle = article.title.trim();
  const summary = article.summary?.trim();
  const trustedSource = isTrustedSource(article.source);
  const searchText = [canonicalTitle, summary, article.source].filter(Boolean).join(' ').toLowerCase();
  const sourceLanguage = classification.sourceLanguage ?? inferSourceLanguage(canonicalTitle, summary);
  const titleKo = resolveLocalizedValue(
    classification.titleKo,
    sourceLanguage === 'ko' ? canonicalTitle : undefined,
    canonicalTitle,
  );
  const titleEn = resolveLocalizedValue(
    classification.titleEn,
    sourceLanguage === 'en' ? canonicalTitle : undefined,
    canonicalTitle,
  );
  const summaryKo = resolveLocalizedValue(
    classification.summaryKo,
    sourceLanguage === 'ko' ? summary : undefined,
    summary,
  );
  const summaryEn = resolveLocalizedValue(
    classification.summaryEn,
    sourceLanguage === 'en' ? summary : undefined,
    summary,
  );
  const region = getRegionProfileByKey(classification.regionKey) ??
    findRegionProfile(searchText) ?? {
      countryCode: undefined,
      regionName: 'Unknown region',
      latitude: 0,
      longitude: 0,
      impacts: undefined,
    };
  const impacts = applyEventDirectionToImpacts(
    cloneImpacts(region.impacts ?? defaultImpacts[classification.eventType]),
    classification.eventDirection,
  );
  const affectedAssets = classification.affectedAssets?.length
    ? classification.affectedAssets
    : impacts.map((impact) => impact.assetCode);
  const facts = classification.facts?.length
    ? classification.facts
    : buildDefaultFacts(article);
  const inferences = classification.inferences?.length
    ? classification.inferences
    : buildDefaultInferences(classification.marketSentiment ?? 'neutral', impacts);
  const thesis = classification.thesis?.trim() ||
    buildDefaultThesis(classification.marketSentiment ?? 'neutral', impacts, region.regionName);
  const webEnrichmentDecision = deriveWebEnrichmentDecision(classification);

  return {
    title: canonicalTitle,
    titleKo,
    titleEn,
    source: article.source.trim(),
    sourceUrl: article.url.trim(),
    externalId: article.url.trim(),
    sourceLanguage,
    summaryKo,
    summaryEn,
    eventType: classification.eventType,
    eventSubType: classification.eventSubType,
    eventDirection: classification.eventDirection,
    riskLevel: classification.riskLevel,
    importanceScore: classification.importanceScore,
    confidenceScore: classification.confidenceScore ?? deriveConfidenceScore(classification.importanceScore),
    verificationStatus: classification.verificationStatus ??
      classifyVerificationStatus(summary, trustedSource),
    marketSentiment: classification.marketSentiment ?? deriveMarketSentiment(classification.eventDirection),
    timeHorizon: classification.timeHorizon ?? deriveTimeHorizon(classification.importanceScore),
    conflictStatus: classification.conflictStatus ?? deriveConflictStatus(classification.eventDirection),
    storyKey: classification.storyKeyHint ?? buildStoryKey(classification.eventType, region.regionName, classification.actors),
    storySequence: 1,
    sourceCount: 1,
    countryCode: region.countryCode,
    regionName: region.regionName,
    latitude: region.latitude,
    longitude: region.longitude,
    occurredAt: article.publishedAt,
    actors: classification.actors ?? [],
    targets: classification.targets ?? [],
    affectedAssets,
    macroChannels: classification.macroChannels ?? deriveMacroChannels(affectedAssets),
    facts,
    numericFacts: classification.numericFacts ?? [],
    inferences,
    contradictions: classification.contradictions ?? [],
    thesis,
    scenarioBase: classification.scenarioBase?.trim() ||
      '기본 시나리오: 현재 확인된 사실 기준으로 시장은 단기 변동성과 리스크 프리미엄을 반영할 가능성이 있습니다.',
    scenarioBull: classification.scenarioBull?.trim() ||
      '상방 시나리오: 완화 또는 협상 진전이 확인되면 위험자산 심리가 회복될 수 있습니다.',
    scenarioBear: classification.scenarioBear?.trim() ||
      '하방 시나리오: 추가 충돌이나 제재 확대가 확인되면 관련 자산 변동성이 재차 확대될 수 있습니다.',
    webEnriched: false,
    webEnrichmentStatus: webEnrichmentDecision.status,
    impacts,
    briefingLocalized: {},
    rawPayload: {
      article,
      localizedContent: {
        sourceLanguage,
        titleKo,
        titleEn,
        summaryKo,
        summaryEn,
      },
      eventSubType: classification.eventSubType,
      eventDirection: classification.eventDirection,
      importanceScore: classification.importanceScore,
      classifier: 'gemini',
      aiClassification: classification,
      webSearchSignals: webEnrichmentDecision.signals,
    },
  };
}

export function decorateStoryMetadata(events: NormalizedRiskEvent[]) {
  const groupedByStory = new Map<string, NormalizedRiskEvent[]>();

  for (const event of events) {
    const storyGroup = groupedByStory.get(event.storyKey) ?? [];
    storyGroup.push(event);
    groupedByStory.set(event.storyKey, storyGroup);
  }

  return events.map((event) => {
    const storyEvents = [...(groupedByStory.get(event.storyKey) ?? [])].sort((left, right) =>
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
    );
    const sourceCount = new Set(storyEvents.map((item) => item.source)).size;
    const storySequence = Math.max(
      1,
      storyEvents.findIndex((item) => item.externalId === event.externalId) + 1,
    );
    const contradictions = mergeContradictions(event.contradictions, detectStoryContradictions(event, storyEvents));

    return {
      ...event,
      sourceCount,
      storySequence,
      contradictions,
    };
  });
}

export function getInvalidArticleReason(article: Partial<RawArticle>) {
  if (!article.title?.trim()) {
    return 'title missing';
  }

  if (!article.source?.trim()) {
    return 'source missing';
  }

  if (!article.url?.trim()) {
    return 'url missing';
  }

  if (!article.publishedAt) {
    return 'publishedAt missing';
  }

  if (Number.isNaN(Date.parse(article.publishedAt))) {
    return 'publishedAt invalid';
  }

  return null;
}

function classifyVerificationStatus(
  summary: string | undefined,
  trustedSource: boolean,
): VerificationStatus {
  if (!summary) {
    return 'pending';
  }

  if (trustedSource && summary.length >= 60) {
    return 'verified';
  }

  return 'pending';
}

function isTrustedSource(source: string) {
  const lowered = source.toLowerCase();
  return trustedSourceTokens.some((token) => keywordMatches(token, lowered));
}

function resolveLocalizedValue(
  preferred: string | undefined,
  primaryFallback: string | undefined,
  secondaryFallback: string | undefined,
) {
  const candidate = preferred?.trim() || primaryFallback?.trim() || secondaryFallback?.trim();
  return candidate || undefined;
}

function inferSourceLanguage(...values: Array<string | undefined>) {
  const text = values.filter(Boolean).join(' ');

  if (/[가-힣]/.test(text)) {
    return 'ko' as const;
  }

  if (/[A-Za-z]/.test(text)) {
    return 'en' as const;
  }

  return 'other' as const;
}

function keywordMatches(keyword: string, searchText: string) {
  const escapedKeyword = escapeRegex(keyword.toLowerCase());
  return new RegExp(`\\b${escapedKeyword}\\b`, 'i').test(searchText);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cloneImpacts(impacts: NormalizedRiskEvent['impacts']) {
  return impacts.map((impact) => ({ ...impact }));
}

function applyEventDirectionToImpacts(
  impacts: NormalizedRiskEvent['impacts'],
  eventDirection: EventDirection,
): NormalizedRiskEvent['impacts'] {
  if (eventDirection === 'escalation') {
    return impacts;
  }

  return impacts.map((impact) => ({
    ...impact,
    direction: invertImpactDirection(impact.direction),
    moveHint: invertMoveHint(impact.moveHint),
    rationale: impact.rationale
      ? `${eventDirection === 'resolution' ? '해소 이벤트' : '완화 이벤트'}: ${impact.rationale}`
      : impact.rationale,
  }));
}

function invertImpactDirection(
  direction: NormalizedRiskEvent['impacts'][number]['direction'],
): NormalizedRiskEvent['impacts'][number]['direction'] {
  if (direction === 'up') {
    return 'down';
  }

  if (direction === 'down') {
    return 'up';
  }

  return 'mixed';
}

function invertMoveHint(moveHint: string | undefined) {
  if (!moveHint) {
    return moveHint;
  }

  if (moveHint.startsWith('+')) {
    return `-${moveHint.slice(1)}`;
  }

  if (moveHint.startsWith('-')) {
    return `+${moveHint.slice(1)}`;
  }

  return moveHint;
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

function deriveMarketSentiment(direction: EventDirection): MarketSentiment {
  switch (direction) {
    case 'resolution':
      return 'risk_on';
    case 'deescalation':
      return 'neutral';
    case 'escalation':
    default:
      return 'risk_off';
  }
}

function deriveTimeHorizon(importanceScore: number) {
  if (importanceScore >= 9) {
    return 'weeks';
  }

  if (importanceScore >= 7) {
    return 'days';
  }

  return 'intraday';
}

function deriveConflictStatus(direction: EventDirection) {
  switch (direction) {
    case 'resolution':
      return 'resolved';
    case 'deescalation':
      return 'negotiation';
    case 'escalation':
    default:
      return 'active_conflict';
  }
}

function buildStoryKey(
  eventType: RiskEventType,
  regionName: string,
  actors: string[] | undefined,
) {
  return [eventType, regionName, actors?.[0] ?? 'story']
    .join('_')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function deriveMacroChannels(affectedAssets: string[]) {
  const channels = new Set<string>();

  for (const assetCode of affectedAssets) {
    if (assetCode === 'WTI' || assetCode === 'BRENT' || assetCode === 'TTF') {
      channels.add(assetCode === 'TTF' ? 'gas' : 'oil');
      channels.add('inflation');
    }

    if (assetCode === 'BDI') {
      channels.add('shipping');
      channels.add('supply_chain');
    }

    if (assetCode === 'DXY') {
      channels.add('fx');
      channels.add('rates');
    }

    if (assetCode === 'DEFENSE') {
      channels.add('defense');
    }
  }

  return [...channels];
}

function buildDefaultFacts(article: RawArticle): StoryFact[] {
  return [
    {
      claim: article.title.trim(),
      asOfDate: article.publishedAt,
      source: article.source.trim(),
    },
  ];
}

function buildDefaultInferences(
  marketSentiment: MarketSentiment,
  impacts: NormalizedRiskEvent['impacts'],
) {
  const firstImpact = impacts[0];

  if (!firstImpact) {
    return [];
  }

  return [
    `AI 해석: 현재 이벤트는 ${marketSentiment === 'risk_off' ? '위험회피' : marketSentiment === 'risk_on' ? '위험선호' : '혼합'} 심리와 연결될 가능성이 있습니다.`,
    `AI 해석: ${firstImpact.assetName}의 ${firstImpact.direction === 'up' ? '상방' : firstImpact.direction === 'down' ? '하방' : '혼합'} 반응이 단기 시장 해석의 핵심 축일 수 있습니다.`,
  ];
}

function buildDefaultThesis(
  marketSentiment: MarketSentiment,
  impacts: NormalizedRiskEvent['impacts'],
  regionName: string,
) {
  if (impacts.length === 0) {
    return `${regionName} 지정학 이벤트는 투자 심리에 단기 변동성을 유발할 수 있습니다.`;
  }

  const assetNames = impacts.slice(0, 2).map((impact) => impact.assetName).join(', ');
  const sentimentLabel = marketSentiment === 'risk_off'
    ? '위험회피'
    : marketSentiment === 'risk_on'
      ? '위험선호'
      : '혼합';

  return `${regionName} 이벤트는 ${sentimentLabel} 심리를 통해 ${assetNames} 같은 자산에 영향을 줄 수 있습니다.`;
}

export function deriveWebEnrichmentDecision(
  classification: AiArticleClassification,
  options: {
    providerConfigured?: boolean;
  } = {},
): WebEnrichmentDecision {
  const aiRecommended = classification.webSearchRecommended === true;
  const highImportance = (classification.importanceScore ?? 0) >= 8;
  const requiresVerification = classification.requiresVerification === true;
  const hasContradictions = (classification.contradictions?.length ?? 0) > 0;
  const shouldEnrich = aiRecommended || highImportance || requiresVerification || hasContradictions;
  const providerConfigured = options.providerConfigured ?? isTavilyConfigured();

  return {
    status: !shouldEnrich
      ? 'not_needed'
      : providerConfigured
        ? 'pending'
        : 'skipped_unconfigured',
    signals: {
      aiRecommended,
      highImportance,
      requiresVerification,
      hasContradictions,
      shouldEnrich,
    },
  };
}

function isTavilyConfigured() {
  try {
    return Boolean(Deno.env.get('TAVILY_API_KEY'));
  } catch {
    return false;
  }
}

function mergeContradictions(
  existing: SourceConflict[],
  derived: SourceConflict[],
) {
  const deduped = new Map<string, SourceConflict>();

  for (const conflict of [...existing, ...derived]) {
    const key = `${conflict.topic}::${conflict.description}`;
    if (!deduped.has(key)) {
      deduped.set(key, conflict);
    }
  }

  return [...deduped.values()];
}

function detectStoryContradictions(
  event: NormalizedRiskEvent,
  storyEvents: NormalizedRiskEvent[],
): SourceConflict[] {
  const conflicts: SourceConflict[] = [];
  const directions = new Set(storyEvents.map((item) => item.eventDirection));

  if (directions.size > 1) {
    conflicts.push({
      topic: 'direction',
      description: '같은 스토리 안에서 긴장 방향성 해석이 엇갈립니다.',
      sourceA: storyEvents[0]?.source,
      sourceB: storyEvents.find((item) => item.eventDirection !== event.eventDirection)?.source,
      status: 'unresolved',
    });
  }

  const numericFactGroups = new Map<string, Set<number>>();

  for (const storyEvent of storyEvents) {
    for (const fact of storyEvent.numericFacts) {
      const values = numericFactGroups.get(fact.label) ?? new Set<number>();
      values.add(fact.value);
      numericFactGroups.set(fact.label, values);
    }
  }

  for (const [label, values] of numericFactGroups.entries()) {
    if (values.size > 1) {
      conflicts.push({
        topic: label,
        description: `${label} 관련 수치가 출처별로 일치하지 않습니다.`,
        sourceA: storyEvents[0]?.source,
        sourceB: storyEvents[storyEvents.length - 1]?.source,
        status: 'unresolved',
      });
    }
  }

  return conflicts;
}
