'use client';

import {
  Bookmark,
  HomepageConfig,
  SearchEngine,
  DEFAULT_HOMEPAGE_CONFIG,
} from '@/lib/homepage-config';
import {
  getHomepageConfig,
  getVisitCount,
  saveHomepageConfig,
} from '@/lib/utils';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type WeatherInfo = {
  cityName: string;
  temperature: number;
  weatherText: string;
  windSpeed: number;
};

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

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function getAutoFavicon(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
  } catch {
    return '';
  }
}

function weatherCodeToText(code: number): string {
  const map: Record<number, string> = {
    0: '晴朗',
    1: '大部晴朗',
    2: '局部多云',
    3: '阴天',
    45: '雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '毛毛雨',
    55: '强毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    80: '小阵雨',
    81: '中阵雨',
    82: '大阵雨',
    95: '雷暴',
  };

  return map[code] ?? '天气未知';
}

async function fetchWeatherByCity(city: string): Promise<WeatherInfo> {
  const geocodingRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city
    )}&count=1&language=zh&format=json`
  );

  if (!geocodingRes.ok) {
    throw new Error('城市查询失败');
  }

  const geocodingData = (await geocodingRes.json()) as {
    results?: Array<{
      name: string;
      latitude: number;
      longitude: number;
    }>;
  };

  const place = geocodingData.results?.[0];
  if (!place) {
    throw new Error('未找到该城市');
  }

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
  );

  if (!weatherRes.ok) {
    throw new Error('天气服务暂不可用');
  }

  const weatherData = (await weatherRes.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
  };

  if (!weatherData.current) {
    throw new Error('天气数据为空');
  }

  return {
    cityName: place.name,
    temperature: Number(weatherData.current.temperature_2m ?? 0),
    weatherText: weatherCodeToText(Number(weatherData.current.weather_code ?? 0)),
    windSpeed: Number(weatherData.current.wind_speed_10m ?? 0),
  };
}

function BookmarkIcon({ bookmark }: { bookmark: Bookmark }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const manualIcon = bookmark.icon?.trim() ?? '';
  const autoIcon = getAutoFavicon(bookmark.url);

  if (manualIcon && !isHttpUrl(manualIcon)) {
    return <span className="text-2xl">{manualIcon}</span>;
  }

  const iconUrl = manualIcon && isHttpUrl(manualIcon) ? manualIcon : autoIcon;

  if (!iconUrl || loadFailed) {
    return (
      <span className="text-xl font-bold text-white/90">
        {bookmark.title.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl}
      alt={`${bookmark.title} icon`}
      className="h-10 w-10 rounded-lg"
      onError={() => setLoadFailed(true)}
      loading="lazy"
    />
  );
}

export default function HomepageDashboard() {
  const [config, setConfig] = useState<HomepageConfig>(DEFAULT_HOMEPAGE_CONFIG);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [visitCount, setVisitCount] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [bookmarkForm, setBookmarkForm] = useState<BookmarkFormState>({
    id: '',
    title: '',
    url: '',
    icon: '',
  });
  const [bookmarkFormError, setBookmarkFormError] = useState<string | null>(null);
  const [engineForm, setEngineForm] = useState<SearchEngineFormState>({
    id: '',
    name: '',
    template: '',
  });
  const [engineFormError, setEngineFormError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [cityInput, setCityInput] = useState(DEFAULT_HOMEPAGE_CONFIG.weatherCity);
  const [addressInput, setAddressInput] = useState(DEFAULT_HOMEPAGE_CONFIG.address);
  const [now, setNow] = useState(() => new Date());
  const saveHintTimer = useRef<number | null>(null);

  const selectedEngine = useMemo(() => {
    return (
      config.searchEngines.find(
        (engine) => engine.id === config.defaultSearchEngineId
      ) ?? config.searchEngines[0]
    );
  }, [config.defaultSearchEngineId, config.searchEngines]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setIsLoadingConfig(true);
      setLoadError(null);

      try {
        const [savedConfig, count] = await Promise.all([
          getHomepageConfig(),
          getVisitCount().catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        setConfig(savedConfig);
        setCityInput(savedConfig.weatherCity);
        setAddressInput(savedConfig.address);
        setVisitCount(count);
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

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistConfig = useCallback(async (nextConfig: HomepageConfig) => {
    setSaveStatus('saving');
    setSaveError(null);

    try {
      const savedConfig = await saveHomepageConfig(nextConfig);
      setConfig(savedConfig);
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

  useEffect(() => {
    return () => {
      if (saveHintTimer.current) {
        window.clearTimeout(saveHintTimer.current);
      }
    };
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

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      if (!config.weatherCity.trim()) {
        setWeather(null);
        setWeatherError('请先设置天气城市');
        return;
      }

      setWeatherLoading(true);
      setWeatherError(null);

      try {
        const data = await fetchWeatherByCity(config.weatherCity.trim());
        if (!cancelled) {
          setWeather(data);
        }
      } catch (error) {
        if (!cancelled) {
          setWeatherError(error instanceof Error ? error.message : '天气获取失败');
        }
      } finally {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      }
    }

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, [config.weatherCity]);

  const saveProfileFields = () => {
    updateConfig((prev) => ({
      ...prev,
      weatherCity: cityInput.trim() || prev.weatherCity,
      address: addressInput.trim() || prev.address,
    }));
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const keyword = searchKeyword.trim();
    if (!keyword || !selectedEngine) {
      return;
    }

    const destination = selectedEngine.template.replace(
      '%s',
      encodeURIComponent(keyword)
    );

    window.location.href = destination;
  };

  const handleBookmarkSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBookmarkFormError(null);

    const title = bookmarkForm.title.trim();
    const icon = bookmarkForm.icon.trim();

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

    const editing = Boolean(bookmarkForm.id);
    const id = editing ? bookmarkForm.id : createId('bookmark');

    updateConfig((prev) => {
      const nextBookmarks = editing
        ? prev.bookmarks.map((item) =>
            item.id === id
              ? { id, title, url: normalizedUrl, icon: icon || undefined }
              : item
          )
        : [...prev.bookmarks, { id, title, url: normalizedUrl, icon: icon || undefined }];

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
      icon: bookmark.icon ?? '',
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

    let id = engineForm.id.trim();
    if (!id) {
      id = createId('engine');
    }

    const nextEngine: SearchEngine = {
      id,
      name,
      template,
    };

    updateConfig((prev) => {
      const exists = prev.searchEngines.some((item) => item.id === id);
      const searchEngines = exists
        ? prev.searchEngines.map((item) => (item.id === id ? nextEngine : item))
        : [...prev.searchEngines, nextEngine];

      return {
        ...prev,
        searchEngines,
        defaultSearchEngineId: exists
          ? prev.defaultSearchEngineId
          : prev.defaultSearchEngineId || id,
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
          正在从 KV 加载你的主页配置...
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                我的浏览器起始页
              </h1>
              <p className="mt-1 text-sm text-slate-200/90">
                书签、搜索和常用信息都在这里，并通过 EdgeOne KV 持久化。
              </p>
              {visitCount !== null ? (
                <p className="mt-2 text-xs text-cyan-200">累计访问：{visitCount}</p>
              ) : null}
            </div>

            <div className="rounded-2xl bg-black/25 px-4 py-3 text-sm">
              <p>{now.toLocaleDateString('zh-CN', { weekday: 'long' })}</p>
              <p className="text-lg font-semibold">
                {now.toLocaleTimeString('zh-CN', { hour12: false })}
              </p>
              <p className="text-xs text-slate-300">
                最近保存：
                {saveStatus === 'saving'
                  ? '保存中...'
                  : saveStatus === 'saved'
                  ? '刚刚'
                  : saveStatus === 'error'
                  ? '失败'
                  : '未变更'}
              </p>
            </div>
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
        </header>

        <div className="grid gap-5 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur">
            <h2 className="text-base font-semibold">天气与地址</h2>
            <p className="mt-1 text-xs text-slate-300">城市与地址可手动配置并持久化到 KV。</p>

            <div className="mt-3 space-y-2 text-sm">
              <label className="block text-slate-200">天气城市</label>
              <input
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 outline-none transition focus:border-cyan-400"
                value={cityInput}
                onChange={(event) => setCityInput(event.target.value)}
                placeholder="例如：Shanghai / 北京"
              />

              <label className="block text-slate-200">地址描述</label>
              <input
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 outline-none transition focus:border-cyan-400"
                value={addressInput}
                onChange={(event) => setAddressInput(event.target.value)}
                placeholder="例如：中国 · 上海"
              />

              <button
                className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                onClick={saveProfileFields}
              >
                保存城市与地址
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-slate-900/70 p-3 text-sm">
              {weatherLoading ? <p>天气加载中...</p> : null}
              {!weatherLoading && weatherError ? (
                <p className="text-amber-200">{weatherError}</p>
              ) : null}
              {!weatherLoading && weather ? (
                <div className="space-y-1">
                  <p className="font-medium">{weather.cityName}</p>
                  <p>
                    {weather.weatherText} · {weather.temperature.toFixed(1)}°C
                  </p>
                  <p className="text-slate-300">风速 {weather.windSpeed.toFixed(1)} km/h</p>
                </div>
              ) : null}
              <p className="mt-2 text-xs text-slate-400">地址：{config.address}</p>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur lg:col-span-2">
            <h2 className="text-base font-semibold">搜索</h2>
            <p className="mt-1 text-xs text-slate-300">支持切换和自定义搜索引擎（模板需包含 %s）。</p>

            <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
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

              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                className="flex-1 rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
                placeholder="输入关键词后回车搜索"
              />

              <button
                type="submit"
                className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-400"
              >
                搜索
              </button>
            </form>

            <details className="mt-4 rounded-xl bg-slate-900/70 p-3">
              <summary className="cursor-pointer text-sm font-medium">管理搜索引擎</summary>

              <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={handleEngineSubmit}>
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

              {engineFormError ? (
                <p className="mt-2 text-sm text-amber-200">{engineFormError}</p>
              ) : null}

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
                        className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                        onClick={() => editEngine(engine)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        className="rounded-md bg-red-500/70 px-2 py-1 text-xs hover:bg-red-400"
                        onClick={() => removeEngine(engine.id)}
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          </article>
        </div>

        <article className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur">
          <h2 className="text-base font-semibold">书签</h2>
          <p className="mt-1 text-xs text-slate-300">支持自动图标、手动图标、编辑与删除。</p>

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
              placeholder="图标（可填 emoji 或图片 URL）"
              value={bookmarkForm.icon}
              onChange={(event) =>
                setBookmarkForm((prev) => ({ ...prev, icon: event.target.value }))
              }
            />
            <button
              type="submit"
              className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400"
            >
              {bookmarkForm.id ? '更新书签' : '新增书签'}
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
                    <BookmarkIcon bookmark={bookmark} />
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
