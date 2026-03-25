'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Bookmark,
  HomepageConfig,
  SearchEngine,
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
  const searchParams = useSearchParams();

  const [config, setConfig] = useState<HomepageConfig>(DEFAULT_HOMEPAGE_CONFIG);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [cityInput, setCityInput] = useState(DEFAULT_HOMEPAGE_CONFIG.weatherCity);
  const [addressInput, setAddressInput] = useState(DEFAULT_HOMEPAGE_CONFIG.address);

  const [bookmarkForm, setBookmarkForm] = useState<BookmarkFormState>({
    id: '',
    title: '',
    url: '',
    icon: '',
  });
  const [bookmarkFormError, setBookmarkFormError] = useState<string | null>(null);
  const [faviconLoading, setFaviconLoading] = useState(false);

  const [engineForm, setEngineForm] = useState<SearchEngineFormState>({
    id: '',
    name: '',
    template: '',
  });
  const [engineFormError, setEngineFormError] = useState<string | null>(null);
  const saveHintTimer = useRef<number | null>(null);

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
        setCityInput(result.weatherCity);
        setAddressInput(result.address);
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
    const editBookmark = searchParams.get('editBookmark');

    if (!editBookmark || config.bookmarks.length === 0) {
      return;
    }

    const target = config.bookmarks.find((bookmark) => bookmark.id === editBookmark);
    if (!target) {
      return;
    }

    setBookmarkForm({
      id: target.id,
      title: target.title,
      url: target.url,
      icon: target.icon || '',
    });
  }, [config.bookmarks, searchParams]);

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
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : '保存失败');
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

  const saveProfileFields = () => {
    updateConfig((prev) => ({
      ...prev,
      weatherCity: cityInput.trim() || prev.weatherCity,
      address: addressInput.trim() || prev.address,
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

    if (!finalIcon) {
      setFaviconLoading(true);
      const autoIcon = await fetchBookmarkFavicon(normalizedUrl);
      setFaviconLoading(false);
      if (autoIcon) {
        finalIcon = autoIcon;
      }
    }

    const editing = Boolean(bookmarkForm.id);
    const id = editing ? bookmarkForm.id : createId('bookmark');

    updateConfig((prev) => {
      const nextBookmarks = editing
        ? prev.bookmarks.map((item) =>
            item.id === id
              ? { id, title, url: normalizedUrl, icon: finalIcon || undefined }
              : item
          )
        : [
            ...prev.bookmarks,
            { id, title, url: normalizedUrl, icon: finalIcon || undefined },
          ];

      return {
        ...prev,
        bookmarks: nextBookmarks,
      };
    });

    setBookmarkForm({ id: '', title: '', url: '', icon: '' });
  };

  const editBookmark = (bookmark: Bookmark) => {
    setBookmarkForm({
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      icon: bookmark.icon || '',
    });
  };

  const removeBookmark = (id: string) => {
    updateConfig((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.filter((item) => item.id !== id),
    }));

    if (bookmarkForm.id === id) {
      setBookmarkForm({ id: '', title: '', url: '', icon: '' });
    }
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
    <section className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-cyan-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-fuchsia-500/30 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">设置中心</h1>
              <p className="mt-1 text-sm text-slate-200/90">主页保持简洁，所有配置在这里维护。</p>
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

          {saveStatus === 'saved' ? (
            <p className="mt-3 rounded-lg bg-green-500/20 px-3 py-2 text-sm text-green-100">
              保存成功
            </p>
          ) : null}
        </header>

        <article className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur">
          <h2 className="text-base font-semibold">天气与地址</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              value={cityInput}
              onChange={(event) => setCityInput(event.target.value)}
              placeholder="天气城市，如 Shanghai"
            />
            <input
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              placeholder="地址描述，如 中国 · 上海"
            />
          </div>
          <button
            className="mt-3 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400"
            onClick={saveProfileFields}
          >
            保存天气与地址
          </button>
        </article>

        <article className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur">
          <h2 className="text-base font-semibold">搜索引擎</h2>
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

        <article className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur">
          <h2 className="text-base font-semibold">书签管理</h2>
          <p className="mt-1 text-xs text-slate-300">若不手填图标，将自动下载网站图标并保存到 KV。</p>

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
              onChange={(event) =>
                setBookmarkForm((prev) => ({ ...prev, icon: event.target.value }))
              }
            />
            <button
              type="submit"
              disabled={faviconLoading}
              className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400 disabled:opacity-70"
            >
              {faviconLoading ? '抓取图标中...' : bookmarkForm.id ? '更新书签' : '新增书签'}
            </button>
          </form>

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
                  <h3 className="truncate font-medium">{bookmark.title}</h3>
                  <p className="truncate text-xs text-slate-400">{bookmark.url}</p>
                </a>
                <div className="mt-3 flex gap-2 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => editBookmark(bookmark)}
                    className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBookmark(bookmark.id)}
                    className="rounded-md bg-red-500/70 px-2 py-1 text-xs hover:bg-red-400"
                  >
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
