export type RiskEventType =
  | 'missile'
  | 'drone'
  | 'bombing'
  | 'naval'
  | 'sanction'
  | 'diplomatic'
  | 'cyber'
  | 'nuclear'
  | 'energy'
  | 'political';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type VerificationStatus = 'verified' | 'pending' | 'rejected';
export type ImpactDirection = 'up' | 'down' | 'mixed';
export type EventDirection = 'escalation' | 'deescalation' | 'resolution';
export type MarketSentiment = 'risk_on' | 'risk_off' | 'mixed' | 'neutral';
export type TimeHorizon = 'intraday' | 'days' | 'weeks' | 'months';
export type ConflictStatus =
  | 'active_conflict'
  | 'ceasefire'
  | 'negotiation'
  | 'sanctions_cycle'
  | 'resolved';
export type WebEnrichmentStatus =
  | 'not_needed'
  | 'pending'
  | 'completed'
  | 'skipped_unconfigured'
  | 'failed';
export type ContentLocale = 'ko' | 'en';

export interface StoryFact {
  claim: string;
  value?: string;
  asOfDate?: string;
  source?: string;
}

export interface NumericFact {
  label: string;
  value: number;
  unit?: string;
  asOfDate?: string;
  source?: string;
}

export interface SourceConflict {
  topic: string;
  description: string;
  sourceA?: string;
  sourceB?: string;
  status: 'unresolved' | 'resolved';
}

export interface AssetImpact {
  id: string;
  assetCode: string;
  assetName: string;
  direction: ImpactDirection;
  confidence: number;
  moveHint: string;
  rationale: string;
}

export interface LocalizedBriefingBlock {
  fact: string;
  insight: string;
  uncertainty?: string;
  scenarioBase?: string;
  meta?: string;
}

export interface RiskEvent {
  id: string;
  source: string;
  title: string;
  summary: string;
  titleKo?: string;
  titleEn?: string;
  summaryKo?: string;
  summaryEn?: string;
  sourceLanguage?: 'ko' | 'en' | 'other';
  eventType: RiskEventType;
  eventSubType?: string;
  eventDirection?: EventDirection;
  riskLevel: RiskLevel;
  importanceScore: number;
  confidenceScore: number;
  verificationStatus: VerificationStatus;
  marketSentiment: MarketSentiment;
  timeHorizon: TimeHorizon;
  conflictStatus: ConflictStatus;
  storyKey: string;
  storySequence: number;
  sourceCount: number;
  countryCode: string;
  regionName: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
  detectedAt: string;
  actors: string[];
  targets: string[];
  affectedAssets: string[];
  macroChannels: string[];
  facts: StoryFact[];
  numericFacts: NumericFact[];
  inferences: string[];
  contradictions: SourceConflict[];
  thesis: string;
  scenarioBase: string;
  scenarioBull: string;
  scenarioBear: string;
  webEnriched: boolean;
  webEnrichmentStatus: WebEnrichmentStatus;
  impacts: AssetImpact[];
  localizedBriefing?: Partial<Record<ContentLocale, LocalizedBriefingBlock>>;
}

const now = Date.now();

const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

export const mockRiskEvents: RiskEvent[] = [
  {
    id: '4f6fd8d1-f1f5-42c0-830a-badc1f717111',
    source: 'WAR-PICK Seed',
    title: '호르무즈 해협 인근 긴장 고조',
    titleKo: '호르무즈 해협 인근 긴장 고조',
    titleEn: 'Tension rises near the Strait of Hormuz',
    summary:
      '해협 인근 군사 충돌 가능성이 높아지며 원유와 안전자산이 빠르게 반응하고 있습니다.',
    summaryKo:
      '해협 인근 군사 충돌 가능성이 높아지며 원유와 안전자산이 빠르게 반응하고 있습니다.',
    summaryEn:
      'Rising odds of military confrontation near the strait are driving a fast move in oil and safe-haven assets.',
    eventType: 'missile',
    eventDirection: 'escalation',
    riskLevel: 'high',
    importanceScore: 8,
    confidenceScore: 0.78,
    verificationStatus: 'verified',
    marketSentiment: 'risk_off',
    timeHorizon: 'days',
    conflictStatus: 'active_conflict',
    storyKey: 'missile_strait_of_hormuz_iran',
    storySequence: 1,
    sourceCount: 2,
    countryCode: 'IR',
    regionName: '호르무즈 해협',
    latitude: 26.566,
    longitude: 56.249,
    occurredAt: minutesAgo(8),
    detectedAt: minutesAgo(6),
    actors: ['이란', '미국'],
    targets: ['호르무즈 해협 상선 항로'],
    affectedAssets: ['WTI', 'XAU'],
    macroChannels: ['oil', 'inflation', 'shipping'],
    facts: [
      {
        claim: '호르무즈 해협 인근에서 미사일 경보가 반복 보고됐다.',
        asOfDate: minutesAgo(8),
        source: 'WAR-PICK Seed',
      },
    ],
    numericFacts: [
      {
        label: '예상 유가 반응',
        value: 2.4,
        unit: '%',
        asOfDate: minutesAgo(8),
        source: 'WAR-PICK Seed',
      },
    ],
    inferences: [
      'AI 해석: 해협 긴장이 장기화되면 운송 병목 우려가 원유 리스크 프리미엄으로 전이될 수 있습니다.',
    ],
    contradictions: [],
    thesis:
      '호르무즈 해협은 글로벌 원유 수송의 핵심 통로이므로, 경보만으로도 원유와 안전자산이 민감하게 반응할 수 있습니다.',
    scenarioBase: '기본 시나리오: 긴장이 이어지면 유가와 금의 위험 프리미엄이 유지될 수 있습니다.',
    scenarioBull: '상방 시나리오: 긴장이 완화되면 에너지 부담이 줄며 위험자산 심리가 회복될 수 있습니다.',
    scenarioBear: '하방 시나리오: 실제 충돌이나 봉쇄 우려가 커지면 유가 급등과 증시 변동성이 확대될 수 있습니다.',
    webEnriched: false,
    webEnrichmentStatus: 'not_needed',
    impacts: [
      {
        id: '8f1f7d76-8702-4f30-af0f-78dca6aa7101',
        assetCode: 'WTI',
        assetName: 'Oil',
        direction: 'up',
        confidence: 0.82,
        moveHint: '+2.4%',
        rationale: '호르무즈 해협 긴장은 원유 운송 병목 우려를 키워 유가 상방 압력을 강화할 수 있습니다.',
      },
      {
        id: '8f1f7d76-8702-4f30-af0f-78dca6aa7102',
        assetCode: 'XAU',
        assetName: 'Gold',
        direction: 'up',
        confidence: 0.75,
        moveHint: '+1.1%',
        rationale: '중동 지정학 리스크 확대 시 안전자산 선호가 강해지며 금이 동반 강세를 보일 수 있습니다.',
      },
    ],
  },
  {
    id: '4f6fd8d1-f1f5-42c0-830a-badc1f717112',
    source: 'WAR-PICK Seed',
    title: '홍해 항로 드론 위협 감지',
    titleKo: '홍해 항로 드론 위협 감지',
    titleEn: 'Drone threat detected along the Red Sea route',
    summary:
      '홍해 항로 경계 수위가 다시 올라가며 해운과 공급망 민감도가 확대되고 있습니다.',
    summaryKo:
      '홍해 항로 경계 수위가 다시 올라가며 해운과 공급망 민감도가 확대되고 있습니다.',
    summaryEn:
      'Security risk along the Red Sea route is climbing again, raising sensitivity across shipping and supply chains.',
    eventType: 'drone',
    eventDirection: 'escalation',
    riskLevel: 'medium',
    importanceScore: 7,
    confidenceScore: 0.71,
    verificationStatus: 'pending',
    marketSentiment: 'risk_off',
    timeHorizon: 'days',
    conflictStatus: 'active_conflict',
    storyKey: 'drone_red_sea_houthis',
    storySequence: 1,
    sourceCount: 1,
    countryCode: 'YE',
    regionName: '홍해',
    latitude: 15.103,
    longitude: 42.571,
    occurredAt: minutesAgo(21),
    detectedAt: minutesAgo(18),
    actors: ['예멘 후티 반군'],
    targets: ['홍해 민간 선박'],
    affectedAssets: ['BDI', 'SOX'],
    macroChannels: ['shipping', 'supply_chain'],
    facts: [
      {
        claim: '홍해 항로에서 드론 위협으로 선사들이 우회 경로를 검토했다.',
        asOfDate: minutesAgo(21),
        source: 'WAR-PICK Seed',
      },
    ],
    numericFacts: [],
    inferences: [
      'AI 해석: 항로 우회가 길어질수록 해운비 상승과 공급망 지연이 확대될 수 있습니다.',
    ],
    contradictions: [],
    thesis: '홍해 항로 차질은 물류비와 공급망 심리에 바로 연결되기 때문에 반도체와 운임 지표가 민감하게 반응할 수 있습니다.',
    scenarioBase: '기본 시나리오: 선사 우회가 이어지면 운임과 공급망 우려가 유지될 수 있습니다.',
    scenarioBull: '상방 시나리오: 항로 경계가 빠르게 완화되면 물류 병목 우려가 줄어들 수 있습니다.',
    scenarioBear: '하방 시나리오: 추가 공격이 발생하면 운임 급등과 생산 차질 우려가 커질 수 있습니다.',
    webEnriched: false,
    webEnrichmentStatus: 'pending',
    impacts: [
      {
        id: '8f1f7d76-8702-4f30-af0f-78dca6aa7103',
        assetCode: 'BDI',
        assetName: 'Freight',
        direction: 'up',
        confidence: 0.73,
        moveHint: '+1.8%',
        rationale: '홍해 항로 긴장 재확대는 운임과 선복 불확실성을 끌어올릴 수 있습니다.',
      },
      {
        id: '8f1f7d76-8702-4f30-af0f-78dca6aa7104',
        assetCode: 'SOX',
        assetName: 'Semis',
        direction: 'down',
        confidence: 0.68,
        moveHint: '-0.6%',
        rationale: '항로 지연이 커지면 반도체 공급망 심리가 위축될 수 있습니다.',
      },
    ],
  },
  {
    id: '4f6fd8d1-f1f5-42c0-830a-badc1f717113',
    source: 'WAR-PICK Seed',
    title: '동유럽 인프라 타격 발생',
    titleKo: '동유럽 인프라 타격 발생',
    titleEn: 'Infrastructure strike reported in Eastern Europe',
    summary:
      '에너지 및 물류 인프라 타격 보고가 이어지며 유럽 자산 민감도가 높아지고 있습니다.',
    summaryKo:
      '에너지 및 물류 인프라 타격 보고가 이어지며 유럽 자산 민감도가 높아지고 있습니다.',
    summaryEn:
      'Ongoing reports of strikes on energy and logistics infrastructure are raising sensitivity in European assets.',
    eventType: 'bombing',
    eventDirection: 'escalation',
    riskLevel: 'medium',
    importanceScore: 6,
    confidenceScore: 0.69,
    verificationStatus: 'verified',
    marketSentiment: 'risk_off',
    timeHorizon: 'days',
    conflictStatus: 'active_conflict',
    storyKey: 'bombing_eastern_europe_russia',
    storySequence: 1,
    sourceCount: 2,
    countryCode: 'UA',
    regionName: '동유럽',
    latitude: 48.379,
    longitude: 31.165,
    occurredAt: minutesAgo(43),
    detectedAt: minutesAgo(39),
    actors: ['러시아', '우크라이나'],
    targets: ['에너지 인프라', '물류 인프라'],
    affectedAssets: ['TTF', 'DEFENSE'],
    macroChannels: ['gas', 'inflation', 'defense'],
    facts: [
      {
        claim: '동유럽 에너지 및 물류 인프라 타격 보고가 이어졌다.',
        asOfDate: minutesAgo(43),
        source: 'WAR-PICK Seed',
      },
    ],
    numericFacts: [
      {
        label: '예상 유럽 가스 반응',
        value: 3.2,
        unit: '%',
        asOfDate: minutesAgo(43),
        source: 'WAR-PICK Seed',
      },
    ],
    inferences: [
      'AI 해석: 에너지 인프라 불안은 유럽 가스 가격과 인플레이션 우려를 동시에 자극할 수 있습니다.',
    ],
    contradictions: [],
    thesis: '동유럽 인프라 충격은 에너지 가격과 방산 수요 기대를 동시에 밀어 올릴 수 있어 유럽 자산에 넓게 영향을 줄 수 있습니다.',
    scenarioBase: '기본 시나리오: 인프라 복구 지연 시 가스와 방산 관련 자산 민감도가 유지될 수 있습니다.',
    scenarioBull: '상방 시나리오: 복구와 휴전 신호가 확인되면 에너지 부담이 빠르게 완화될 수 있습니다.',
    scenarioBear: '하방 시나리오: 인프라 타격이 연속 발생하면 가스 가격과 유럽 리스크 프리미엄이 확대될 수 있습니다.',
    webEnriched: false,
    webEnrichmentStatus: 'not_needed',
    impacts: [
      {
        id: '8f1f7d76-8702-4f30-af0f-78dca6aa7105',
        assetCode: 'TTF',
        assetName: 'Gas',
        direction: 'up',
        confidence: 0.84,
        moveHint: '+3.2%',
        rationale:
          '동유럽 인프라 타격은 유럽 에너지 수급 불안을 자극해 가스 가격에 상방 압력을 줄 수 있습니다.',
      },
      {
        id: '8f1f7d76-8702-4f30-af0f-78dca6aa7106',
        assetCode: 'DEFENSE',
        assetName: 'Defense',
        direction: 'up',
        confidence: 0.72,
        moveHint: '+1.5%',
        rationale: '방산 관련 수급 기대가 단기적으로 강해질 수 있습니다.',
      },
    ],
  },
];

export const riskEvents = mockRiskEvents;

export function getTotalImpacts(events: RiskEvent[]) {
  return events.reduce((sum, event) => sum + event.impacts.length, 0);
}

export function getLatestEvent(events: RiskEvent[]) {
  return [...events].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  )[0];
}

export function getFeaturedEvent(events: RiskEvent[]) {
  return [...events].sort((left, right) => {
    const rightScore = getMarketImpactScore(right);
    const leftScore = getMarketImpactScore(left);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  })[0];
}

export const totalImpacts = getTotalImpacts(riskEvents);
export const latestEvent = getLatestEvent(riskEvents);
export const featuredEvent = getFeaturedEvent(riskEvents);

export function getMarketImpactScore(event: RiskEvent) {
  const confidenceScore = event.impacts.reduce((sum, impact) => sum + impact.confidence, 0);
  return event.importanceScore * 10 + confidenceScore;
}

export function getRelativeTimeLabel(isoDate: string, locale: ContentLocale = 'ko') {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(isoDate)) / 60_000));

  if (minutes < 60) {
    return locale === 'en' ? `${minutes}m ago` : `${minutes}분 전`;
  }

  const hours = Math.round(minutes / 60);
  return locale === 'en' ? `${hours}h ago` : `${hours}시간 전`;
}

export function getRiskLabel(riskLevel: RiskLevel, locale: ContentLocale = 'ko') {
  switch (riskLevel) {
    case 'critical':
      return locale === 'en' ? 'Critical' : '매우 높음';
    case 'high':
      return locale === 'en' ? 'High' : '높음';
    case 'medium':
      return locale === 'en' ? 'Medium' : '보통';
    default:
      return locale === 'en' ? 'Low' : '낮음';
  }
}

export function getRiskColor(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case 'critical':
      return '#ff4d4f';
    case 'high':
      return '#ff8b5e';
    case 'medium':
      return '#ffbe5c';
    default:
      return '#7fd4ff';
  }
}

export function getImportanceLabel(importanceScore: number, locale: ContentLocale = 'ko') {
  if (importanceScore >= 9) {
    return locale === 'en' ? 'Top' : '최우선';
  }

  if (importanceScore >= 7) {
    return locale === 'en' ? 'High' : '높음';
  }

  if (importanceScore >= 4) {
    return locale === 'en' ? 'Watch' : '경계';
  }

  return locale === 'en' ? 'Low' : '낮음';
}

export function getDirectionLabel(direction: ImpactDirection, locale: ContentLocale = 'ko') {
  switch (direction) {
    case 'up':
      return locale === 'en' ? 'Up' : '상방';
    case 'down':
      return locale === 'en' ? 'Down' : '하방';
    default:
      return locale === 'en' ? 'Mixed' : '혼합';
  }
}

export function getEventTypeLabel(eventType: RiskEventType, locale: ContentLocale = 'ko') {
  switch (eventType) {
    case 'missile':
      return locale === 'en' ? 'Missile' : '미사일';
    case 'drone':
      return locale === 'en' ? 'Drone' : '드론';
    case 'bombing':
      return locale === 'en' ? 'Conflict' : '군사 충돌';
    case 'naval':
      return locale === 'en' ? 'Naval choke' : '해상 병목';
    case 'sanction':
      return locale === 'en' ? 'Sanctions' : '제재/정책';
    case 'diplomatic':
      return locale === 'en' ? 'Diplomatic' : '외교';
    case 'cyber':
      return locale === 'en' ? 'Cyber' : '사이버';
    case 'nuclear':
      return locale === 'en' ? 'Nuclear' : '핵 리스크';
    case 'energy':
      return locale === 'en' ? 'Energy' : '에너지';
    case 'political':
      return locale === 'en' ? 'Political' : '정권/내정';
    default:
      return eventType;
  }
}

export function getEventTypeCode(eventType: RiskEventType) {
  switch (eventType) {
    case 'missile':
      return 'MS';
    case 'drone':
      return 'DR';
    case 'bombing':
      return 'CF';
    case 'naval':
      return 'NV';
    case 'sanction':
      return 'SC';
    case 'diplomatic':
      return 'DP';
    case 'cyber':
      return 'CY';
    case 'nuclear':
      return 'NU';
    case 'energy':
      return 'EN';
    case 'political':
      return 'PL';
    default:
      return 'EV';
  }
}

export function getEventTypeColor(eventType: RiskEventType) {
  switch (eventType) {
    case 'missile':
      return '#ff8d6a';
    case 'drone':
      return '#f0b84f';
    case 'bombing':
      return '#ff5b55';
    case 'naval':
      return '#4cb4b8';
    case 'sanction':
      return '#d58a3a';
    case 'diplomatic':
      return '#6cbf93';
    case 'cyber':
      return '#7ea2ff';
    case 'nuclear':
      return '#d771f5';
    case 'energy':
      return '#56b96f';
    case 'political':
      return '#c97b95';
    default:
      return '#9fb4bd';
  }
}

export function getEventDirectionLabel(direction: EventDirection | undefined, locale: ContentLocale = 'ko') {
  switch (direction) {
    case 'deescalation':
      return locale === 'en' ? 'Ease' : '완화';
    case 'resolution':
      return locale === 'en' ? 'Resolve' : '해소';
    case 'escalation':
    default:
      return locale === 'en' ? 'Escalate' : '고조';
  }
}

export function getEventDirectionColor(direction: EventDirection | undefined) {
  switch (direction) {
    case 'deescalation':
      return '#f0b84f';
    case 'resolution':
      return '#63c98d';
    case 'escalation':
    default:
      return '#ff5b55';
  }
}

export function getVerificationStatusLabel(status: VerificationStatus, locale: ContentLocale = 'ko') {
  switch (status) {
    case 'verified':
      return locale === 'en' ? 'Verified' : '검증됨';
    case 'pending':
      return locale === 'en' ? 'Pending' : '검토 중';
    case 'rejected':
      return locale === 'en' ? 'Rejected' : '반려';
    default:
      return status;
  }
}

export function getMarketSentimentLabel(sentiment: MarketSentiment, locale: ContentLocale = 'ko') {
  switch (sentiment) {
    case 'risk_on':
      return locale === 'en' ? 'Risk-on' : '위험선호';
    case 'risk_off':
      return locale === 'en' ? 'Risk-off' : '위험회피';
    case 'mixed':
      return locale === 'en' ? 'Mixed' : '혼합';
    case 'neutral':
    default:
      return locale === 'en' ? 'Neutral' : '중립';
  }
}

export function getTimeHorizonLabel(timeHorizon: TimeHorizon, locale: ContentLocale = 'ko') {
  switch (timeHorizon) {
    case 'days':
      return locale === 'en' ? 'Days' : '수일';
    case 'weeks':
      return locale === 'en' ? 'Weeks' : '수주';
    case 'months':
      return locale === 'en' ? 'Months' : '수개월';
    case 'intraday':
    default:
      return locale === 'en' ? 'Intraday' : '당일';
  }
}

export function getConflictStatusLabel(status: ConflictStatus, locale: ContentLocale = 'ko') {
  switch (status) {
    case 'ceasefire':
      return locale === 'en' ? 'Ceasefire' : '휴전';
    case 'negotiation':
      return locale === 'en' ? 'Negotiation' : '협상 국면';
    case 'sanctions_cycle':
      return locale === 'en' ? 'Sanctions' : '제재 국면';
    case 'resolved':
      return locale === 'en' ? 'Resolved' : '해결 국면';
    case 'active_conflict':
    default:
      return locale === 'en' ? 'Active' : '활성 충돌';
  }
}

export function getWebEnrichmentStatusLabel(status: WebEnrichmentStatus, locale: ContentLocale = 'ko') {
  switch (status) {
    case 'completed':
      return locale === 'en' ? 'Web confirmed' : '웹 보강 완료';
    case 'pending':
      return locale === 'en' ? 'Web check needed' : '웹 검증 필요';
    case 'skipped_unconfigured':
      return locale === 'en' ? 'Web unconfigured' : '웹 검증 미설정';
    case 'failed':
      return locale === 'en' ? 'Web failed' : '웹 검증 실패';
    case 'not_needed':
    default:
      return locale === 'en' ? 'No extra search' : '추가 검색 불필요';
  }
}

export function getDirectionColor(direction: ImpactDirection) {
  switch (direction) {
    case 'up':
      return '#6be675';
    case 'down':
      return '#ff7b72';
    default:
      return '#7fd4ff';
  }
}

export function getPinPosition(latitude: number, longitude: number) {
  const x = ((longitude + 180) / 360) * 100;
  const y = ((90 - latitude) / 180) * 100;

  return {
    left: `${Math.min(92, Math.max(8, x))}%` as `${number}%`,
    top: `${Math.min(82, Math.max(12, y))}%` as `${number}%`,
  };
}

export function getLocalizedEventTitle(event: RiskEvent, locale: ContentLocale) {
  return locale === 'en'
    ? event.titleEn ?? event.title
    : event.titleKo ?? event.title;
}

export function getLocalizedEventSummary(event: RiskEvent, locale: ContentLocale) {
  return locale === 'en'
    ? event.summaryEn ?? event.summary
    : event.summaryKo ?? event.summary;
}
