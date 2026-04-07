export type RiskEventType = 'missile' | 'drone' | 'bombing' | 'naval' | 'sanction';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface RawArticle {
  title: string;
  summary?: string;
  source: string;
  url: string;
  publishedAt: string;
}

export interface NormalizedRiskEvent {
  title: string;
  source: string;
  sourceUrl: string;
  externalId?: string;
  summaryKo?: string;
  summaryEn?: string;
  eventType: RiskEventType;
  riskLevel: RiskLevel;
  verificationStatus: VerificationStatus;
  countryCode?: string;
  regionName?: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
  impacts: {
    assetCode: string;
    assetName: string;
    direction: 'up' | 'down' | 'mixed';
    confidence: number;
    moveHint?: string;
    rationale?: string;
  }[];
  rawPayload: Record<string, unknown>;
}
