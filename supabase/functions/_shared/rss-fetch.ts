import type { RawArticle } from './event-types.ts';

const rssAcceptHeader = [
  'application/rss+xml',
  'application/atom+xml',
  'application/xml;q=0.9',
  'text/xml;q=0.8',
  '*/*;q=0.1',
].join(', ');

export function parseRssSourceUrls(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  const urls = value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      try {
        const url = new URL(item);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    });

  return [...new Set(urls)];
}

export function parseArticlesFromFeedXml(xml: string, feedUrl: string): RawArticle[] {
  if (/<channel\b/i.test(xml)) {
    return parseRssFeed(xml, feedUrl);
  }

  if (/<feed\b/i.test(xml) && /<entry\b/i.test(xml)) {
    return parseAtomFeed(xml, feedUrl);
  }

  throw new Error(`Unsupported feed format: ${feedUrl}`);
}

export async function fetchArticlesFromRssSourceUrls(
  sourceUrls: string[],
  fetchImpl: typeof fetch = fetch,
) {
  const dedupedArticles: RawArticle[] = [];
  const seenArticleKeys = new Set<string>();

  for (const sourceUrl of sourceUrls) {
    const response = await fetchImpl(sourceUrl, {
      headers: {
        Accept: rssAcceptHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`RSS fetch failed for ${sourceUrl}: HTTP ${response.status}`);
    }

    const xml = await response.text();
    const articles = parseArticlesFromFeedXml(xml, sourceUrl);

    articles.forEach((article) => {
      const articleKey = article.url.trim().toLowerCase() || article.title.trim().toLowerCase();

      if (!articleKey || seenArticleKeys.has(articleKey)) {
        return;
      }

      seenArticleKeys.add(articleKey);
      dedupedArticles.push(article);
    });
  }

  return dedupedArticles;
}

function parseRssFeed(xml: string, feedUrl: string) {
  const channelMatch = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i);
  const channelXml = channelMatch?.[1] ?? xml;
  const feedSource = sanitizeText(extractTagText(channelXml, ['title'])) ?? getFeedHostname(feedUrl);

  return extractBlocks(channelXml, 'item').map((itemXml) => {
    const linkText = extractTagText(itemXml, ['link']);
    const sourceUrl = resolveFeedUrl(linkText, feedUrl);

    return {
      title: sanitizeText(extractTagText(itemXml, ['title'])) ?? '',
      summary: sanitizeSummary(
        extractTagText(itemXml, ['description']) ??
          extractTagText(itemXml, ['content:encoded', 'encoded']) ??
          undefined,
      ),
      source: sanitizeText(extractTagText(itemXml, ['source'])) ?? feedSource,
      url: sourceUrl ?? '',
      publishedAt: normalizePublishedAt(
        extractTagText(itemXml, ['pubDate', 'published', 'updated', 'dc:date', 'date']),
      ),
    };
  });
}

function parseAtomFeed(xml: string, feedUrl: string) {
  const feedMatch = xml.match(/<feed\b[^>]*>([\s\S]*?)<\/feed>/i);
  const feedXml = feedMatch?.[1] ?? xml;
  const feedSource = sanitizeText(extractTagText(feedXml, ['title'])) ?? getFeedHostname(feedUrl);

  return extractBlocks(feedXml, 'entry').map((entryXml) => {
    const sourceUrl = resolveFeedUrl(extractAtomLinkHref(entryXml), feedUrl);

    return {
      title: sanitizeText(extractTagText(entryXml, ['title'])) ?? '',
      summary: sanitizeSummary(
        extractTagText(entryXml, ['summary']) ??
          extractTagText(entryXml, ['content']) ??
          undefined,
      ),
      source: feedSource,
      url: sourceUrl ?? '',
      publishedAt: normalizePublishedAt(
        extractTagText(entryXml, ['published', 'updated']),
      ),
    };
  });
}

function extractBlocks(xml: string, tagName: string) {
  const pattern = new RegExp(`<${escapeRegex(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`, 'gi');
  const blocks: string[] = [];

  for (const match of xml.matchAll(pattern)) {
    blocks.push(match[1]);
  }

  return blocks;
}

function extractTagText(xml: string, tagNames: string[]) {
  for (const tagName of tagNames) {
    const pattern = new RegExp(
      `<${escapeRegex(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`,
      'i',
    );
    const match = xml.match(pattern);

    if (match) {
      return stripCdata(match[1]);
    }
  }

  return null;
}

function extractAtomLinkHref(xml: string) {
  const linkPattern = /<link\b([^>]*)\/?>/gi;

  for (const match of xml.matchAll(linkPattern)) {
    const attributes = match[1] ?? '';
    const rel = extractAttribute(attributes, 'rel');

    if (rel && rel !== 'alternate') {
      continue;
    }

    const href = extractAttribute(attributes, 'href');

    if (href) {
      return href;
    }
  }

  return null;
}

function extractAttribute(attributes: string, attributeName: string) {
  const pattern = new RegExp(`${escapeRegex(attributeName)}\\s*=\\s*["']([^"']+)["']`, 'i');
  return attributes.match(pattern)?.[1] ?? null;
}

function normalizePublishedAt(value: string | null | undefined) {
  const trimmedValue = sanitizeText(value);

  if (!trimmedValue) {
    return '';
  }

  const parsed = Date.parse(trimmedValue);

  if (Number.isNaN(parsed)) {
    return trimmedValue;
  }

  return new Date(parsed).toISOString();
}

function sanitizeSummary(value: string | undefined) {
  const sanitized = sanitizeText(value);
  return sanitized || undefined;
}

function sanitizeText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const withoutTags = value.replace(/<[^>]+>/g, ' ');
  const decoded = decodeHtmlEntities(withoutTags);
  const normalized = decoded.replace(/\s+/g, ' ').trim();

  return normalized || null;
}

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, '$1');
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function resolveFeedUrl(value: string | null | undefined, feedUrl: string) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    return new URL(trimmedValue, feedUrl).toString();
  } catch {
    return null;
  }
}

function getFeedHostname(feedUrl: string) {
  try {
    return new URL(feedUrl).hostname;
  } catch {
    return 'Unknown feed';
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
