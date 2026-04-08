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
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
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
export type SupportedLocale = 'ko' | 'en';
export type SourceLanguage = 'ko' | 'en' | 'other';

export interface RawArticle {
  title: string;
  summary?: string;
  source: string;
  url: string;
  publishedAt: string;
}

export interface NumericFact {
  label: string;
  value: number;
  unit?: string;
  asOfDate?: string;
  source?: string;
}

export interface StoryFact {
  claim: string;
  value?: string;
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

export interface LocalizedBriefingBlock {
  fact: string;
  insight: string;
  uncertainty?: string;
  scenarioBase?: string;
  meta?: string;
}

export interface NormalizedRiskEvent {
  title: string;
  titleKo?: string;
  titleEn?: string;
  source: string;
  sourceUrl: string;
  externalId?: string;
  sourceLanguage?: SourceLanguage;
  summaryKo?: string;
  summaryEn?: string;
  eventType: RiskEventType;
  eventSubType?: string;
  eventDirection: EventDirection;
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
  countryCode?: string;
  regionName?: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
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
  impacts: {
    assetCode: string;
    assetName: string;
    direction: 'up' | 'down' | 'mixed';
    confidence: number;
    moveHint?: string;
    rationale?: string;
  }[];
  briefingLocalized?: Partial<Record<SupportedLocale, LocalizedBriefingBlock>>;
  rawPayload: Record<string, unknown>;
}

export interface AiArticleClassification {
  relevant: boolean;
  reason?: string;
  sourceLanguage?: SourceLanguage;
  titleKo?: string;
  titleEn?: string;
  summaryKo?: string;
  summaryEn?: string;
  eventType?: RiskEventType;
  eventSubType?: string;
  eventDirection?: EventDirection;
  riskLevel?: RiskLevel;
  importanceScore?: number;
  confidenceScore?: number;
  regionKey?: string;
  verificationStatus?: VerificationStatus;
  marketSentiment?: MarketSentiment;
  timeHorizon?: TimeHorizon;
  conflictStatus?: ConflictStatus;
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
}
