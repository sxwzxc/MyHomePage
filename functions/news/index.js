const PRIMARY_HOST = 'https://news.shenxw.cn';
const FALLBACK_HOST = 'https://60s.viki.moe';
const HOSTS = [PRIMARY_HOST, FALLBACK_HOST];

const NEWS_CACHE_KEY = 'homepage:news:cache:v2';
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_FETCH_LIMIT = 30;

const NEWS_SOURCES = {
  s60: { id: 's60', label: '60s 读懂世界', endpoint: '/v2/60s' },
  toutiao: { id: 'toutiao', label: '头条热搜', endpoint: '/v2/toutiao' },
  weibo: { id: 'weibo', label: '微博热搜', endpoint: '/v2/weibo' },
  zhihu: { id: 'zhihu', label: '知乎热榜', endpoint: '/v2/zhihu' },
  quark: { id: 'quark', label: '夸克热搜', endpoint: '/v2/quark' },
  'baidu-hot': { id: 'baidu-hot', label: '百度热搜', endpoint: '/v2/baidu/hot' },
  bili: { id: 'bili', label: 'B 站热榜', endpoint: '/v2/bili' },
  douyin: { id: 'douyin', label: '抖音热榜', endpoint: '/v2/douyin' },
  rednote: { id: 'rednote', label: '小红书热榜', endpoint: '/v2/rednote' },
  'douban-weekly-movie': {
    id: 'douban-weekly-movie',
    label: '豆瓣电影周榜',
    endpoint: '/v2/douban/weekly/movie',
  },
  dongchedi: { id: 'dongchedi', label: '懂车帝热榜', endpoint: '/v2/dongchedi' },
};

const AUTO_SOURCE_ORDER = [
  's60',
  'toutiao',
  'weibo',
  'zhihu',
  'quark',
  'baidu-hot',
  'bili',
  'douyin',
  'rednote',
  'douban-weekly-movie',
  'dongchedi',
];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asIsoString(value, fallback = '') {
  const text = asString(value, fallback).trim();
  if (!text) {
    return fallback;
  }

  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function getKvBinding(env) {
  if (env && env.myhomepage) {
    return env.myhomepage;
  }

  if (typeof myhomepage !== 'undefined') {
    return myhomepage;
  }

  if (env && env.my_kv) {
    return env.my_kv;
  }

  if (typeof my_kv !== 'undefined') {
    return my_kv;
  }

  if (globalThis && globalThis.myhomepage) {
    return globalThis.myhomepage;
  }

  if (globalThis && globalThis.my_kv) {
    return globalThis.my_kv;
  }

  return null;
}

function normalizeSource(value) {
  if (typeof value !== 'string' || !value.trim() || value === 'auto') {
    return 'auto';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '60s') {
    return 's60';
  }

  if (normalized === 'baidu') {
    return 'baidu-hot';
  }

  if (normalized === 'douban') {
    return 'douban-weekly-movie';
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

  if (typeof item.hot === 'string' && item.hot.trim()) {
    return item.hot.trim();
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

  if (typeof item.publishedAt === 'string' && item.publishedAt.trim()) {
    return item.publishedAt;
  }

  if (Number.isFinite(Number(item.created_at))) {
    return new Date(Number(item.created_at)).toISOString();
  }

  return '';
}

function normalizeNewsItems(source, rawItems, limit) {
  const normalized = (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const title = asString(item.title).trim();
      const link = asString(item.link).trim() || asString(item.url).trim();
      const summary =
        asString(item.description).trim() ||
        asString(item.detail).trim() ||
        asString(item.desc).trim() ||
        asString(item.summary).trim();
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

function normalizeCachedSource(sourceId, sourcePayload) {
  const source = NEWS_SOURCES[sourceId];
  if (!source) {
    return null;
  }

  const payload = sourcePayload && typeof sourcePayload === 'object' ? sourcePayload : {};
  return {
    sourceId,
    sourceLabel: asString(payload.sourceLabel, source.label) || source.label,
    host: asString(payload.host),
    items: normalizeNewsItems(source, payload.items, CACHE_FETCH_LIMIT),
  };
}

function normalizeCacheBundle(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const sourceRecord =
    payload.sources && typeof payload.sources === 'object' ? payload.sources : {};

  const sources = {};
  for (const sourceId of AUTO_SOURCE_ORDER) {
    const normalized = normalizeCachedSource(sourceId, sourceRecord[sourceId]);
    if (normalized) {
      sources[sourceId] = normalized;
    }
  }

  const updatedAt = asIsoString(payload.updatedAt);
  const expiresAt = asIsoString(payload.expiresAt);

  if (!updatedAt || !expiresAt) {
    return null;
  }

  return {
    version: Number.isFinite(Number(payload.version)) ? Number(payload.version) : 1,
    updatedAt,
    expiresAt,
    sources,
  };
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

async function fetchSourceFromHosts(sourceId, limit) {
  const source = NEWS_SOURCES[sourceId];
  const errors = [];

  for (const host of HOSTS) {
    try {
      const items = await fetchFromSourceHost(source, host, limit);
      return {
        ok: true,
        source,
        sourceId,
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
    sourceId,
    host: '',
    items: [],
    errors,
  };
}

async function fetchAllSources(limit = CACHE_FETCH_LIMIT) {
  const settled = await Promise.all(
    AUTO_SOURCE_ORDER.map((sourceId) => fetchSourceFromHosts(sourceId, limit))
  );

  const sources = {};
  const warnings = [];

  for (const item of settled) {
    sources[item.sourceId] = {
      sourceId: item.source.id,
      sourceLabel: item.source.label,
      host: item.host,
      items: item.items,
    };

    if (!item.ok) {
      warnings.push(`来源 ${item.source.label} 请求失败`);
      continue;
    }

    if (item.items.length === 0) {
      warnings.push(`来源 ${item.source.label} 暂无可展示内容`);
    }
  }

  const hasAnyData = AUTO_SOURCE_ORDER.some(
    (sourceId) => (sources[sourceId]?.items || []).length > 0
  );

  if (!hasAnyData) {
    throw new Error('所有来源均不可用');
  }

  const now = Date.now();
  return {
    version: 1,
    updatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CACHE_TTL_MS).toISOString(),
    sources,
    warnings,
  };
}

async function readNewsCache(kv) {
  if (!kv) {
    return null;
  }

  try {
    const raw = await kv.get(NEWS_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return normalizeCacheBundle(parsed);
  } catch {
    return null;
  }
}

function isCacheExpired(bundle) {
  if (!bundle) {
    return true;
  }

  const expires = Date.parse(bundle.expiresAt);
  if (!Number.isFinite(expires)) {
    return true;
  }

  return Date.now() >= expires;
}

async function refreshNewsCache(kv) {
  const fresh = await fetchAllSources(CACHE_FETCH_LIMIT);

  if (kv) {
    await kv.put(NEWS_CACHE_KEY, JSON.stringify(fresh));
  }

  return fresh;
}

function selectActiveSource(bundle, mode, sourceId) {
  if (mode === 'manual') {
    return bundle.sources[sourceId] || bundle.sources[AUTO_SOURCE_ORDER[0]];
  }

  for (const candidateId of AUTO_SOURCE_ORDER) {
    const candidate = bundle.sources[candidateId];
    if (candidate && candidate.items.length > 0) {
      return candidate;
    }
  }

  return bundle.sources[AUTO_SOURCE_ORDER[0]];
}

function toResponseSources(bundle, limit) {
  return AUTO_SOURCE_ORDER.map((sourceId) => {
    const source = bundle.sources[sourceId] || {
      sourceId,
      sourceLabel: NEWS_SOURCES[sourceId]?.label || sourceId,
      host: '',
      items: [],
    };

    return {
      sourceId: source.sourceId,
      sourceLabel: source.sourceLabel,
      host: source.host,
      items: (source.items || []).slice(0, limit),
    };
  });
}

function buildResponsePayload({
  mode,
  sourceId,
  limit,
  bundle,
  warnings = [],
  cacheFrom = 'kv',
  isStale = false,
}) {
  const sources = toResponseSources(bundle, limit);
  const sourceMap = Object.fromEntries(sources.map((source) => [source.sourceId, source]));
  const activeSource =
    selectActiveSource({ ...bundle, sources: sourceMap }, mode, sourceId) || sources[0];

  const nextWarnings = [...warnings];
  if (mode === 'manual' && activeSource && activeSource.items.length === 0) {
    nextWarnings.push(`来源 ${activeSource.sourceLabel} 暂无可展示数据`);
  }

  if (mode === 'auto' && activeSource && activeSource.items.length === 0) {
    nextWarnings.push('当前来源暂未返回可展示数据，建议稍后刷新');
  }

  return {
    mode,
    activeSourceId: activeSource?.sourceId || sourceId,
    activeSourceLabel:
      activeSource?.sourceLabel || NEWS_SOURCES[sourceId]?.label || '未知来源',
    host: activeSource?.host || '',
    items: activeSource?.items || [],
    sources,
    warnings: Array.from(new Set(nextWarnings)).filter(Boolean),
    cache: {
      from: cacheFrom,
      isStale,
      updatedAt: bundle.updatedAt,
      expiresAt: bundle.expiresAt,
      ttlMinutes: 30,
    },
  };
}

function scheduleBackgroundRefresh(context, promise) {
  if (!context || typeof context.waitUntil !== 'function') {
    return false;
  }

  context.waitUntil(
    promise.catch(() => {
      // Ignore background errors; stale cache response has already been returned.
    })
  );

  return true;
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const normalizedSource = normalizeSource(url.searchParams.get('source'));
    const mode = normalizedSource === 'auto' ? 'auto' : 'manual';
    const sourceId = mode === 'manual' ? normalizedSource : AUTO_SOURCE_ORDER[0];
    const limit = normalizeLimit(url.searchParams.get('limit'));
    const forceRefresh = ['1', 'true', 'yes'].includes(
      asString(url.searchParams.get('refresh')).toLowerCase()
    );

    const kv = getKvBinding(env);

    if (!kv) {
      const fresh = await fetchAllSources(CACHE_FETCH_LIMIT);
      return jsonResponse(
        buildResponsePayload({
          mode,
          sourceId,
          limit,
          bundle: fresh,
          warnings: fresh.warnings,
          cacheFrom: 'origin',
          isStale: false,
        })
      );
    }

    const cacheBundle = await readNewsCache(kv);
    const hasCache = Boolean(cacheBundle);
    const cacheExpired = isCacheExpired(cacheBundle);

    if (forceRefresh || !hasCache) {
      try {
        const fresh = await refreshNewsCache(kv);
        return jsonResponse(
          buildResponsePayload({
            mode,
            sourceId,
            limit,
            bundle: fresh,
            warnings: fresh.warnings,
            cacheFrom: 'origin',
            isStale: false,
          })
        );
      } catch (error) {
        if (hasCache) {
          return jsonResponse(
            buildResponsePayload({
              mode,
              sourceId,
              limit,
              bundle: cacheBundle,
              warnings: [
                '刷新缓存失败，已返回最近一次缓存数据',
                error instanceof Error ? error.message : '未知错误',
              ],
              cacheFrom: 'kv',
              isStale: true,
            })
          );
        }

        throw error;
      }
    }

    if (!cacheExpired) {
      return jsonResponse(
        buildResponsePayload({
          mode,
          sourceId,
          limit,
          bundle: cacheBundle,
          cacheFrom: 'kv',
          isStale: false,
        })
      );
    }

    const refreshPromise = refreshNewsCache(kv);
    const backgroundScheduled = scheduleBackgroundRefresh(context, refreshPromise);

    if (!backgroundScheduled) {
      try {
        const fresh = await refreshPromise;
        return jsonResponse(
          buildResponsePayload({
            mode,
            sourceId,
            limit,
            bundle: fresh,
            warnings: fresh.warnings,
            cacheFrom: 'origin',
            isStale: false,
          })
        );
      } catch (error) {
        return jsonResponse(
          buildResponsePayload({
            mode,
            sourceId,
            limit,
            bundle: cacheBundle,
            warnings: [
              '缓存已过期，后台刷新失败，已返回旧缓存',
              error instanceof Error ? error.message : '未知错误',
            ],
            cacheFrom: 'kv',
            isStale: true,
          })
        );
      }
    }

    return jsonResponse(
      buildResponsePayload({
        mode,
        sourceId,
        limit,
        bundle: cacheBundle,
        warnings: ['缓存已过期，后台正在刷新，几秒后将自动同步新内容'],
        cacheFrom: 'kv',
        isStale: true,
      })
    );
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
