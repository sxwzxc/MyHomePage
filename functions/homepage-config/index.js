const CONFIG_KEY = 'homepage:config:v1';

const DEFAULT_CONFIG = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  weatherCity: 'Shanghai',
  address: '中国 · 上海',
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
    { id: 'bookmark-github', title: 'GitHub', url: 'https://github.com' },
    {
      id: 'bookmark-edgeone',
      title: 'EdgeOne Pages',
      url: 'https://edgeone.ai/pages',
    },
    { id: 'bookmark-bilibili', title: 'Bilibili', url: 'https://www.bilibili.com' },
    { id: 'bookmark-zhihu', title: '知乎', url: 'https://www.zhihu.com' },
  ],
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

function getKvBinding() {
  if (typeof myhomepage !== 'undefined') {
    return myhomepage;
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
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return bookmarks.length > 0 ? bookmarks : DEFAULT_CONFIG.bookmarks;
}

function normalizeConfig(value) {
  if (!value || typeof value !== 'object') {
    return {
      ...DEFAULT_CONFIG,
      searchEngines: [...DEFAULT_CONFIG.searchEngines],
      bookmarks: [...DEFAULT_CONFIG.bookmarks],
    };
  }

  const searchEngines = normalizeSearchEngines(value.searchEngines);
  const defaultSearchEngineId = asString(value.defaultSearchEngineId).trim();
  const hasDefault = searchEngines.some((item) => item.id === defaultSearchEngineId);

  return {
    version: Number.isFinite(Number(value.version)) ? Number(value.version) : 1,
    updatedAt: asString(value.updatedAt, new Date().toISOString()),
    weatherCity: asString(value.weatherCity, DEFAULT_CONFIG.weatherCity),
    address: asString(value.address, DEFAULT_CONFIG.address),
    defaultSearchEngineId: hasDefault
      ? defaultSearchEngineId
      : searchEngines[0].id,
    searchEngines,
    bookmarks: normalizeBookmarks(value.bookmarks),
  };
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  const kv = getKvBinding();

  if (!kv) {
    return jsonResponse(
      {
        error:
          "KV namespace binding not found. Please bind namespace 'myhomepage' (or fallback 'my_kv').",
      },
      500
    );
  }

  try {
    if (request.method === 'GET') {
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
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const normalized = normalizeConfig(body);
      const nextConfig = {
        ...normalized,
        version: normalized.version + 1,
        updatedAt: new Date().toISOString(),
      };

      await kv.put(CONFIG_KEY, JSON.stringify(nextConfig));
      return jsonResponse(nextConfig);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return jsonResponse(
      {
        error: err && err.message ? err.message : String(err),
      },
      500
    );
  }
}
