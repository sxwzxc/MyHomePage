export type Bookmark = {
  id: string;
  title: string;
  url: string;
  icon?: string;
  isCustomIcon?: boolean;
};

export type SearchEngine = {
  id: string;
  name: string;
  template: string;
};

export type BackgroundConfig = {
  type: 'animated-gradient' | 'image' | 'solid';
  imageUrl?: string;
  imageBlur?: number; // 0-10
  imageOpacity?: number; // 0-100
  gradientPreset?: string;
  solidColor?: string;
};

export type HomepageConfig = {
  version: number;
  updatedAt: string;
  pageTitle: string;
  pageSubtitle: string;
  browserTitle: string;
  weatherCity: string;
  defaultSearchEngineId: string;
  searchEngines: SearchEngine[];
  bookmarks: Bookmark[];
  background: BackgroundConfig;
};

export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
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
];

export const DEFAULT_BOOKMARKS: Bookmark[] = [
  { id: 'bookmark-github', title: 'GitHub', url: 'https://github.com' },
  {
    id: 'bookmark-edgeone',
    title: 'EdgeOne Pages',
    url: 'https://edgeone.ai/pages',
  },
  { id: 'bookmark-bilibili', title: 'Bilibili', url: 'https://www.bilibili.com' },
  { id: 'bookmark-zhihu', title: '知乎', url: 'https://www.zhihu.com' },
];

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfig = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  pageTitle: 'HomePage',
  pageSubtitle: '简洁高效的个人起始页',
  browserTitle: 'HomePage',
  weatherCity: 'Shanghai',
  defaultSearchEngineId: 'google',
  searchEngines: DEFAULT_SEARCH_ENGINES,
  bookmarks: DEFAULT_BOOKMARKS,
  background: {
    type: 'animated-gradient',
    imageBlur: 5,
    imageOpacity: 80,
    gradientPreset: 'default',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeSearchEngines(value: unknown): SearchEngine[] {
  if (!Array.isArray(value)) {
    return DEFAULT_SEARCH_ENGINES;
  }

  const engines = value
    .map((item) => {
      if (!isRecord(item)) {
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
    .filter((item): item is SearchEngine => Boolean(item));

  return engines.length > 0 ? engines : DEFAULT_SEARCH_ENGINES;
}

function normalizeBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) {
    return DEFAULT_BOOKMARKS;
  }

  const bookmarks = value
    .map((item) => {
      if (!isRecord(item)) {
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
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return bookmarks;
}

function normalizeBackgroundConfig(value: unknown): BackgroundConfig {
  if (!isRecord(value)) {
    return DEFAULT_HOMEPAGE_CONFIG.background;
  }

  const type = ['animated-gradient', 'image', 'solid'].includes(String(value.type))
    ? (value.type as BackgroundConfig['type'])
    : 'animated-gradient';

  return {
    type,
    imageUrl: asString(value.imageUrl),
    imageBlur:
      typeof value.imageBlur === 'number'
        ? Math.max(0, Math.min(10, value.imageBlur))
        : 5,
    imageOpacity:
      typeof value.imageOpacity === 'number'
        ? Math.max(0, Math.min(100, value.imageOpacity))
        : 80,
    gradientPreset: asString(value.gradientPreset, 'default'),
    solidColor: asString(value.solidColor),
  };
}

export function normalizeHomepageConfig(value: unknown): HomepageConfig {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_HOMEPAGE_CONFIG,
      searchEngines: [...DEFAULT_HOMEPAGE_CONFIG.searchEngines],
      bookmarks: [...DEFAULT_HOMEPAGE_CONFIG.bookmarks],
    };
  }

  const searchEngines = normalizeSearchEngines(value.searchEngines);
  const bookmarks = normalizeBookmarks(value.bookmarks);
  const defaultSearchEngineId = asString(value.defaultSearchEngineId).trim();
  const hasDefault = searchEngines.some((item) => item.id === defaultSearchEngineId);

  return {
    version: Number.isFinite(Number(value.version)) ? Number(value.version) : 1,
    updatedAt: asString(value.updatedAt, new Date().toISOString()),
    pageTitle: asString(value.pageTitle, DEFAULT_HOMEPAGE_CONFIG.pageTitle),
    pageSubtitle: asString(value.pageSubtitle, DEFAULT_HOMEPAGE_CONFIG.pageSubtitle),
    browserTitle: asString(value.browserTitle, DEFAULT_HOMEPAGE_CONFIG.browserTitle),
    weatherCity: asString(value.weatherCity, DEFAULT_HOMEPAGE_CONFIG.weatherCity),
    defaultSearchEngineId: hasDefault
      ? defaultSearchEngineId
      : searchEngines[0].id,
    searchEngines,
    bookmarks: bookmarks.length > 0 ? bookmarks : DEFAULT_BOOKMARKS,
    background: normalizeBackgroundConfig(value.background),
  };
}
