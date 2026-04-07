export type MapLabelLocale = 'ko' | 'en';
export type MapStyleProvider = 'openfreemap' | 'maplibre-demo';

export type LocalizedMapStyleResult = {
  mapStyle: MapStyleSpec;
  provider: MapStyleProvider;
  providerLabel: string;
};

type MapStyleLayer = {
  id: string;
  type?: string;
  layout?: Record<string, unknown>;
};

type MapStyleSpec = {
  layers: MapStyleLayer[];
  [key: string]: unknown;
};

const DEMO_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const OPEN_FREE_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const localizedStyleCache = new Map<MapLabelLocale, Promise<LocalizedMapStyleResult>>();

function createLocalizedTextField(locale: MapLabelLocale) {
  if (locale === 'ko') {
    return [
      'coalesce',
      ['get', 'name:ko'],
      ['get', 'name_ko'],
      ['get', 'name:en'],
      ['get', 'name_en'],
      ['get', 'NAME'],
      ['get', 'name'],
      ['get', 'ABBREV'],
    ];
  }

  return [
    'coalesce',
    ['get', 'name:en'],
    ['get', 'name_en'],
    ['get', 'NAME'],
    ['get', 'name'],
    ['get', 'name:ko'],
    ['get', 'name_ko'],
    ['get', 'ABBREV'],
  ];
}

function shouldLocalizeLayer(layer: MapStyleLayer) {
  if (layer.type !== 'symbol' || !layer.layout || layer.layout['text-field'] === undefined) {
    return false;
  }

  const layerId = layer.id.toLowerCase();
  return /(label|name|place|poi|country|settlement|marine|water|road)/.test(layerId);
}

function localizeStyle(style: MapStyleSpec, locale: MapLabelLocale): MapStyleSpec {
  const textField = createLocalizedTextField(locale);

  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (!shouldLocalizeLayer(layer)) {
        return layer;
      }

      return {
        ...layer,
        layout: {
          ...layer.layout,
          'text-field': textField,
        },
      };
    }),
  };
}

async function fetchStyleJson(styleUrl: string): Promise<MapStyleSpec> {
  const response = await fetch(styleUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch map style: ${response.status}`);
  }

  return (await response.json()) as MapStyleSpec;
}

async function fetchBaseStyle(): Promise<{ provider: MapStyleProvider; providerLabel: string; style: MapStyleSpec }> {
  try {
    return {
      provider: 'openfreemap',
      providerLabel: 'OpenFreeMap Liberty',
      style: await fetchStyleJson(OPEN_FREE_MAP_STYLE_URL),
    };
  } catch {
    // Fall through to the public demo style when the free upstream style is unavailable.
  }

  return {
    provider: 'maplibre-demo',
    providerLabel: 'MapLibre Demo',
    style: await fetchStyleJson(DEMO_STYLE_URL),
  };
}

export function getLocalizedMapStyle(locale: MapLabelLocale): Promise<LocalizedMapStyleResult> {
  const cached = localizedStyleCache.get(locale);
  if (cached) {
    return cached;
  }

  const next = fetchBaseStyle()
    .then(({ provider, providerLabel, style }) => ({
      mapStyle: localizeStyle(style, locale),
      provider,
      providerLabel,
    }))
    .catch((error) => {
      localizedStyleCache.delete(locale);
      throw error;
    });
  localizedStyleCache.set(locale, next);
  return next;
}
