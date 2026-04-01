const CONFIG_KEY = 'homepage:config:v1';

const NEWS_SOURCE_IDS = new Set([
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
]);

const DEFAULT_CONFIG = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  pageTitle: 'HomePage',
  pageSubtitle: '简洁高效的个人起始页',
  browserTitle: 'HomePage',
  homepageConfigured: false,
  weatherLocationMode: 'manual',
  weatherCity: 'Shanghai',
  bookmarkLayoutMode: 'card',
  bookmarkColumns: 4,
  faviconAutoRefreshEnabled: true,
  faviconAutoRefreshMinutes: 60,
  faviconLastRefreshAt: new Date(0).toISOString(),
  defaultSearchEngineId: 'google',
  searchEngines: [
    {
      id: 'google',
      name: 'Google',
      template: 'https://www.google.com/search?q=%s',
    },
    {
      id: 'bing',
      name: 'Bing',
      template: 'https://www.bing.com/search?q=%s',
    },
    {
      id: 'baidu',
      name: '百度',
      template: 'https://www.baidu.com/s?wd=%s',
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      template: 'https://duckduckgo.com/?q=%s',
    },
  ],
  bookmarks: [
    { id: 'bookmark-baidu', title: '百度', url: 'https://www.baidu.com' },
    { id: 'bookmark-taobao', title: '淘宝', url: 'https://www.taobao.com' },
    { id: 'bookmark-jd', title: '京东', url: 'https://www.jd.com' },
    { id: 'bookmark-github', title: 'GitHub', url: 'https://github.com' },
    {
      id: 'bookmark-edgeone',
      title: 'EdgeOne Pages',
      url: 'https://edgeone.ai/pages',
    },
    { id: 'bookmark-bilibili', title: 'Bilibili', url: 'https://www.bilibili.com' },
    { id: 'bookmark-zhihu', title: '知乎', url: 'https://www.zhihu.com' },
  ],
  background: {
    type: 'animated-gradient',
    imageBlur: 5,
    imageOverlay: 50,
    gradientPreset: 'default',
  },
  news: {
    enabled: true,
    collapsed: false,
    sourceMode: 'auto',
    sourceId: 's60',
    enabledSourceIds: Array.from(NEWS_SOURCE_IDS),
    sourceOrder: Array.from(NEWS_SOURCE_IDS),
    autoSwitchSeconds: 15,
    limit: 10,
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
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

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeSearchEngines(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_CONFIG.searchEngines;
  }

  const engines = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const id = asString(item.id).trim();
      const name = asString(item.name).trim();
      const template = asString(item.template).trim();

      if (!id || !name || !template || !template.includes('%s')) {
        return null;
      }

      return { id, name, template };
    })
    .filter(Boolean);

  return engines.length > 0 ? engines : DEFAULT_CONFIG.searchEngines;
}

function normalizeBookmarks(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_CONFIG.bookmarks;
  }

  const bookmarks = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const id = asString(item.id).trim();
      const title = asString(item.title).trim();
      const url = asString(item.url).trim();
      const icon = asString(item.icon).trim();
      const hasCustomFlag = typeof item.isCustomIcon === 'boolean';
      const inferredCustom = Boolean(
        icon && !icon.startsWith('http') && !icon.startsWith('data:')
      );
      const isCustomIcon = hasCustomFlag
        ? Boolean(item.isCustomIcon)
        : inferredCustom;

      if (!id || !title || !url) {
        return null;
      }

      try {
        const normalizedUrl = new URL(url).toString();
        return {
          id,
          title,
          url: normalizedUrl,
          icon: icon || undefined,
          isCustomIcon,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return bookmarks.length > 0 ? bookmarks : DEFAULT_CONFIG.bookmarks;
}

function normalizeBackgroundConfig(value) {
  if (!value || typeof value !== 'object') {
    return {
      ...DEFAULT_CONFIG.background,
      imageOpacity: DEFAULT_CONFIG.background.imageOverlay,
    };
  }

  const type = ['animated-gradient', 'image', 'solid'].includes(String(value.type))
    ? value.type
    : 'animated-gradient';

  const imageOverlay =
    typeof value.imageOverlay === 'number'
      ? Math.max(0, Math.min(100, value.imageOverlay))
      : typeof value.imageOpacity === 'number'
        ? Math.max(0, Math.min(100, value.imageOpacity))
        : DEFAULT_CONFIG.background.imageOverlay;

  return {
    type,
    imageUrl: asString(value.imageUrl),
    imageBlur:
      typeof value.imageBlur === 'number'
        ? Math.max(0, Math.min(10, value.imageBlur))
        : 5,
    imageOverlay,
    imageOpacity: imageOverlay,
    gradientPreset: asString(value.gradientPreset, 'default'),
    solidColor: asString(value.solidColor),
  };
}

function normalizeNewsConfig(value) {
  if (!value || typeof value !== 'object') {
    return DEFAULT_CONFIG.news;
  }

  const sourceMode = value.sourceMode === 'manual' ? 'manual' : 'auto';
  const allSourceIds = Array.from(NEWS_SOURCE_IDS);

  const sourceOrder = Array.isArray(value.sourceOrder)
    ? value.sourceOrder.filter((item) => NEWS_SOURCE_IDS.has(item))
    : [];
  const sourceOrderSet = new Set(sourceOrder);
  const normalizedSourceOrder = [
    ...sourceOrder,
    ...allSourceIds.filter((id) => !sourceOrderSet.has(id)),
  ];

  const enabledSourceIds = Array.isArray(value.enabledSourceIds)
    ? Array.from(new Set(value.enabledSourceIds.filter((item) => NEWS_SOURCE_IDS.has(item))))
    : [];
  const normalizedEnabledSourceIds =
    enabledSourceIds.length > 0 ? enabledSourceIds : allSourceIds;

  const preferredSourceId = NEWS_SOURCE_IDS.has(value.sourceId)
    ? value.sourceId
    : DEFAULT_CONFIG.news.sourceId;
  const sourceId = normalizedEnabledSourceIds.includes(preferredSourceId)
    ? preferredSourceId
    : normalizedEnabledSourceIds[0];

  const parsedAutoSwitchSeconds = Number(value.autoSwitchSeconds);
  const autoSwitchSeconds = Number.isFinite(parsedAutoSwitchSeconds)
    ? Math.max(5, Math.min(300, Math.round(parsedAutoSwitchSeconds)))
    : DEFAULT_CONFIG.news.autoSwitchSeconds;

  const parsedLimit = Number(value.limit);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(5, Math.min(30, Math.round(parsedLimit)))
    : DEFAULT_CONFIG.news.limit;

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    collapsed: typeof value.collapsed === 'boolean' ? value.collapsed : false,
    sourceMode,
    sourceId,
    enabledSourceIds: normalizedEnabledSourceIds,
    sourceOrder: normalizedSourceOrder,
    autoSwitchSeconds,
    limit,
  };
}

function normalizeBookmarkLayoutMode(value) {
  if (value === 'compact') {
    return 'compact';
  }

  return 'card';
}

function normalizeBookmarkColumns(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONFIG.bookmarkColumns;
  }

  return Math.max(1, Math.min(6, Math.round(parsed)));
}

function normalizeFaviconRefreshMinutes(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONFIG.faviconAutoRefreshMinutes;
  }

  return Math.max(1, Math.min(1440, Math.round(parsed)));
}

function normalizeConfig(value) {
  if (!value || typeof value !== 'object') {
    return {
      ...DEFAULT_CONFIG,
      searchEngines: [...DEFAULT_CONFIG.searchEngines],
      bookmarks: [...DEFAULT_CONFIG.bookmarks],
      background: { ...DEFAULT_CONFIG.background },
      news: { ...DEFAULT_CONFIG.news },
    };
  }

  const searchEngines = normalizeSearchEngines(value.searchEngines);
  const defaultSearchEngineId = asString(value.defaultSearchEngineId).trim();
  const hasDefault = searchEngines.some((item) => item.id === defaultSearchEngineId);

  return {
    version: Number.isFinite(Number(value.version)) ? Number(value.version) : 1,
    updatedAt: asString(value.updatedAt, new Date().toISOString()),
    pageTitle: asString(value.pageTitle, DEFAULT_CONFIG.pageTitle),
    pageSubtitle: asString(value.pageSubtitle, DEFAULT_CONFIG.pageSubtitle),
    browserTitle: asString(value.browserTitle, DEFAULT_CONFIG.browserTitle),
    homepageConfigured:
      typeof value.homepageConfigured === 'boolean'
        ? value.homepageConfigured
        : DEFAULT_CONFIG.homepageConfigured,
    weatherLocationMode: value.weatherLocationMode === 'auto' ? 'auto' : 'manual',
    weatherCity: asString(value.weatherCity, DEFAULT_CONFIG.weatherCity),
    bookmarkLayoutMode: normalizeBookmarkLayoutMode(value.bookmarkLayoutMode),
    bookmarkColumns: normalizeBookmarkColumns(value.bookmarkColumns),
    faviconAutoRefreshEnabled:
      typeof value.faviconAutoRefreshEnabled === 'boolean'
        ? value.faviconAutoRefreshEnabled
        : DEFAULT_CONFIG.faviconAutoRefreshEnabled,
    faviconAutoRefreshMinutes: normalizeFaviconRefreshMinutes(
      value.faviconAutoRefreshMinutes
    ),
    faviconLastRefreshAt: asString(
      value.faviconLastRefreshAt,
      DEFAULT_CONFIG.faviconLastRefreshAt
    ),
    defaultSearchEngineId: hasDefault
      ? defaultSearchEngineId
      : searchEngines[0].id,
    searchEngines,
    bookmarks: normalizeBookmarks(value.bookmarks),
    background: normalizeBackgroundConfig(value.background),
    news: normalizeNewsConfig(value.news),
  };
}

async function handleGet({ env }) {
  const kv = getKvBinding(env);

  if (!kv) {
    return jsonResponse(
      {
        error:
          "KV namespace binding not found. Please bind namespace 'myhomepage' (fallback: 'my_kv').",
      },
      500
    );
  }

  try {
    const raw = await kv.get(CONFIG_KEY);
    if (!raw) {
      const initial = {
        ...DEFAULT_CONFIG,
        searchEngines: [...DEFAULT_CONFIG.searchEngines],
        bookmarks: [...DEFAULT_CONFIG.bookmarks],
        updatedAt: new Date().toISOString(),
      };
      await kv.put(CONFIG_KEY, JSON.stringify(initial));
      return jsonResponse(initial);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = DEFAULT_CONFIG;
    }

    return jsonResponse(normalizeConfig(parsed));
  } catch (err) {
    return jsonResponse(
      {
        error: err && err.message ? err.message : String(err),
      },
      500
    );
  }
}

async function handlePost({ request, env }) {
  const kv = getKvBinding(env);

  if (!kv) {
    return jsonResponse(
      {
        error:
          "KV namespace binding not found. Please bind namespace 'myhomepage' (fallback: 'my_kv').",
      },
      500
    );
  }

  try {
    const body = await request.json();
    const normalized = normalizeConfig(body);

    let currentConfig = null;
    try {
      const currentRaw = await kv.get(CONFIG_KEY);
      if (currentRaw) {
        currentConfig = normalizeConfig(JSON.parse(currentRaw));
      }
    } catch {
      currentConfig = null;
    }

    if (currentConfig && normalized.version < currentConfig.version) {
      return jsonResponse(currentConfig);
    }

    const nextConfig = {
      ...normalized,
      version: normalized.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await kv.put(CONFIG_KEY, JSON.stringify(nextConfig));
    return jsonResponse(nextConfig);
  } catch (err) {
    return jsonResponse(
      {
        error: err && err.message ? err.message : String(err),
      },
      500
    );
  }
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}

export async function onRequestGet(context) {
  return handleGet(context);
}

export async function onRequestPost(context) {
  return handlePost(context);
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return onRequestOptions(context);
  }

  if (request.method === 'GET') {
    return handleGet(context);
  }

  if (request.method === 'POST') {
    return handlePost(context);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
