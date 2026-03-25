'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Settings, Search, ChevronDown, Bookmark as BookmarkIcon, MoreVertical } from 'lucide-react';
import { Bookmark, HomepageConfig, DEFAULT_HOMEPAGE_CONFIG } from '@/lib/homepage-config';
import { getHomepageConfig, getVisitCount, saveHomepageConfig, fetchBookmarkFavicon } from '@/lib/utils';
import ContextMenu, { ContextMenuItem } from '@/components/ui/context-menu';
import AnimatedBackground from '@/components/AnimatedBackground';

type WeatherInfo = {
  cityName: string;
  temperature: number;
  weatherText: string;
};

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
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&timezone=auto`
  );

  if (!weatherRes.ok) {
    throw new Error('天气服务暂不可用');
  }

  const weatherData = (await weatherRes.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
    };
  };

  if (!weatherData.current) {
    throw new Error('天气数据为空');
  }

  return {
    cityName: place.name,
    temperature: Number(weatherData.current.temperature_2m ?? 0),
    weatherText: weatherCodeToText(Number(weatherData.current.weather_code ?? 0)),
  };
}

function BookmarkIcon({ bookmark }: { bookmark: Bookmark }) {
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

export default function HomepageDashboard() {
  const [config, setConfig] = useState<HomepageConfig>(DEFAULT_HOMEPAGE_CONFIG);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedEngineId, setSelectedEngineId] = useState(
    DEFAULT_HOMEPAGE_CONFIG.defaultSearchEngineId
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visitCount, setVisitCount] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [contextMenu, setContextMenu] = useState<{
    bookmark: Bookmark;
    x: number;
    y: number;
  } | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ title: '', url: '' });
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);

  const selectedEngine = useMemo(() => {
    return (
      config.searchEngines.find((engine) => engine.id === selectedEngineId) ??
      config.searchEngines[0]
    );
  }, [config.searchEngines, selectedEngineId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [homepageConfig, count] = await Promise.all([
          getHomepageConfig(),
          getVisitCount().catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        setConfig(homepageConfig);
        setSelectedEngineId(homepageConfig.defaultSearchEngineId);
        setVisitCount(count);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : '加载失败');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      if (!config.weatherCity.trim()) {
        setWeather(null);
        return;
      }

      try {
        const result = await fetchWeatherByCity(config.weatherCity.trim());
        if (!cancelled) {
          setWeather(result);
          setWeatherError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setWeather(null);
          setWeatherError(error instanceof Error ? error.message : '天气获取失败');
        }
      }
    }

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, [config.weatherCity]);

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

  const handleBookmarkContextMenu = (
    event: React.MouseEvent<HTMLDivElement>,
    bookmark: Bookmark
  ) => {
    event.preventDefault();
    setContextMenu({
      bookmark,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleEditBookmark = (bookmark: Bookmark) => {
    window.location.href = `/settings?editBookmark=${encodeURIComponent(bookmark.id)}`;
  };

  const handleDeleteBookmark = async (bookmark: Bookmark) => {
    if (!confirm(`确定要删除书签"${bookmark.title}"吗？`)) {
      return;
    }

    try {
      const nextConfig = {
        ...config,
        bookmarks: config.bookmarks.filter((b) => b.id !== bookmark.id),
        updatedAt: new Date().toISOString(),
      };
      await saveHomepageConfig(nextConfig);
      setConfig(nextConfig);
    } catch (error) {
      alert('删除失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const handleQuickAddBookmark = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuickAddError(null);

    const title = quickAddForm.title.trim();
    if (!title) {
      setQuickAddError('书签标题不能为空');
      return;
    }

    let normalizedUrl = '';
    try {
      normalizedUrl = new URL(quickAddForm.url.trim()).toString();
    } catch {
      setQuickAddError('请输入合法的 URL');
      return;
    }

    setIsAddingBookmark(true);
    try {
      // Fetch favicon
      const favicon = await fetchBookmarkFavicon(normalizedUrl).catch(() => null);

      // Create new bookmark
      const newBookmark: Bookmark = {
        id: `bookmark_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title,
        url: normalizedUrl,
        icon: favicon || undefined,
      };

      // Save to config
      const nextConfig = {
        ...config,
        bookmarks: [...config.bookmarks, newBookmark],
        updatedAt: new Date().toISOString(),
      };

      await saveHomepageConfig(nextConfig);
      setConfig(nextConfig);

      // Reset form
      setQuickAddForm({ title: '', url: '' });
      setShowQuickAdd(false);
    } catch (error) {
      setQuickAddError(error instanceof Error ? error.message : '添加失败');
    } finally {
      setIsAddingBookmark(false);
    }
  };

  if (isLoading) {
    return (
      <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12">
        <AnimatedBackground config={DEFAULT_HOMEPAGE_CONFIG.background} />
        <div className="relative rounded-2xl border border-white/20 bg-white/10 px-6 py-5 text-white shadow-xl backdrop-blur-sm">
          正在加载主页配置...
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen overflow-hidden px-4 py-8 text-slate-100 sm:px-6 lg:px-10">
      <AnimatedBackground config={config.background} />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="relative rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
          {/* Settings Icon - Absolute positioned */}
          <Link
            href="/settings"
            className="absolute right-6 top-6 rounded-lg bg-white/10 p-2 text-slate-300 transition hover:bg-white/20 hover:text-white"
            title="设置"
          >
            <Settings className="h-5 w-5" />
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                我的浏览器起始页
              </h1>
              <p className="mt-1 text-sm text-slate-200/90">简洁高效的个人起始页</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-black/25 px-4 py-3 text-sm">
                <p>{now.toLocaleDateString('zh-CN', { weekday: 'long' })}</p>
                <p className="text-lg font-semibold">
                  {now.toLocaleTimeString('zh-CN', { hour12: false })}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
            <p>📍 地址：{config.address || '未设置'}</p>
            <p>👁️ 访问：{visitCount ?? '-'}</p>
          </div>

          <div className="mt-3 text-xs text-slate-300">
            {weather ? (
              <p>
                🌤 {weather.cityName} · {weather.weatherText} · {weather.temperature.toFixed(1)}°C
              </p>
            ) : weatherError ? (
              <p className="text-amber-200">天气：{weatherError}</p>
            ) : (
              <p>天气加载中...</p>
            )}
          </div>

          {loadError ? (
            <p className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">
              配置加载异常：{loadError}
            </p>
          ) : null}
        </header>

        <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/25 to-black/15 p-5 shadow-lg backdrop-blur">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSearch}>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-xl border border-white/20 bg-slate-900/70 py-3 pl-3 pr-8 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                value={selectedEngineId}
                onChange={(event) => setSelectedEngineId(event.target.value)}
              >
                {config.searchEngines.map((engine) => (
                  <option key={engine.id} value={engine.id}>
                    {engine.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                className="w-full rounded-xl border border-white/20 bg-slate-900/70 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                placeholder="输入关键词后回车搜索..."
              />
            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-6 py-3 text-sm font-medium text-white transition hover:from-cyan-400 hover:to-fuchsia-400 hover:shadow-lg hover:shadow-fuchsia-500/20"
            >
              <Search className="h-4 w-4" />
              搜索
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/25 to-black/15 p-5 shadow-lg backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <BookmarkIcon className="h-5 w-5 text-cyan-400" />
                书签收藏
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                右键点击书签可进行编辑或删除
              </p>
            </div>
            <span className="rounded-full bg-slate-800/50 px-2 py-1 text-xs text-slate-500">
              {config.bookmarks.length} 个书签
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Quick Add Card */}
            {showQuickAdd ? (
              <div className="rounded-xl border-2 border-dashed border-cyan-400/60 bg-slate-900/70 p-3">
                <form onSubmit={handleQuickAddBookmark}>
                  <input
                    type="text"
                    placeholder="书签标题"
                    value={quickAddForm.title}
                    onChange={(e) =>
                      setQuickAddForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="mb-2 w-full rounded-lg border border-white/20 bg-slate-800/70 px-2 py-1 text-sm outline-none focus:border-cyan-400"
                    autoFocus
                  />
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={quickAddForm.url}
                    onChange={(e) =>
                      setQuickAddForm((prev) => ({ ...prev, url: e.target.value }))
                    }
                    className="mb-2 w-full rounded-lg border border-white/20 bg-slate-800/70 px-2 py-1 text-sm outline-none focus:border-cyan-400"
                  />
                  {quickAddError && (
                    <p className="mb-2 text-xs text-red-300">{quickAddError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isAddingBookmark}
                      className="flex-1 rounded-lg bg-cyan-500 px-2 py-1 text-xs font-medium text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
                    >
                      {isAddingBookmark ? '添加中...' : '添加'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickAdd(false);
                        setQuickAddForm({ title: '', url: '' });
                        setQuickAddError(null);
                      }}
                      className="rounded-lg bg-white/10 px-2 py-1 text-xs transition hover:bg-white/20"
                    >
                      取消
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                onClick={() => setShowQuickAdd(true)}
                className="group rounded-xl border-2 border-dashed border-white/30 bg-slate-900/50 p-3 transition hover:border-cyan-400/60 hover:bg-slate-900/70"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 transition group-hover:bg-cyan-500/30">
                  <Plus className="h-6 w-6" />
                </div>
                <h3 className="font-medium text-slate-300">添加书签</h3>
                <p className="text-xs text-slate-400">快速添加新书签</p>
              </button>
            )}

            {/* Existing Bookmarks */}
            {config.bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                onContextMenu={(event) => handleBookmarkContextMenu(event, bookmark)}
                className="group relative rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-800/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-500/20"
              >
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 transition group-hover:scale-110">
                    <BookmarkIcon bookmark={bookmark} />
                  </div>
                  <h3 className="truncate font-medium text-slate-100 transition group-hover:text-cyan-400">
                    {bookmark.title}
                  </h3>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {new URL(bookmark.url).hostname}
                  </p>
                </a>

                {/* Quick action hint */}
                <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </article>

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={[
              {
                label: '编辑',
                icon: <Pencil className="h-3 w-3" />,
                onClick: () => handleEditBookmark(contextMenu.bookmark),
              },
              {
                label: '删除',
                icon: <Trash2 className="h-3 w-3" />,
                onClick: () => handleDeleteBookmark(contextMenu.bookmark),
                variant: 'danger' as const,
              },
            ]}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </section>
  );
}
