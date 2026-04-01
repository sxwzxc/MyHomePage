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

export type BookmarkLayoutMode = 'card' | 'compact';

export type BackgroundConfig = {
  type: 'animated-gradient' | 'image' | 'solid';
  imageUrl?: string;
  imageBlur?: number; // 0-10
  imageOpacity?: number; // 0-100
  gradientPreset?: string;
  solidColor?: string;
};

export type NewsSourceMode = 'auto' | 'manual';

export type WeatherLocationMode = 'manual' | 'auto';

export const NEWS_SOURCE_OPTIONS = [
  { id: 's60', label: '60s 读懂世界' },
  { id: 'toutiao', label: '头条热搜' },
  { id: 'weibo', label: '微博热搜' },
  { id: 'zhihu', label: '知乎热榜' },
  { id: 'quark', label: '夸克热搜' },
  { id: 'baidu-hot', label: '百度热搜' },
  { id: 'bili', label: 'B 站热榜' },
  { id: 'douyin', label: '抖音热榜' },
  { id: 'rednote', label: '小红书热榜' },
  { id: 'douban-weekly-movie', label: '豆瓣电影周榜' },
  { id: 'dongchedi', label: '懂车帝热榜' },
] as const;

export type NewsSourceId = (typeof NEWS_SOURCE_OPTIONS)[number]['id'];

export type NewsConfig = {
  enabled: boolean;
  collapsed: boolean;
  sourceMode: NewsSourceMode;
  sourceId: NewsSourceId;
  enabledSourceIds: NewsSourceId[];
  sourceOrder: NewsSourceId[];
  autoSwitchSeconds: number;
  limit: number;
};

export type HomepageConfig = {
  version: number;
  updatedAt: string;
  pageTitle: string;
  pageSubtitle: string;
  browserTitle: string;
  homepageConfigured: boolean;
  weatherLocationMode: WeatherLocationMode;
  weatherCity: string;
  bookmarkLayoutMode: BookmarkLayoutMode;
  bookmarkColumns: number;
  faviconAutoRefreshEnabled: boolean;
  faviconAutoRefreshMinutes: number;
  faviconLastRefreshAt: string;
  defaultSearchEngineId: string;
  searchEngines: SearchEngine[];
  bookmarks: Bookmark[];
  background: BackgroundConfig;
  news: NewsConfig;
};

export type BookmarkSettingsConfig = Pick<
  HomepageConfig,
  | 'bookmarkLayoutMode'
  | 'bookmarkColumns'
  | 'faviconAutoRefreshEnabled'
  | 'faviconAutoRefreshMinutes'
  | 'faviconLastRefreshAt'
  | 'bookmarks'
>;

export type BookmarkSettingsBackupPayload = {
  kind: 'homepage-bookmark-settings';
  schemaVersion: 1;
  exportedAt: string;
  data: BookmarkSettingsConfig;
};

export type BookmarkSettingsImportResult = {
  patch: BookmarkSettingsConfig;
  warnings: string[];
  totalBookmarks: number;
  importedBookmarks: number;
  skippedBookmarks: number;
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
];

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfig = {
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
  searchEngines: DEFAULT_SEARCH_ENGINES,
  bookmarks: DEFAULT_BOOKMARKS,
  background: {
    type: 'animated-gradient',
    imageBlur: 5,
    imageOpacity: 80,
    gradientPreset: 'default',
  },
  news: {
    enabled: true,
    collapsed: false,
    sourceMode: 'auto',
    sourceId: 's60',
    enabledSourceIds: NEWS_SOURCE_OPTIONS.map((item) => item.id),
    sourceOrder: NEWS_SOURCE_OPTIONS.map((item) => item.id),
    autoSwitchSeconds: 15,
    limit: 10,
  },
};

const BOOKMARK_SETTINGS_BACKUP_KIND = 'homepage-bookmark-settings';
const BOOKMARK_SETTINGS_BACKUP_SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeTimestampString(value: unknown, fallback: string): string {
  const text = asString(value).trim();
  if (!text) {
    return fallback;
  }

  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
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

function normalizeBookmarksFromBackup(value: unknown): {
  bookmarks: Bookmark[];
  warnings: string[];
  total: number;
} {
  if (!Array.isArray(value)) {
    throw new Error('导入文件缺少 bookmarks 数组');
  }

  const warnings: string[] = [];
  const normalizedBookmarks: Bookmark[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  value.forEach((item, index) => {
    const row = index + 1;

    if (!isRecord(item)) {
      warnings.push(`第 ${row} 项不是对象，已跳过`);
      return;
    }

    const id = asString(item.id).trim();
    const title = asString(item.title).trim();
    const url = asString(item.url).trim();
    const icon = asString(item.icon).trim();

    if (!id || !title || !url) {
      warnings.push(`第 ${row} 项缺少 id/title/url，已跳过`);
      return;
    }

    let normalizedUrl = '';
    try {
      normalizedUrl = new URL(url).toString();
    } catch {
      warnings.push(`第 ${row} 项 URL 不合法（${url}），已跳过`);
      return;
    }

    if (seenIds.has(id)) {
      warnings.push(`第 ${row} 项 id 重复（${id}），已跳过`);
      return;
    }

    if (seenUrls.has(normalizedUrl)) {
      warnings.push(`第 ${row} 项 URL 重复（${normalizedUrl}），已跳过`);
      return;
    }

    seenIds.add(id);
    seenUrls.add(normalizedUrl);

    const hasCustomFlag = typeof item.isCustomIcon === 'boolean';
    const inferredCustom = Boolean(
      icon && !icon.startsWith('http') && !icon.startsWith('data:')
    );

    normalizedBookmarks.push({
      id,
      title,
      url: normalizedUrl,
      icon: icon || undefined,
      isCustomIcon: hasCustomFlag ? Boolean(item.isCustomIcon) : inferredCustom,
    });
  });

  return {
    bookmarks: normalizedBookmarks,
    warnings,
    total: value.length,
  };
}

export function createBookmarkSettingsBackupPayload(
  config: HomepageConfig
): BookmarkSettingsBackupPayload {
  return {
    kind: BOOKMARK_SETTINGS_BACKUP_KIND,
    schemaVersion: BOOKMARK_SETTINGS_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      bookmarkLayoutMode: config.bookmarkLayoutMode,
      bookmarkColumns: config.bookmarkColumns,
      faviconAutoRefreshEnabled: config.faviconAutoRefreshEnabled,
      faviconAutoRefreshMinutes: config.faviconAutoRefreshMinutes,
      faviconLastRefreshAt: config.faviconLastRefreshAt,
      bookmarks: config.bookmarks.map((item) => ({ ...item })),
    },
  };
}

export function parseBookmarkSettingsBackupPayload(
  value: unknown
): BookmarkSettingsImportResult {
  if (!isRecord(value)) {
    throw new Error('导入文件不是有效 JSON 对象');
  }

  const kind = asString(value.kind).trim();
  if (kind && kind !== BOOKMARK_SETTINGS_BACKUP_KIND) {
    throw new Error('导入文件类型不匹配，请选择书签设置备份文件');
  }

  const schemaVersion = Number(value.schemaVersion ?? BOOKMARK_SETTINGS_BACKUP_SCHEMA_VERSION);
  if (
    Number.isFinite(schemaVersion) &&
    schemaVersion > BOOKMARK_SETTINGS_BACKUP_SCHEMA_VERSION
  ) {
    throw new Error('导入文件版本过高，请先升级当前应用后再导入');
  }

  const payload = isRecord(value.data) ? value.data : value;
  const { bookmarks, warnings, total } = normalizeBookmarksFromBackup(payload.bookmarks);

  if (bookmarks.length === 0) {
    throw new Error('导入失败：文件中没有可用书签');
  }

  const patch: BookmarkSettingsConfig = {
    bookmarkLayoutMode: normalizeBookmarkLayoutMode(payload.bookmarkLayoutMode),
    bookmarkColumns: normalizeBookmarkColumns(payload.bookmarkColumns),
    faviconAutoRefreshEnabled:
      typeof payload.faviconAutoRefreshEnabled === 'boolean'
        ? payload.faviconAutoRefreshEnabled
        : DEFAULT_HOMEPAGE_CONFIG.faviconAutoRefreshEnabled,
    faviconAutoRefreshMinutes: normalizeFaviconRefreshMinutes(
      payload.faviconAutoRefreshMinutes
    ),
    faviconLastRefreshAt: normalizeTimestampString(
      payload.faviconLastRefreshAt,
      DEFAULT_HOMEPAGE_CONFIG.faviconLastRefreshAt
    ),
    bookmarks,
  };

  return {
    patch,
    warnings,
    totalBookmarks: total,
    importedBookmarks: bookmarks.length,
    skippedBookmarks: total - bookmarks.length,
  };
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

function normalizeNewsConfig(value: unknown): NewsConfig {
  if (!isRecord(value)) {
    return DEFAULT_HOMEPAGE_CONFIG.news;
  }

  const sourceMode = value.sourceMode === 'manual' ? 'manual' : 'auto';
  const allSourceIds = NEWS_SOURCE_OPTIONS.map((item) => item.id);

  const sourceOrderFromValue = Array.isArray(value.sourceOrder)
    ? value.sourceOrder.filter(
        (item): item is NewsSourceId =>
          NEWS_SOURCE_OPTIONS.some((option) => option.id === item)
      )
    : [];
  const sourceOrderSet = new Set(sourceOrderFromValue);
  const normalizedSourceOrder = [
    ...sourceOrderFromValue,
    ...allSourceIds.filter((id) => !sourceOrderSet.has(id)),
  ];

  const enabledSourceIdsFromValue = Array.isArray(value.enabledSourceIds)
    ? value.enabledSourceIds
        .filter((item): item is NewsSourceId =>
          NEWS_SOURCE_OPTIONS.some((option) => option.id === item)
        )
    : [];
  const enabledSourceIds = Array.from(new Set(enabledSourceIdsFromValue));
  const normalizedEnabledSourceIds =
    enabledSourceIds.length > 0 ? enabledSourceIds : allSourceIds;

  const preferredSourceId = NEWS_SOURCE_OPTIONS.some((item) => item.id === value.sourceId)
    ? (value.sourceId as NewsSourceId)
    : DEFAULT_HOMEPAGE_CONFIG.news.sourceId;
  const sourceId = normalizedEnabledSourceIds.includes(preferredSourceId)
    ? preferredSourceId
    : normalizedEnabledSourceIds[0];

  const switchSecondsParsed = Number(value.autoSwitchSeconds);
  const autoSwitchSeconds = Number.isFinite(switchSecondsParsed)
    ? Math.max(5, Math.min(300, Math.round(switchSecondsParsed)))
    : DEFAULT_HOMEPAGE_CONFIG.news.autoSwitchSeconds;

  const limitParsed = Number(value.limit);
  const limit = Number.isFinite(limitParsed)
    ? Math.max(5, Math.min(30, Math.round(limitParsed)))
    : DEFAULT_HOMEPAGE_CONFIG.news.limit;

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

function normalizeBookmarkLayoutMode(value: unknown): BookmarkLayoutMode {
  if (value === 'compact') {
    return 'compact';
  }

  return 'card';
}

function normalizeBookmarkColumns(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_HOMEPAGE_CONFIG.bookmarkColumns;
  }

  return Math.max(1, Math.min(6, Math.round(parsed)));
}

function normalizeFaviconRefreshMinutes(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_HOMEPAGE_CONFIG.faviconAutoRefreshMinutes;
  }

  return Math.max(1, Math.min(1440, Math.round(parsed)));
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
    homepageConfigured:
      typeof value.homepageConfigured === 'boolean'
        ? value.homepageConfigured
        : DEFAULT_HOMEPAGE_CONFIG.homepageConfigured,
    weatherLocationMode: value.weatherLocationMode === 'auto' ? 'auto' : 'manual',
    weatherCity: asString(value.weatherCity, DEFAULT_HOMEPAGE_CONFIG.weatherCity),
    bookmarkLayoutMode: normalizeBookmarkLayoutMode(value.bookmarkLayoutMode),
    bookmarkColumns: normalizeBookmarkColumns(value.bookmarkColumns),
    faviconAutoRefreshEnabled:
      typeof value.faviconAutoRefreshEnabled === 'boolean'
        ? value.faviconAutoRefreshEnabled
        : DEFAULT_HOMEPAGE_CONFIG.faviconAutoRefreshEnabled,
    faviconAutoRefreshMinutes: normalizeFaviconRefreshMinutes(
      value.faviconAutoRefreshMinutes
    ),
    faviconLastRefreshAt: asString(
      value.faviconLastRefreshAt,
      DEFAULT_HOMEPAGE_CONFIG.faviconLastRefreshAt
    ),
    defaultSearchEngineId: hasDefault
      ? defaultSearchEngineId
      : searchEngines[0].id,
    searchEngines,
    bookmarks: bookmarks.length > 0 ? bookmarks : DEFAULT_BOOKMARKS,
    background: normalizeBackgroundConfig(value.background),
    news: normalizeNewsConfig(value.news),
  };
}
