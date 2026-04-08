import type { NormalizedRiskEvent } from './event-types.ts';

export type RegionProfile = {
  countryCode: string;
  regionName: string;
  latitude: number;
  longitude: number;
  priority: number;
  impacts: NormalizedRiskEvent['impacts'];
  keywords: string[];
};

const regionProfiles: RegionProfile[] = [
  {
    countryCode: 'IR',
    regionName: 'Strait of Hormuz',
    latitude: 26.566,
    longitude: 56.249,
    priority: 100,
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
    countryCode: 'IR',
    regionName: 'Iran',
    latitude: 35.6892,
    longitude: 51.389,
    priority: 60,
    keywords: ['iran', 'iranian', 'tehran', 'isfahan', 'lamerd'],
    impacts: [
      {
        assetCode: 'WTI',
        assetName: 'Oil',
        direction: 'up',
        confidence: 0.79,
        moveHint: '+1.8%',
        rationale: '이란 관련 군사 긴장은 원유 공급 불안과 안전자산 선호를 동시에 자극할 수 있습니다.',
      },
      {
        assetCode: 'XAU',
        assetName: 'Gold',
        direction: 'up',
        confidence: 0.73,
        moveHint: '+0.9%',
        rationale: '이란 리스크 확대는 안전자산 선호를 강화해 금 가격 민감도를 높일 수 있습니다.',
      },
    ],
  },
  {
    countryCode: 'IQ',
    regionName: 'Iraq',
    latitude: 33.3152,
    longitude: 44.3661,
    priority: 60,
    keywords: ['iraq', 'baghdad', 'basra', 'mosul'],
    impacts: [
      {
        assetCode: 'WTI',
        assetName: 'Oil',
        direction: 'up',
        confidence: 0.71,
        moveHint: '+1.1%',
        rationale: '이라크 불안정성은 중동 공급 리스크 심리를 자극할 수 있습니다.',
      },
      {
        assetCode: 'XAU',
        assetName: 'Gold',
        direction: 'up',
        confidence: 0.64,
        moveHint: '+0.6%',
        rationale: '지역 분쟁 확대 우려는 안전자산 선호를 자극할 수 있습니다.',
      },
    ],
  },
  {
    countryCode: 'YE',
    regionName: 'Red Sea',
    latitude: 15.103,
    longitude: 42.571,
    priority: 95,
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
    priority: 70,
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
    priority: 70,
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
  {
    countryCode: 'TR',
    regionName: 'Turkey',
    latitude: 41.0082,
    longitude: 28.9784,
    priority: 80,
    keywords: ['turkey', 'istanbul', 'ankara', 'bosporus'],
    impacts: [
      {
        assetCode: 'XAU',
        assetName: 'Gold',
        direction: 'up',
        confidence: 0.62,
        moveHint: '+0.5%',
        rationale: '동지중해와 흑해 인접 지정학 긴장은 안전자산 선호를 자극할 수 있습니다.',
      },
      {
        assetCode: 'BDI',
        assetName: 'Freight',
        direction: 'up',
        confidence: 0.56,
        moveHint: '+0.4%',
        rationale: '터키 해협과 인접 지역 긴장은 물류 리스크 프리미엄을 높일 수 있습니다.',
      },
    ],
  },
];

export function getSupportedRegionKeys() {
  return regionProfiles.map((profile) => toRegionKey(profile.regionName));
}

export function getRegionProfileByKey(regionKey: string | undefined) {
  if (!regionKey) {
    return null;
  }

  return regionProfiles.find((profile) => toRegionKey(profile.regionName) === regionKey) ?? null;
}

export function findRegionProfile(searchText: string) {
  let bestProfile: RegionProfile | null = null;
  let bestPriority = -1;
  let bestMatchedKeywordCount = 0;
  let bestMatchedKeywordLength = 0;

  for (const profile of regionProfiles) {
    const matchedKeywords = collectMatchedKeywords(profile.keywords, searchText);

    if (matchedKeywords.length === 0) {
      continue;
    }

    const matchedKeywordLength = matchedKeywords.reduce((sum, keyword) => sum + keyword.length, 0);

    if (
      profile.priority > bestPriority ||
      (profile.priority === bestPriority && matchedKeywords.length > bestMatchedKeywordCount) ||
      (profile.priority === bestPriority &&
        matchedKeywords.length === bestMatchedKeywordCount &&
        matchedKeywordLength > bestMatchedKeywordLength)
    ) {
      bestProfile = profile;
      bestPriority = profile.priority;
      bestMatchedKeywordCount = matchedKeywords.length;
      bestMatchedKeywordLength = matchedKeywordLength;
    }
  }

  return bestProfile;
}

function collectMatchedKeywords(keywords: string[], searchText: string) {
  return keywords.filter((keyword) => keywordMatches(keyword, searchText));
}

function keywordMatches(keyword: string, searchText: string) {
  const escapedKeyword = escapeRegex(keyword.toLowerCase());
  return new RegExp(`\\b${escapedKeyword}\\b`, 'i').test(searchText);
}

function toRegionKey(regionName: string) {
  return regionName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
