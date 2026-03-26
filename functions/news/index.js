const PRIMARY_HOST = 'https://news.shenxw.cn';
const FALLBACK_HOST = 'https://60s.viki.moe';
const HOSTS = [PRIMARY_HOST, FALLBACK_HOST];

const NEWS_SOURCES = {
  weibo: { id: 'weibo', label: '微博热搜', endpoint: '/v2/weibo' },
  zhihu: { id: 'zhihu', label: '知乎话题', endpoint: '/v2/zhihu' },
  toutiao: { id: 'toutiao', label: '头条热搜', endpoint: '/v2/toutiao' },
  'baidu-hot': { id: 'baidu-hot', label: '百度热搜', endpoint: '/v2/baidu/hot' },
  'it-news': { id: 'it-news', label: 'IT 资讯', endpoint: '/v2/it-news' },
  'hacker-news-top': {
    id: 'hacker-news-top',
    label: 'Hacker News',
    endpoint: '/v2/hacker-news/top',
  },
};

const AUTO_SOURCE_ORDER = [
  'weibo',
  'zhihu',
  'toutiao',
  'baidu-hot',
  'it-news',
  'hacker-news-top',
];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeSource(value) {
  if (typeof value !== 'string' || !value.trim() || value === 'auto') {
    return 'auto';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'baidu') {
    return 'baidu-hot';
  }

  if (normalized === 'hacker-news') {
    return 'hacker-news-top';
  }

  return Object.prototype.hasOwnProperty.call(NEWS_SOURCES, normalized)
    ? normalized
    : 'auto';
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 10;
  }

  return Math.max(5, Math.min(30, Math.round(parsed)));
}

function normalizeHotValue(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }

  if (typeof item.hot_value_desc === 'string' && item.hot_value_desc.trim()) {
    return item.hot_value_desc.trim();
  }

  if (typeof item.score_desc === 'string' && item.score_desc.trim()) {
    return item.score_desc.trim();
  }

  if (Number.isFinite(Number(item.hot_value))) {
    return `${Number(item.hot_value).toLocaleString()} 热度`;
  }

  if (Number.isFinite(Number(item.score))) {
    return `${Number(item.score).toLocaleString()} 分`;
  }

  return '';
}

function normalizePublishedAt(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }

  if (typeof item.created === 'string' && item.created.trim()) {
    return item.created;
  }

  if (typeof item.date === 'string' && item.date.trim()) {
    return item.date;
  }

  if (Number.isFinite(Number(item.created_at))) {
    return new Date(Number(item.created_at)).toISOString();
  }

  return '';
}

function normalizeNewsItems(source, rawItems, limit) {
  const normalized = rawItems
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const title = asString(item.title).trim();
      const link = asString(item.link).trim() || asString(item.url).trim();
      const summary =
        asString(item.description).trim() ||
        asString(item.detail).trim() ||
        asString(item.desc).trim();
      const cover = asString(item.cover).trim();
      const hot = normalizeHotValue(item);
      const publishedAt = normalizePublishedAt(item);

      if (!title) {
        return null;
      }

      const author = asString(item.author).trim();
      return {
        title,
        link,
        summary: summary || (author ? `作者：${author}` : ''),
        cover,
        hot,
        publishedAt,
        sourceId: source.id,
        sourceLabel: source.label,
      };
    })
    .filter(Boolean);

  return normalized.slice(0, limit);
}

async function fetchFromSourceHost(source, host, limit) {
  const requestUrl = new URL(source.endpoint, host);
  requestUrl.searchParams.set('encoding', 'json');
  requestUrl.searchParams.set('limit', String(limit));

  const response = await fetch(requestUrl.toString(), {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== 'object') {
    throw new Error('上游返回格式异常');
  }

  const rawItems = Array.isArray(payload.data)
    ? payload.data
    : payload.data && Array.isArray(payload.data.news)
      ? payload.data.news
      : [];

  return normalizeNewsItems(source, rawItems, limit);
}

async function resolveFromHosts(sourceId, limit) {
  const source = NEWS_SOURCES[sourceId];
  const errors = [];

  for (const host of HOSTS) {
    try {
      const items = await fetchFromSourceHost(source, host, limit);
      return {
        ok: true,
        source,
        host,
        items,
        errors,
      };
    } catch (error) {
      errors.push(`${host}: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  return {
    ok: false,
    source,
    host: '',
    items: [],
    errors,
  };
}

function successPayload({ mode, source, host, items, warnings }) {
  return {
    mode,
    activeSourceId: source.id,
    activeSourceLabel: source.label,
    host,
    items,
    warnings,
  };
}

async function resolveManualSource(sourceId, limit) {
  const result = await resolveFromHosts(sourceId, limit);
  if (!result.ok) {
    throw new Error(`来源 ${result.source.label} 请求失败：${result.errors.join(' | ')}`);
  }

  return successPayload({
    mode: 'manual',
    source: result.source,
    host: result.host,
    items: result.items,
    warnings: result.items.length === 0 ? [`来源 ${result.source.label} 暂无数据`] : [],
  });
}

async function resolveAutoSource(limit) {
  const aggregatedErrors = [];
  let firstEmpty = null;

  for (const sourceId of AUTO_SOURCE_ORDER) {
    const result = await resolveFromHosts(sourceId, limit);

    if (result.ok && result.items.length > 0) {
      return successPayload({
        mode: 'auto',
        source: result.source,
        host: result.host,
        items: result.items,
        warnings: [],
      });
    }

    if (result.ok && !firstEmpty) {
      firstEmpty = result;
    }

    aggregatedErrors.push(...result.errors);
  }

  if (firstEmpty) {
    return successPayload({
      mode: 'auto',
      source: firstEmpty.source,
      host: firstEmpty.host,
      items: firstEmpty.items,
      warnings: ['当前来源暂未返回可展示数据，建议稍后刷新'],
    });
  }

  throw new Error(
    aggregatedErrors.length > 0
      ? `所有来源均不可用：${aggregatedErrors.join(' | ')}`
      : '所有来源均不可用'
  );
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const source = normalizeSource(url.searchParams.get('source'));
    const limit = normalizeLimit(url.searchParams.get('limit'));

    if (source === 'auto') {
      return jsonResponse(await resolveAutoSource(limit));
    }

    return jsonResponse(await resolveManualSource(source, limit));
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : '未知错误' },
      502
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return onRequestOptions();
  }

  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
