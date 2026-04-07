export type RiskEventType = 'missile' | 'drone' | 'bombing' | 'naval' | 'sanction';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type VerificationStatus = 'verified' | 'pending' | 'rejected';
export type ImpactDirection = 'up' | 'down' | 'mixed';

export interface AssetImpact {
  id: string;
  assetCode: string;
  assetName: string;
  direction: ImpactDirection;
  confidence: number;
  moveHint: string;
  rationale: string;
}

export interface RiskEvent {
  id: string;
  source: string;
  title: string;
  summary: string;
  eventType: RiskEventType;
  riskLevel: RiskLevel;
  verificationStatus: VerificationStatus;
  countryCode: string;
  regionName: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
  detectedAt: string;
  impacts: AssetImpact[];
}

const now = Date.now();

const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

export const mockRiskEvents: RiskEvent[] = [
  {
    id: '4f6fd8d1-f1f5-42c0-830a-badc1f717111',
    source: 'WAR-PICK Seed',
    title: '호르무즈 해협 인근 긴장 고조',
    summary:
      '해협 인근 군사 충돌 가능성이 높아지며 원유와 안전자산이 빠르게 반응하고 있습니다.',
    eventType: 'missile',
    riskLevel: 'high',
    verificationStatus: 'verified',
    countryCode: 'IR',
    regionName: '호르무즈 해협',
    latitude: 26.566,
    longitude: 56.249,
    occurredAt: minutesAgo(8),
    detectedAt: minutesAgo(6),
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
    summary:
      '홍해 항로 경계 수위가 다시 올라가며 해운과 공급망 민감도가 확대되고 있습니다.',
    eventType: 'drone',
    riskLevel: 'medium',
    verificationStatus: 'pending',
    countryCode: 'YE',
    regionName: '홍해',
    latitude: 15.103,
    longitude: 42.571,
    occurredAt: minutesAgo(21),
    detectedAt: minutesAgo(18),
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
    summary:
      '에너지 및 물류 인프라 타격 보고가 이어지며 유럽 자산 민감도가 높아지고 있습니다.',
    eventType: 'bombing',
    riskLevel: 'medium',
    verificationStatus: 'verified',
    countryCode: 'UA',
    regionName: '동유럽',
    latitude: 48.379,
    longitude: 31.165,
    occurredAt: minutesAgo(43),
    detectedAt: minutesAgo(39),
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

const riskWeights: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

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
  return riskWeights[event.riskLevel] * 10 + confidenceScore;
}

export function getRelativeTimeLabel(isoDate: string) {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(isoDate)) / 60_000));

  if (minutes < 60) {
    return `${minutes}분 전`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours}시간 전`;
}

export function getRiskLabel(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case 'critical':
      return '매우 높음';
    case 'high':
      return '높음';
    case 'medium':
      return '보통';
    default:
      return '낮음';
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

export function getDirectionLabel(direction: ImpactDirection) {
  switch (direction) {
    case 'up':
      return '상방';
    case 'down':
      return '하방';
    default:
      return '혼합';
  }
}

export function getEventTypeLabel(eventType: RiskEventType) {
  switch (eventType) {
    case 'missile':
      return '미사일';
    case 'drone':
      return '드론';
    case 'bombing':
      return '폭격';
    case 'naval':
      return '해상';
    case 'sanction':
      return '제재';
    default:
      return eventType;
  }
}

export function getVerificationStatusLabel(status: VerificationStatus) {
  switch (status) {
    case 'verified':
      return '검증됨';
    case 'pending':
      return '검토 중';
    case 'rejected':
      return '반려';
    default:
      return status;
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
