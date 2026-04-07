import type { NormalizedRiskEvent } from '../functions/_shared/event-types.ts';
import { normalizeArticle } from '../functions/_shared/ingest-heuristics.ts';
import {
  persistNormalizedEvents,
  type AssetImpactInsertRow,
  type PersistenceClient,
  type RiskEventUpsertRow,
} from '../functions/_shared/ingest-persistence.ts';

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

function createNormalizedEvent(
  overrides: Partial<NormalizedRiskEvent> = {},
): NormalizedRiskEvent {
  return {
    title: 'Sample event',
    source: 'Reuters',
    sourceUrl: 'https://example.com/sample-event',
    externalId: 'sample-event',
    summaryKo: '요약',
    summaryEn: 'Summary',
    eventType: 'missile',
    riskLevel: 'critical',
    verificationStatus: 'verified',
    countryCode: 'IR',
    regionName: 'Strait of Hormuz',
    latitude: 26.566,
    longitude: 56.249,
    occurredAt: '2026-04-07T09:00:00.000Z',
    impacts: [
      {
        assetCode: 'WTI',
        assetName: 'Oil',
        direction: 'up',
        confidence: 0.84,
        moveHint: '+2.2%',
        rationale: 'impact rationale',
      },
    ],
    rawPayload: { traceId: 'sample-trace' },
    ...overrides,
  };
}

Deno.test('normalizeArticle infers Hormuz region, critical risk, and energy impacts', () => {
  const event = normalizeArticle({
    title: 'Reuters: Missile alert raises tanker risk near Strait of Hormuz',
    summary:
      'Shipping insurers warned that repeated missile alerts near the Strait of Hormuz could disrupt crude flows and lift safe-haven demand across global markets.',
    source: 'Reuters',
    url: 'https://example.com/hormuz-alert',
    publishedAt: '2026-04-07T09:00:00.000Z',
  });

  assertEquals(event?.eventType, 'missile');
  assertEquals(event?.riskLevel, 'critical');
  assertEquals(event?.verificationStatus, 'verified');
  assertEquals(event?.countryCode, 'IR');
  assertEquals(event?.regionName, 'Strait of Hormuz');
  assertEquals(
    event?.impacts.map((impact) => impact.assetCode),
    ['WTI', 'XAU'],
  );
});

Deno.test('normalizeArticle infers Red Sea logistics impacts from drone article', () => {
  const event = normalizeArticle({
    title: 'Drone threat forces carriers to reroute vessels in the Red Sea',
    summary:
      'Major shipping companies said they are reviewing routes after another drone-related threat near the Bab el-Mandeb chokepoint.',
    source: 'Regional Wire',
    url: 'https://example.com/red-sea-drone',
    publishedAt: '2026-04-07T10:00:00.000Z',
  });

  assertEquals(event?.eventType, 'drone');
  assertEquals(event?.riskLevel, 'high');
  assertEquals(event?.verificationStatus, 'pending');
  assertEquals(event?.countryCode, 'YE');
  assertEquals(
    event?.impacts.map((impact) => impact.assetCode),
    ['BDI', 'SOX'],
  );
});

Deno.test('normalizeArticle drops malformed payloads', () => {
  const event = normalizeArticle({
    title: '',
    summary: 'summary only',
    source: 'Reuters',
    url: 'https://example.com/invalid',
    publishedAt: '2026-04-07T10:00:00.000Z',
  });

  assertEquals(event, null);
});

Deno.test('persistNormalizedEvents upserts events and rewrites asset impacts for resolved ids', async () => {
  const calls: string[] = [];
  let upsertedRows: RiskEventUpsertRow[] = [];
  let deletedRiskEventIds: string[] = [];
  let insertedImpactRows: AssetImpactInsertRow[] = [];

  const client: PersistenceClient = {
    async upsertRiskEvents(rows) {
      calls.push('upsertRiskEvents');
      upsertedRows = rows;
      return { error: null };
    },
    async fetchPersistedRiskEvents(filters) {
      calls.push('fetchPersistedRiskEvents');
      assertEquals(filters, {
        sources: ['Reuters', 'Regional Wire'],
        externalIds: ['https://example.com/hormuz-alert', 'regional-wire-1'],
      });
      return {
        data: [
          { id: 'risk-1', source: 'Reuters', external_id: 'https://example.com/hormuz-alert' },
          { id: 'risk-2', source: 'Regional Wire', external_id: 'regional-wire-1' },
        ],
        error: null,
      };
    },
    async deleteAssetImpacts(riskEventIds) {
      calls.push('deleteAssetImpacts');
      deletedRiskEventIds = riskEventIds;
      return { error: null };
    },
    async insertAssetImpacts(rows) {
      calls.push('insertAssetImpacts');
      insertedImpactRows = rows;
      return { error: null };
    },
  };

  const result = await persistNormalizedEvents(
    [
      createNormalizedEvent({
        sourceUrl: 'https://example.com/hormuz-alert',
        externalId: undefined,
        impacts: [
          {
            assetCode: 'WTI',
            assetName: 'Oil',
            direction: 'up',
            confidence: 0.84,
            moveHint: '+2.2%',
            rationale: 'oil impact',
          },
          {
            assetCode: 'XAU',
            assetName: 'Gold',
            direction: 'up',
            confidence: 0.76,
            moveHint: '+1.0%',
            rationale: 'gold impact',
          },
        ],
      }),
      createNormalizedEvent({
        source: 'Regional Wire',
        sourceUrl: 'https://example.com/red-sea-drone',
        externalId: 'regional-wire-1',
        eventType: 'drone',
        riskLevel: 'high',
        verificationStatus: 'pending',
        countryCode: 'YE',
        regionName: 'Red Sea',
        latitude: 15.103,
        longitude: 42.571,
        impacts: [
          {
            assetCode: 'BDI',
            assetName: 'Freight',
            direction: 'up',
            confidence: 0.74,
            moveHint: '+1.7%',
            rationale: 'freight impact',
          },
        ],
      }),
    ],
    client,
  );

  assertEquals(result, {
    persistedCount: 2,
    note: '정규화 결과를 Supabase risk_events / asset_impacts에 저장했습니다.',
  });
  assertEquals(calls, [
    'upsertRiskEvents',
    'fetchPersistedRiskEvents',
    'deleteAssetImpacts',
    'insertAssetImpacts',
  ]);
  assertEquals(
    upsertedRows.map((row) => row.external_id),
    ['https://example.com/hormuz-alert', 'regional-wire-1'],
  );
  assertEquals(deletedRiskEventIds, ['risk-1', 'risk-2']);
  assertEquals(insertedImpactRows.map((row) => row.risk_event_id), ['risk-1', 'risk-1', 'risk-2']);
  assertEquals(insertedImpactRows.map((row) => row.asset_code), ['WTI', 'XAU', 'BDI']);
});

Deno.test('persistNormalizedEvents skips impact rewrite when no persisted ids are resolved', async () => {
  const calls: string[] = [];

  const client: PersistenceClient = {
    async upsertRiskEvents() {
      calls.push('upsertRiskEvents');
      return { error: null };
    },
    async fetchPersistedRiskEvents() {
      calls.push('fetchPersistedRiskEvents');
      return { data: [], error: null };
    },
    async deleteAssetImpacts() {
      calls.push('deleteAssetImpacts');
      return { error: null };
    },
    async insertAssetImpacts() {
      calls.push('insertAssetImpacts');
      return { error: null };
    },
  };

  const result = await persistNormalizedEvents([createNormalizedEvent()], client);

  assertEquals(result, {
    persistedCount: 0,
    note: 'risk_events upsert 후 이벤트 식별에 실패했습니다.',
  });
  assertEquals(calls, ['upsertRiskEvents', 'fetchPersistedRiskEvents']);
});
