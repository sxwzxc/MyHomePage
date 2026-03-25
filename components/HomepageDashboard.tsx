'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bookmark, HomepageConfig, DEFAULT_HOMEPAGE_CONFIG } from '@/lib/homepage-config';
import { ClientInfo, getClientInfo, getHomepageConfig, getVisitCount } from '@/lib/utils';

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
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [now, setNow] = useState(() => new Date());

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
        const [homepageConfig, count, info] = await Promise.all([
          getHomepageConfig(),
          getVisitCount().catch(() => null),
          getClientInfo().catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        setConfig(homepageConfig);
        setSelectedEngineId(homepageConfig.defaultSearchEngineId);
        setVisitCount(count);
        setClientInfo(info);
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
    window.location.href = `/settings?editBookmark=${encodeURIComponent(bookmark.id)}`;
  };

  if (isLoading) {
    return (
      <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12">
        <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-5 text-white shadow-xl backdrop-blur-sm">
          正在加载主页配置...
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
              <p className="mt-1 text-sm text-slate-200/90">简洁模式：展示优先，设置集中管理。</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-black/25 px-4 py-3 text-sm">
                <p>{now.toLocaleDateString('zh-CN', { weekday: 'long' })}</p>
                <p className="text-lg font-semibold">
                  {now.toLocaleTimeString('zh-CN', { hour12: false })}
                </p>
              </div>
              <Link
                href="/settings"
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400"
              >
                设置
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <p>📍 地址：{config.address || '未设置'}</p>
            <p>🌐 IP：{clientInfo?.ip || '未知'}</p>
            <p>🧭 位置：{clientInfo?.location || '未知'}</p>
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

        <article className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
            <select
              className="rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              value={selectedEngineId}
              onChange={(event) => setSelectedEngineId(event.target.value)}
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
        </article>

        <article className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur">
          <h2 className="text-base font-semibold">书签</h2>
          <p className="mt-1 text-xs text-slate-300">右键书签卡片可快速进入编辑。</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {config.bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                onContextMenu={(event) => handleBookmarkContextMenu(event, bookmark)}
                className="group rounded-xl border border-white/10 bg-slate-900/70 p-3 transition hover:border-cyan-400/60"
              >
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                    <BookmarkIcon bookmark={bookmark} />
                  </div>
                  <h3 className="truncate font-medium">{bookmark.title}</h3>
                  <p className="truncate text-xs text-slate-400">{bookmark.url}</p>
                </a>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
