import type {
  NormalizedRiskEvent,
  RawArticle,
  RiskEventType,
  RiskLevel,
  VerificationStatus,
} from './event-types.ts';

type KeywordRule<T> = {
  value: T;
  keywords: string[];
};

type RegionProfile = {
  countryCode: string;
  regionName: string;
  latitude: number;
  longitude: number;
  impacts: NormalizedRiskEvent['impacts'];
  keywords: string[];
};

type NormalizationSignals = {
  matchedEventKeywords: string[];
  matchedRiskKeywords: string[];
  matchedRegionKeywords: string[];
  trustedSource: boolean;
};

const eventTypeRules: KeywordRule<RiskEventType>[] = [
  { value: 'sanction', keywords: ['sanction', 'embargo', 'tariff', 'freeze'] },
  { value: 'missile', keywords: ['missile', 'rocket', 'airstrike', 'strike', 'ballistic'] },
  { value: 'drone', keywords: ['drone', 'uav'] },
  { value: 'naval', keywords: ['naval', 'ship', 'vessel', 'fleet', 'strait', 'shipping', 'port'] },
  { value: 'bombing', keywords: ['bomb', 'bombing', 'blast', 'explosion', 'attack'] },
];

const riskLevelRules: KeywordRule<RiskLevel>[] = [
  {
    value: 'critical',
    keywords: ['strait of hormuz', 'hormuz', 'blockade', 'oil terminal', 'nuclear'],
  },
  {
    value: 'high',
    keywords: ['red sea', 'port', 'terminal', 'pipeline', 'refinery', 'shipping lane', 'infrastructure'],
  },
  {
    value: 'medium',
    keywords: ['border', 'troop', 'alert', 'warning', 'military', 'conflict'],
  },
];

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

const regionProfiles: RegionProfile[] = [
  {
    countryCode: 'IR',
    regionName: 'Strait of Hormuz',
    latitude: 26.566,
    longitude: 56.249,
    keywords: ['hormuz', 'persian gulf', 'oman gulf', 'iran strait'],
    impacts: [
      {
        assetCode: 'WTI',
        assetName: 'Oil',
        direction: 'up',
        confidence: 0.84,
        moveHint: '+2.2%',
        rationale: '해상 원유 운송 병목 우려가 커지면 유가 상방 압력이 강화될 수 있습니다.',
      },
      {
        assetCode: 'XAU',
        assetName: 'Gold',
        direction: 'up',
        confidence: 0.76,
        moveHint: '+1.0%',
        rationale: '중동 긴장 확대는 안전자산 선호를 자극해 금 강세로 이어질 수 있습니다.',
      },
    ],
  },
  {
    countryCode: 'YE',
    regionName: 'Red Sea',
    latitude: 15.103,
    longitude: 42.571,
    keywords: ['red sea', 'bab el-mandeb', 'aden', 'yemen coast'],
    impacts: [
      {
        assetCode: 'BDI',
        assetName: 'Freight',
        direction: 'up',
        confidence: 0.74,
        moveHint: '+1.7%',
        rationale: '홍해 항로 긴장은 운임과 선복 불확실성을 끌어올릴 수 있습니다.',
      },
      {
        assetCode: 'SOX',
        assetName: 'Semis',
        direction: 'down',
        confidence: 0.67,
        moveHint: '-0.5%',
        rationale: '해운 지연이 길어지면 반도체 공급망 심리가 약해질 수 있습니다.',
      },
    ],
  },
  {
    countryCode: 'UA',
    regionName: 'Eastern Europe',
    latitude: 48.379,
    longitude: 31.165,
    keywords: ['ukraine', 'kyiv', 'odesa', 'crimea', 'eastern europe'],
    impacts: [
      {
        assetCode: 'TTF',
        assetName: 'Gas',
        direction: 'up',
        confidence: 0.83,
        moveHint: '+2.8%',
        rationale: '동유럽 인프라 충격은 유럽 에너지 수급 불안을 키울 수 있습니다.',
      },
      {
        assetCode: 'DEFENSE',
        assetName: 'Defense',
        direction: 'up',
        confidence: 0.71,
        moveHint: '+1.4%',
        rationale: '분쟁 장기화 우려는 방산 관련 수요 기대를 자극할 수 있습니다.',
      },
    ],
  },
  {
    countryCode: 'IL',
    regionName: 'Eastern Mediterranean',
    latitude: 32.085,
    longitude: 34.781,
    keywords: ['israel', 'gaza', 'lebanon', 'hezbollah', 'eastern mediterranean'],
    impacts: [
      {
        assetCode: 'XAU',
        assetName: 'Gold',
        direction: 'up',
        confidence: 0.7,
        moveHint: '+0.9%',
        rationale: '중동 리스크 확산은 안전자산 선호를 강화할 수 있습니다.',
      },
      {
        assetCode: 'BRENT',
        assetName: 'Oil',
        direction: 'up',
        confidence: 0.72,
        moveHint: '+1.4%',
        rationale: '에너지 공급 우려가 부각되면 국제유가 민감도가 올라갈 수 있습니다.',
      },
    ],
  },
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
};

export function normalizeArticle(article: RawArticle): NormalizedRiskEvent | null {
  if (getInvalidArticleReason(article) !== null) {
    return null;
  }

  const summary = article.summary?.trim();
  const searchText = [article.title, summary, article.source].filter(Boolean).join(' ').toLowerCase();
  const eventTypeMatch = findRuleMatch(eventTypeRules, searchText);
  const riskLevelMatch = findRuleMatch(riskLevelRules, searchText);
  const regionProfile = findRegionProfile(searchText);
  const trustedSource = isTrustedSource(article.source);
  const verificationStatus = classifyVerificationStatus(summary, trustedSource);
  const eventType = eventTypeMatch?.value ?? 'bombing';
  const riskLevel = riskLevelMatch?.value ?? deriveRiskLevel(eventType, regionProfile !== null);
  const impacts = cloneImpacts(regionProfile?.impacts ?? defaultImpacts[eventType]);
  const region = regionProfile ?? {
    countryCode: undefined,
    regionName: 'Unknown region',
    latitude: 0,
    longitude: 0,
  };
  const extractionSignals: NormalizationSignals = {
    matchedEventKeywords: eventTypeMatch?.matchedKeywords ?? [],
    matchedRiskKeywords: riskLevelMatch?.matchedKeywords ?? [],
    matchedRegionKeywords: regionProfile ? collectMatchedKeywords(regionProfile.keywords, searchText) : [],
    trustedSource,
  };

  return {
    title: article.title.trim(),
    source: article.source.trim(),
    sourceUrl: article.url.trim(),
    externalId: article.url.trim(),
    summaryKo: summary,
    summaryEn: summary,
    eventType,
    riskLevel,
    verificationStatus,
    countryCode: region.countryCode,
    regionName: region.regionName,
    latitude: region.latitude,
    longitude: region.longitude,
    occurredAt: article.publishedAt,
    impacts,
    rawPayload: {
      article,
      extractionSignals,
      todo: 'Replace heuristics with Gemini extraction and source verification.',
    },
  };
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

function deriveRiskLevel(eventType: RiskEventType, hasRegionProfile: boolean): RiskLevel {
  if (hasRegionProfile && (eventType === 'naval' || eventType === 'missile')) {
    return 'high';
  }

  if (eventType === 'sanction') {
    return 'medium';
  }

  return 'medium';
}

function isTrustedSource(source: string) {
  const lowered = source.toLowerCase();
  return trustedSourceTokens.some((token) => lowered.includes(token));
}

function findRegionProfile(searchText: string) {
  return (
    regionProfiles.find((profile) =>
      profile.keywords.some((keyword) => searchText.includes(keyword)),
    ) ?? null
  );
}

function findRuleMatch<T>(rules: KeywordRule<T>[], searchText: string) {
  for (const rule of rules) {
    const matchedKeywords = collectMatchedKeywords(rule.keywords, searchText);

    if (matchedKeywords.length > 0) {
      return {
        value: rule.value,
        matchedKeywords,
      };
    }
  }

  return null;
}

function collectMatchedKeywords(keywords: string[], searchText: string) {
  return keywords.filter((keyword) => searchText.includes(keyword));
}

function cloneImpacts(impacts: NormalizedRiskEvent['impacts']) {
  return impacts.map((impact) => ({ ...impact }));
}
