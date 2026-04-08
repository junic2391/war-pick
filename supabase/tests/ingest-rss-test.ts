import type { NormalizedRiskEvent } from '../functions/_shared/event-types.ts';
import {
  persistNormalizedEvents,
  type AssetImpactInsertRow,
  type PersistenceClient,
  type RiskEventUpsertRow,
} from '../functions/_shared/ingest-persistence.ts';
import {
  fetchArticlesFromRssSourceUrls,
  parseArticlesFromFeedXml,
  parseRssSourceUrls,
} from '../functions/_shared/rss-fetch.ts';

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
    titleKo: '샘플 이벤트',
    titleEn: 'Sample event',
    source: 'Reuters',
    sourceUrl: 'https://example.com/sample-event',
    externalId: 'sample-event',
    sourceLanguage: 'en',
    summaryKo: '요약',
    summaryEn: 'Summary',
    eventType: 'missile',
    eventDirection: 'escalation',
    riskLevel: 'critical',
    importanceScore: 9,
    confidenceScore: 0.82,
    verificationStatus: 'verified',
    marketSentiment: 'risk_off',
    timeHorizon: 'weeks',
    conflictStatus: 'active_conflict',
    storyKey: 'missile_strait_of_hormuz_iran',
    storySequence: 1,
    sourceCount: 1,
    countryCode: 'IR',
    regionName: 'Strait of Hormuz',
    latitude: 26.566,
    longitude: 56.249,
    occurredAt: '2026-04-07T09:00:00.000Z',
    actors: ['Iran'],
    targets: ['Tanker traffic'],
    affectedAssets: ['WTI', 'XAU'],
    macroChannels: ['oil', 'inflation'],
    facts: [{ claim: 'Missile alert near Strait of Hormuz', source: 'Reuters' }],
    numericFacts: [{ label: 'Oil move', value: 2.2, unit: '%', source: 'Reuters' }],
    inferences: ['AI 해석: 해협 긴장이 유가 리스크 프리미엄을 자극할 수 있습니다.'],
    contradictions: [],
    thesis: '호르무즈 해협 리스크는 원유와 안전자산에 직접 연결됩니다.',
    scenarioBase: '기본 시나리오',
    scenarioBull: '상방 시나리오',
    scenarioBear: '하방 시나리오',
    webEnriched: false,
    webEnrichmentStatus: 'not_needed',
    briefingLocalized: {
      ko: {
        fact: '핵심 사실',
        insight: '시장 해석',
      },
    },
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

Deno.test('parseRssSourceUrls keeps only valid unique HTTP urls', () => {
  const urls = parseRssSourceUrls([
    'https://example.com/rss.xml',
    ' http://feeds.example.com/world.xml ',
    'ftp://invalid.example.com/feed.xml',
    'not-a-url',
    'https://example.com/rss.xml',
  ].join('\n'));

  assertEquals(urls, [
    'https://example.com/rss.xml',
    'http://feeds.example.com/world.xml',
  ]);
});

Deno.test('parseArticlesFromFeedXml parses RSS feeds', () => {
  const xml = `<?xml version="1.0"?>
  <rss version="2.0">
    <channel>
      <title>Reuters World</title>
      <item>
        <title>Missile alert raises tanker risk</title>
        <description><![CDATA[Shipping insurers warn &amp; traders react.]]></description>
        <link>/world/hormuz-alert</link>
        <source>Reuters</source>
        <pubDate>Tue, 07 Apr 2026 09:00:00 GMT</pubDate>
      </item>
    </channel>
  </rss>`;

  const articles = parseArticlesFromFeedXml(xml, 'https://example.com/rss.xml');

  assertEquals(articles.length, 1);
  assertEquals(articles[0]?.title, 'Missile alert raises tanker risk');
  assertEquals(articles[0]?.summary, 'Shipping insurers warn & traders react.');
  assertEquals(articles[0]?.source, 'Reuters');
  assertEquals(articles[0]?.url, 'https://example.com/world/hormuz-alert');
  assertEquals(articles[0]?.publishedAt, '2026-04-07T09:00:00.000Z');
});

Deno.test('parseArticlesFromFeedXml parses Atom feeds', () => {
  const xml = `<?xml version="1.0"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <title>AP News</title>
    <entry>
      <title>Sanctions relief takes effect</title>
      <summary>Diplomatic breakthrough opens the door to waivers.</summary>
      <link href="/news/sanctions-relief" />
      <updated>2026-04-07T10:00:00Z</updated>
    </entry>
  </feed>`;

  const articles = parseArticlesFromFeedXml(xml, 'https://apnews.example.com/atom.xml');

  assertEquals(articles.length, 1);
  assertEquals(articles[0]?.source, 'AP News');
  assertEquals(articles[0]?.url, 'https://apnews.example.com/news/sanctions-relief');
  assertEquals(articles[0]?.publishedAt, '2026-04-07T10:00:00.000Z');
});

Deno.test('fetchArticlesFromRssSourceUrls dedupes duplicate articles across feeds', async () => {
  const rssOne = `<?xml version="1.0"?>
  <rss version="2.0">
    <channel>
      <title>Feed One</title>
      <item>
        <title>Shared article</title>
        <description>First feed copy.</description>
        <link>https://example.com/shared-article</link>
        <pubDate>Tue, 07 Apr 2026 09:00:00 GMT</pubDate>
      </item>
    </channel>
  </rss>`;
  const rssTwo = `<?xml version="1.0"?>
  <rss version="2.0">
    <channel>
      <title>Feed Two</title>
      <item>
        <title>Shared article</title>
        <description>Second feed copy.</description>
        <link>https://example.com/shared-article</link>
        <pubDate>Tue, 07 Apr 2026 09:05:00 GMT</pubDate>
      </item>
      <item>
        <title>Unique article</title>
        <description>Another event.</description>
        <link>https://example.com/unique-article</link>
        <pubDate>Tue, 07 Apr 2026 10:00:00 GMT</pubDate>
      </item>
    </channel>
  </rss>`;

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    const xml = url.includes('feed-one') ? rssOne : rssTwo;
    return new Response(xml, {
      status: 200,
      headers: { 'content-type': 'application/rss+xml' },
    });
  };

  const articles = await fetchArticlesFromRssSourceUrls([
    'https://example.com/feed-one.xml',
    'https://example.com/feed-two.xml',
  ], fetchImpl);

  assertEquals(articles.length, 2);
  assertEquals(
    articles.map((article) => article.url),
    ['https://example.com/shared-article', 'https://example.com/unique-article'],
  );
});

Deno.test('persistNormalizedEvents writes importance_score and asset impacts', async () => {
  const upsertedRows: RiskEventUpsertRow[] = [];
  const deletedRiskEventIds: string[][] = [];
  const insertedImpactRows: AssetImpactInsertRow[] = [];

  const client: PersistenceClient = {
    async upsertRiskEvents(rows) {
      upsertedRows.push(...rows);
      return { error: null };
    },
    async fetchPersistedRiskEvents() {
      return {
        data: [{ id: 'risk-event-1', source: 'Reuters', external_id: 'sample-event' }],
        error: null,
      };
    },
    async deleteAssetImpacts(riskEventIds) {
      deletedRiskEventIds.push(riskEventIds);
      return { error: null };
    },
    async insertAssetImpacts(rows) {
      insertedImpactRows.push(...rows);
      return { error: null };
    },
  };

  const result = await persistNormalizedEvents([createNormalizedEvent()], client);

  assertEquals(result.persistedCount, 1);
  assertEquals(upsertedRows.length, 1);
  assertEquals(upsertedRows[0]?.importance_score, 9);
  assertEquals(upsertedRows[0]?.event_type, 'missile');
  assertEquals(upsertedRows[0]?.event_direction, 'escalation');
  assertEquals(upsertedRows[0]?.story_key, 'missile_strait_of_hormuz_iran');
  assertEquals(upsertedRows[0]?.title_ko, '샘플 이벤트');
  assertEquals(upsertedRows[0]?.title_en, 'Sample event');
  assertEquals(upsertedRows[0]?.source_language, 'en');
  assertEquals(upsertedRows[0]?.briefing_localized_json, {
    ko: {
      fact: '핵심 사실',
      insight: '시장 해석',
    },
  });
  assertEquals(deletedRiskEventIds, [['risk-event-1']]);
  assertEquals(insertedImpactRows.length, 1);
  assertEquals(insertedImpactRows[0]?.risk_event_id, 'risk-event-1');
  assertEquals(insertedImpactRows[0]?.asset_code, 'WTI');
});

Deno.test('persistNormalizedEvents returns a note when upserted ids cannot be resolved', async () => {
  const client: PersistenceClient = {
    async upsertRiskEvents() {
      return { error: null };
    },
    async fetchPersistedRiskEvents() {
      return { data: [], error: null };
    },
    async deleteAssetImpacts() {
      throw new Error('deleteAssetImpacts should not be called');
    },
    async insertAssetImpacts() {
      throw new Error('insertAssetImpacts should not be called');
    },
  };

  const result = await persistNormalizedEvents([createNormalizedEvent()], client);

  assertEquals(result.persistedCount, 0);
  assert(
    result.note.includes('이벤트 식별에 실패했습니다'),
    'expected unresolved note when no persisted ids are returned',
  );
});
