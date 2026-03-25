'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CloudSun, Loader2, PenLine, RefreshCcw, Search, Sparkles, Trash2 } from 'lucide-react';
import {
  Bookmark,
  HomepageConfig,
  SearchEngine,
  BackgroundConfig,
  BookmarkLayoutMode,
  DEFAULT_HOMEPAGE_CONFIG,
} from '@/lib/homepage-config';
import {
  fetchBookmarkFavicon,
  getHomepageConfig,
  saveHomepageConfig,
} from '@/lib/utils';

type BookmarkFormState = {
  id: string;
  title: string;
  url: string;
  icon: string;
  isCustomIcon: boolean;
};

type SearchEngineFormState = {
  id: string;
  name: string;
  template: string;
};

function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${random}`;
}

function isCustomIconBookmark(bookmark: Bookmark): boolean {
  if (bookmark.isCustomIcon) {
    return true;
  }

  const icon = bookmark.icon?.trim() || '';
  return Boolean(icon && !icon.startsWith('http') && !icon.startsWith('data:'));
}

function BookmarkIconPreview({ bookmark }: { bookmark: Bookmark }) {
  const icon = bookmark.icon?.trim() || '';

  if (!icon) {
    return (
      <span className="text-xl font-bold text-white/90">
        {bookmark.title.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  if (!icon.startsWith('http') && !icon.startsWith('data:')) {
    return <span className="text-2xl">{icon}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={icon} alt={`${bookmark.title} icon`} className="h-10 w-10 rounded-lg" />
  );
}

export default function SettingsDashboard() {
  const [config, setConfig] = useState<HomepageConfig>(DEFAULT_HOMEPAGE_CONFIG);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [pageTitleInput, setPageTitleInput] = useState(DEFAULT_HOMEPAGE_CONFIG.pageTitle);
  const [pageSubtitleInput, setPageSubtitleInput] = useState(DEFAULT_HOMEPAGE_CONFIG.pageSubtitle);
  const [browserTitleInput, setBrowserTitleInput] = useState(DEFAULT_HOMEPAGE_CONFIG.browserTitle);
  const [cityInput, setCityInput] = useState(DEFAULT_HOMEPAGE_CONFIG.weatherCity);
  const [bookmarkLayoutModeInput, setBookmarkLayoutModeInput] = useState<BookmarkLayoutMode>(
    DEFAULT_HOMEPAGE_CONFIG.bookmarkLayoutMode
  );
  const [bookmarkColumnsInput, setBookmarkColumnsInput] = useState(
    DEFAULT_HOMEPAGE_CONFIG.bookmarkColumns
  );

  const [bookmarkForm, setBookmarkForm] = useState<BookmarkFormState>({
    id: '',
    title: '',
    url: '',
    icon: '',
    isCustomIcon: false,
  });
  const [bookmarkFormError, setBookmarkFormError] = useState<string | null>(null);
  const [faviconLoading, setFaviconLoading] = useState(false);
  const [bulkRefreshStatus, setBulkRefreshStatus] = useState<
    'idle' | 'refreshing' | 'done' | 'error'
  >('idle');
  const [bulkRefreshHint, setBulkRefreshHint] = useState<string | null>(null);

  const [engineForm, setEngineForm] = useState<SearchEngineFormState>({
    id: '',
    name: '',
    template: '',
  });
  const [engineFormError, setEngineFormError] = useState<string | null>(null);
  const saveHintTimer = useRef<number | null>(null);

  const refreshableBookmarks = useMemo(
    () => config.bookmarks.filter((bookmark) => !isCustomIconBookmark(bookmark)),
    [config.bookmarks]
  );
  const customIconCount = useMemo(
    () => config.bookmarks.length - refreshableBookmarks.length,
    [config.bookmarks.length, refreshableBookmarks.length]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setIsLoadingConfig(true);
      setLoadError(null);

      try {
        const result = await getHomepageConfig();

        if (cancelled) {
          return;
        }

        setConfig(result);
        setPageTitleInput(result.pageTitle);
        setPageSubtitleInput(result.pageSubtitle);
        setBrowserTitleInput(result.browserTitle);
        setCityInput(result.weatherCity);
        setBookmarkLayoutModeInput(result.bookmarkLayoutMode);
        setBookmarkColumnsInput(result.bookmarkColumns);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : '配置加载失败');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveHintTimer.current) {
        window.clearTimeout(saveHintTimer.current);
      }
    };
  }, []);

  const persistConfig = useCallback(async (nextConfig: HomepageConfig) => {
    setSaveStatus('saving');
    setSaveError(null);

    try {
      const saved = await saveHomepageConfig(nextConfig);
      setConfig(saved);
      setSaveStatus('saved');

      if (saveHintTimer.current) {
        window.clearTimeout(saveHintTimer.current);
      }

      saveHintTimer.current = window.setTimeout(() => {
        setSaveStatus('idle');
      }, 1200);
      return saved;
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : '保存失败');
      return null;
    }
  }, []);

  const updateConfig = useCallback(
    (updater: (prev: HomepageConfig) => HomepageConfig) => {
      setConfig((prev) => {
        const updated = {
          ...updater(prev),
          updatedAt: new Date().toISOString(),
        };

        void persistConfig(updated);
        return updated;
      });
    },
    [persistConfig]
  );

  const saveWeatherFields = () => {
    updateConfig((prev) => ({
      ...prev,
      weatherCity: cityInput.trim() || prev.weatherCity,
    }));
  };

  const saveTitleFields = () => {
    updateConfig((prev) => ({
      ...prev,
      pageTitle: pageTitleInput.trim() || DEFAULT_HOMEPAGE_CONFIG.pageTitle,
      pageSubtitle:
        pageSubtitleInput.trim() || DEFAULT_HOMEPAGE_CONFIG.pageSubtitle,
      browserTitle:
        browserTitleInput.trim() || DEFAULT_HOMEPAGE_CONFIG.browserTitle,
    }));
  };

  const saveBookmarkLayoutFields = () => {
    updateConfig((prev) => ({
      ...prev,
      bookmarkLayoutMode: bookmarkLayoutModeInput,
      bookmarkColumns: Math.max(1, Math.min(6, Math.round(bookmarkColumnsInput))),
    }));
  };

  const handleBookmarkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBookmarkFormError(null);

    const title = bookmarkForm.title.trim();
    const iconInput = bookmarkForm.icon.trim();

    if (!title) {
      setBookmarkFormError('书签标题不能为空');
      return;
    }

    let normalizedUrl = '';
    try {
      normalizedUrl = new URL(bookmarkForm.url.trim()).toString();
    } catch {
      setBookmarkFormError('请输入合法的 URL，例如 https://example.com');
      return;
    }

    let finalIcon = iconInput;
    let finalIsCustomIcon = iconInput ? bookmarkForm.isCustomIcon : false;

    if (!finalIcon) {
      setFaviconLoading(true);
      const autoIcon = await fetchBookmarkFavicon(normalizedUrl);
      setFaviconLoading(false);
      if (autoIcon) {
        finalIcon = autoIcon;
      }
      finalIsCustomIcon = false;
    }

    const editing = Boolean(bookmarkForm.id);
    const id = editing ? bookmarkForm.id : createId('bookmark');

    updateConfig((prev) => {
      const nextBookmarks = editing
        ? prev.bookmarks.map((item) =>
            item.id === id
              ? {
                  id,
                  title,
                  url: normalizedUrl,
                  icon: finalIcon || undefined,
                  isCustomIcon: finalIcon ? finalIsCustomIcon : false,
                }
              : item
          )
        : [
            ...prev.bookmarks,
            {
              id,
              title,
              url: normalizedUrl,
              icon: finalIcon || undefined,
              isCustomIcon: finalIcon ? finalIsCustomIcon : false,
            },
          ];

      return {
        ...prev,
        bookmarks: nextBookmarks,
      };
    });

    setBookmarkForm({ id: '', title: '', url: '', icon: '', isCustomIcon: false });
  };

  const editBookmark = (bookmark: Bookmark) => {
    setBookmarkForm({
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      icon: bookmark.icon || '',
      isCustomIcon: isCustomIconBookmark(bookmark),
    });
  };

  const removeBookmark = (id: string) => {
    updateConfig((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.filter((item) => item.id !== id),
    }));

    if (bookmarkForm.id === id) {
      setBookmarkForm({ id: '', title: '', url: '', icon: '', isCustomIcon: false });
    }
  };

  const handleBulkRefreshAutoIcons = async () => {
    if (refreshableBookmarks.length === 0) {
      setBulkRefreshStatus('error');
      setBulkRefreshHint('当前没有可刷新的自动图标书签。');
      return;
    }

    setBulkRefreshStatus('refreshing');
    setBulkRefreshHint(`正在刷新 ${refreshableBookmarks.length} 个书签图标...`);

    const refreshableIds = new Set(refreshableBookmarks.map((bookmark) => bookmark.id));
    let successCount = 0;
    let failedCount = 0;

    const nextBookmarks = await Promise.all(
      config.bookmarks.map(async (bookmark) => {
        if (!refreshableIds.has(bookmark.id)) {
          return bookmark;
        }

        const fetchedIcon = await fetchBookmarkFavicon(bookmark.url);

        if (!fetchedIcon) {
          failedCount += 1;
          return bookmark;
        }

        successCount += 1;
        return {
          ...bookmark,
          icon: fetchedIcon,
          isCustomIcon: false,
        };
      })
    );

    if (successCount === 0) {
      setBulkRefreshStatus('error');
      setBulkRefreshHint(`未能刷新图标，失败 ${failedCount} 个。`);
      return;
    }

    const nextConfig: HomepageConfig = {
      ...config,
      bookmarks: nextBookmarks,
      updatedAt: new Date().toISOString(),
    };

    const saved = await persistConfig(nextConfig);

    if (!saved) {
      setBulkRefreshStatus('error');
      setBulkRefreshHint('图标刷新已完成，但保存配置失败，请稍后重试。');
      return;
    }

    setBulkRefreshStatus(failedCount > 0 ? 'error' : 'done');
    setBulkRefreshHint(
      failedCount > 0
        ? `刷新完成：成功 ${successCount}，失败 ${failedCount}。`
        : `刷新完成：共成功更新 ${successCount} 个图标。`
    );
  };

  const handleEngineSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEngineFormError(null);

    const name = engineForm.name.trim();
    const template = engineForm.template.trim();

    if (!name) {
      setEngineFormError('搜索引擎名称不能为空');
      return;
    }

    if (!template.includes('%s')) {
      setEngineFormError('搜索模板必须包含 %s 占位符');
      return;
    }

    const id = engineForm.id.trim() || createId('engine');

    const nextEngine: SearchEngine = { id, name, template };

    updateConfig((prev) => {
      const exists = prev.searchEngines.some((item) => item.id === id);
      const searchEngines = exists
        ? prev.searchEngines.map((item) => (item.id === id ? nextEngine : item))
        : [...prev.searchEngines, nextEngine];

      return {
        ...prev,
        searchEngines,
        defaultSearchEngineId: prev.defaultSearchEngineId || id,
      };
    });

    setEngineForm({ id: '', name: '', template: '' });
  };

  const editEngine = (engine: SearchEngine) => {
    setEngineForm({
      id: engine.id,
      name: engine.name,
      template: engine.template,
    });
  };

  const removeEngine = (id: string) => {
    if (config.searchEngines.length <= 1) {
      setEngineFormError('至少保留一个搜索引擎');
      return;
    }

    updateConfig((prev) => {
      const nextSearchEngines = prev.searchEngines.filter((item) => item.id !== id);
      const nextDefault =
        prev.defaultSearchEngineId === id
          ? nextSearchEngines[0].id
          : prev.defaultSearchEngineId;

      return {
        ...prev,
        searchEngines: nextSearchEngines,
        defaultSearchEngineId: nextDefault,
      };
    });

    if (engineForm.id === id) {
      setEngineForm({ id: '', name: '', template: '' });
    }
  };

  if (isLoadingConfig) {
    return (
      <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12">
        <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-5 text-white shadow-xl backdrop-blur-sm">
          正在加载设置...
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-white/15 bg-slate-900/55 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-shadow-title text-2xl font-semibold tracking-tight text-white sm:text-3xl">设置中心</h1>
              <p className="text-shadow-soft mt-1 text-sm text-white/90">主页保持简洁，所有配置在这里维护。</p>
            </div>

            <Link
              href="/"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400"
            >
              返回主页
            </Link>
          </div>

          {loadError ? (
            <p className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">
              配置加载异常：{loadError}
            </p>
          ) : null}

          {saveError ? (
            <p className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">
              配置保存异常：{saveError}
            </p>
          ) : null}

          {saveStatus === 'saving' ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan-500/20 px-3 py-2 text-sm text-cyan-100">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在保存...
            </p>
          ) : null}

          {saveStatus === 'saved' ? (
            <p className="mt-3 rounded-lg bg-green-500/20 px-3 py-2 text-sm text-green-100">
              保存成功
            </p>
          ) : null}
        </header>

        <article className="rounded-2xl border border-white/15 bg-slate-900/50 p-4 shadow-lg backdrop-blur">
          <h2 className="text-shadow-title text-base font-semibold text-white">页面文案</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              value={pageTitleInput}
              onChange={(event) => setPageTitleInput(event.target.value)}
              placeholder="首页标题，如 HomePage"
            />
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              value={pageSubtitleInput}
              onChange={(event) => setPageSubtitleInput(event.target.value)}
              placeholder="副标题，如 简洁高效的个人起始页"
            />
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              value={browserTitleInput}
              onChange={(event) => setBrowserTitleInput(event.target.value)}
              placeholder="浏览器标题，如 HomePage"
            />
          </div>
          <button
            className="mt-3 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400"
            onClick={saveTitleFields}
          >
            保存页面文案
          </button>
        </article>

        <article className="rounded-2xl border border-white/15 bg-slate-900/50 p-4 shadow-lg backdrop-blur">
          <h2 className="text-shadow-title flex items-center gap-2 text-base font-semibold text-white">
            <CloudSun className="h-4 w-4 text-cyan-300" />
            天气
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-1">
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              value={cityInput}
              onChange={(event) => setCityInput(event.target.value)}
              placeholder="天气城市，如 Shanghai"
            />
          </div>
          <button
            className="mt-3 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400"
            onClick={saveWeatherFields}
          >
            保存天气设置
          </button>
        </article>

        <article className="rounded-2xl border border-white/15 bg-slate-900/50 p-4 shadow-lg backdrop-blur">
          <h2 className="text-shadow-title text-base font-semibold text-white">书签布局</h2>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-300">布局模式</label>
              <select
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                value={bookmarkLayoutModeInput}
                onChange={(event) =>
                  setBookmarkLayoutModeInput(event.target.value as BookmarkLayoutMode)
                }
              >
                <option value="card">卡片模式（图标在上）</option>
                <option value="compact">紧凑模式（图标在左）</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">
                每行书签数量: {bookmarkColumnsInput}
              </label>
              <input
                type="range"
                min="1"
                max="6"
                value={bookmarkColumnsInput}
                onChange={(event) => setBookmarkColumnsInput(Number(event.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <button
            className="mt-3 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400"
            onClick={saveBookmarkLayoutFields}
          >
            保存书签布局
          </button>
        </article>

        <article className="rounded-2xl border border-white/15 bg-slate-900/50 p-4 shadow-lg backdrop-blur">
          <h2 className="text-shadow-title text-base font-semibold text-white">背景设置</h2>

          <div className="mt-3">
            <label className="mb-1 block text-xs text-slate-300">背景类型</label>
            <select
              className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              value={config.background.type}
              onChange={(e) => {
                const type = e.target.value as BackgroundConfig['type'];
                updateConfig((prev) => ({
                  ...prev,
                  background: { ...prev.background, type },
                }));
              }}
            >
              <option value="animated-gradient">动态流光渐变</option>
              <option value="image">自定义图片</option>
              <option value="solid">纯色背景</option>
            </select>
          </div>

          {config.background.type === 'animated-gradient' && (
            <div className="mt-3">
              <label className="mb-1 block text-xs text-slate-300">渐变预设</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'default', label: '默认', colors: 'from-cyan-500 to-fuchsia-500' },
                  { id: 'ocean', label: '海洋', colors: 'from-blue-500 to-teal-500' },
                  { id: 'sunset', label: '日落', colors: 'from-orange-500 to-purple-600' },
                  { id: 'forest', label: '森林', colors: 'from-green-500 to-teal-600' },
                  { id: 'aurora', label: '极光', colors: 'from-indigo-500 to-pink-500' },
                  { id: 'fire', label: '烈焰', colors: 'from-red-500 to-yellow-500' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      updateConfig((prev) => ({
                        ...prev,
                        background: { ...prev.background, gradientPreset: preset.id },
                      }));
                    }}
                    className={`rounded-lg p-3 text-xs font-medium transition ${
                      config.background.gradientPreset === preset.id
                        ? 'ring-2 ring-cyan-400'
                        : 'hover:ring-2 hover:ring-white/30'
                    }`}
                  >
                    <div
                      className={`mb-1 h-8 rounded bg-gradient-to-r ${preset.colors}`}
                    />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {config.background.type === 'image' && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-300">图片 URL</label>
                <input
                  type="url"
                  className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
                  placeholder="https://example.com/image.jpg"
                  value={config.background.imageUrl || ''}
                  onChange={(e) => {
                    updateConfig((prev) => ({
                      ...prev,
                      background: { ...prev.background, imageUrl: e.target.value },
                    }));
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  模糊程度: {config.background.imageBlur || 0}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={config.background.imageBlur || 0}
                  onChange={(e) => {
                    updateConfig((prev) => ({
                      ...prev,
                      background: {
                        ...prev.background,
                        imageBlur: Number(e.target.value),
                      },
                    }));
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  不透明度: {config.background.imageOpacity || 100}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.background.imageOpacity || 100}
                  onChange={(e) => {
                    updateConfig((prev) => ({
                      ...prev,
                      background: {
                        ...prev.background,
                        imageOpacity: Number(e.target.value),
                      },
                    }));
                  }}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {config.background.type === 'solid' && (
            <div className="mt-3">
              <label className="mb-1 block text-xs text-slate-300">颜色</label>
              <input
                type="color"
                className="h-10 w-full rounded-lg border border-white/20 bg-slate-900/70"
                value={config.background.solidColor || '#0f172a'}
                onChange={(e) => {
                  updateConfig((prev) => ({
                    ...prev,
                    background: { ...prev.background, solidColor: e.target.value },
                  }));
                }}
              />
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-white/15 bg-slate-900/50 p-4 shadow-lg backdrop-blur">
          <h2 className="text-shadow-title flex items-center gap-2 text-base font-semibold text-white">
            <Search className="h-4 w-4 text-cyan-300" />
            搜索引擎
          </h2>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-slate-300">默认搜索引擎</label>
            <select
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              value={config.defaultSearchEngineId}
              onChange={(event) => {
                const nextId = event.target.value;
                updateConfig((prev) => ({ ...prev, defaultSearchEngineId: nextId }));
              }}
            >
              {config.searchEngines.map((engine) => (
                <option key={engine.id} value={engine.id}>
                  {engine.name}
                </option>
              ))}
            </select>
          </div>

          <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={handleEngineSubmit}>
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              placeholder="名称"
              value={engineForm.name}
              onChange={(event) =>
                setEngineForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              placeholder="模板，如 https://example.com?q=%s"
              value={engineForm.template}
              onChange={(event) =>
                setEngineForm((prev) => ({ ...prev, template: event.target.value }))
              }
            />
            <button
              type="submit"
              className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400"
            >
              {engineForm.id ? '更新引擎' : '新增引擎'}
            </button>
          </form>

          {engineFormError ? <p className="mt-2 text-sm text-amber-200">{engineFormError}</p> : null}

          <ul className="mt-3 space-y-2 text-sm">
            {config.searchEngines.map((engine) => (
              <li
                key={engine.id}
                className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/25 p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{engine.name}</p>
                  <p className="text-xs text-slate-300">{engine.template}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => editEngine(engine)}
                    className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => removeEngine(engine.id)}
                    className="rounded-md bg-red-500/70 px-2 py-1 text-xs hover:bg-red-400"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-white/15 bg-slate-900/50 p-4 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-shadow-title flex items-center gap-2 text-base font-semibold text-white">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                书签管理
              </h2>
              <p className="text-shadow-soft mt-1 text-xs text-white/85">
                自动图标可一键刷新；勾选“自定义图标”后将跳过批量刷新。
              </p>
            </div>

            <button
              type="button"
              onClick={handleBulkRefreshAutoIcons}
              disabled={bulkRefreshStatus === 'refreshing' || refreshableBookmarks.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            >
              {bulkRefreshStatus === 'refreshing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              刷新自动图标（{refreshableBookmarks.length}）
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">总计 {config.bookmarks.length}</span>
            <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-100">
              自动图标 {refreshableBookmarks.length}
            </span>
            <span className="rounded-full bg-fuchsia-500/20 px-3 py-1 text-fuchsia-100">
              自定义图标 {customIconCount}
            </span>
          </div>

          {bulkRefreshHint ? (
            <p
              className={`mt-2 rounded-lg px-3 py-2 text-sm ${
                bulkRefreshStatus === 'error'
                  ? 'bg-amber-500/20 text-amber-100'
                  : bulkRefreshStatus === 'refreshing'
                    ? 'bg-cyan-500/20 text-cyan-100'
                    : 'bg-emerald-500/20 text-emerald-100'
              }`}
            >
              {bulkRefreshHint}
            </p>
          ) : null}

          <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={handleBookmarkSubmit}>
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              placeholder="书签标题"
              value={bookmarkForm.title}
              onChange={(event) =>
                setBookmarkForm((prev) => ({ ...prev, title: event.target.value }))
              }
            />
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              placeholder="URL，例如 https://example.com"
              value={bookmarkForm.url}
              onChange={(event) =>
                setBookmarkForm((prev) => ({ ...prev, url: event.target.value }))
              }
            />
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              placeholder="图标（可空，自动抓取）"
              value={bookmarkForm.icon}
              onChange={(event) => {
                const nextIcon = event.target.value;
                setBookmarkForm((prev) => ({
                  ...prev,
                  icon: nextIcon,
                  isCustomIcon: nextIcon.trim()
                    ? prev.icon.trim()
                      ? prev.isCustomIcon
                      : true
                    : false,
                }));
              }}
            />
            <button
              type="submit"
              disabled={faviconLoading}
              className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400 disabled:opacity-70"
            >
              {faviconLoading ? '抓取图标中...' : bookmarkForm.id ? '更新书签' : '新增书签'}
            </button>
          </form>

          <label className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={bookmarkForm.isCustomIcon}
              disabled={!bookmarkForm.icon.trim()}
              onChange={(event) =>
                setBookmarkForm((prev) => ({ ...prev, isCustomIcon: event.target.checked }))
              }
            />
            将当前图标标记为“自定义图标”（批量刷新时跳过）
          </label>

          {bookmarkFormError ? (
            <p className="mt-2 text-sm text-amber-200">{bookmarkFormError}</p>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {config.bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="group rounded-xl border border-white/10 bg-slate-900/70 p-3 transition hover:border-cyan-400/60"
              >
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                    <BookmarkIconPreview bookmark={bookmark} />
                  </div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="truncate font-medium">{bookmark.title}</h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                        isCustomIconBookmark(bookmark)
                          ? 'bg-fuchsia-500/20 text-fuchsia-100'
                          : 'bg-cyan-500/20 text-cyan-100'
                      }`}
                    >
                      {isCustomIconBookmark(bookmark) ? '自定义' : '自动'}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-400">{new URL(bookmark.url).hostname}</p>
                </a>
                <div className="mt-3 flex gap-2 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => editBookmark(bookmark)}
                    className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                  >
                    <PenLine className="h-3 w-3" />
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBookmark(bookmark.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-red-500/70 px-2 py-1 text-xs hover:bg-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
