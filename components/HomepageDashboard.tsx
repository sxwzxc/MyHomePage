'use client';

import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Pencil,
  Trash2,
  Plus,
  Settings,
  Search,
  Bookmark as BookmarkIcon,
  MoreVertical,
  Loader2,
  X,
} from 'lucide-react';
import { Bookmark, HomepageConfig, DEFAULT_HOMEPAGE_CONFIG } from '@/lib/homepage-config';
import {
  getHomepageConfig,
  getVisitCount,
  saveHomepageConfig,
  fetchBookmarkFavicon,
  verifyUnlockPassword,
} from '@/lib/utils';
import { isSettingsUnlocked, saveSettingsUnlock } from '@/lib/unlock-state';
import ContextMenu from '@/components/ui/context-menu';
import AnimatedBackground from '@/components/AnimatedBackground';
import AnalogClock from '@/components/AnalogClock';
import NewsSection from '@/components/NewsSection';

type WeatherInfo = {
  cityName: string;
  temperature: number;
  weatherText: string;
};

type BookmarkEditFormState = {
  id: string;
  title: string;
  url: string;
  icon: string;
  isCustomIcon: boolean;
};

function isCustomIconBookmark(bookmark: Bookmark): boolean {
  if (bookmark.isCustomIcon) {
    return true;
  }

  const icon = bookmark.icon?.trim() || '';
  return Boolean(icon && !icon.startsWith('http') && !icon.startsWith('data:'));
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

function BookmarkAvatar({ bookmark }: { bookmark: Bookmark }) {
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
  const router = useRouter();
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
  const [isSettingHomepage, setIsSettingHomepage] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('请输入密码以解锁设置功能');
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlockVerifying, setIsUnlockVerifying] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<BookmarkEditFormState>({
    id: '',
    title: '',
    url: '',
    icon: '',
    isCustomIcon: false,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isFetchingEditIcon, setIsFetchingEditIcon] = useState(false);
  const [draggingBookmarkId, setDraggingBookmarkId] = useState<string | null>(null);
  const autoFaviconRefreshRunningRef = useRef(false);
  const pendingUnlockActionRef = useRef<null | (() => void)>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickSearchKeywords = ['AI 工具', '天气预报', '开源趋势', '美食推荐'];

  const selectedEngine = useMemo(() => {
    return (
      config.searchEngines.find((engine) => engine.id === selectedEngineId) ??
      config.searchEngines[0]
    );
  }, [config.searchEngines, selectedEngineId]);

  const isCompactMode = config.bookmarkLayoutMode === 'compact';
  const totalBookmarkCards = config.bookmarks.length + 1;
  const desiredColumns = Math.max(1, Math.min(6, Math.round(config.bookmarkColumns || 4)));
  const desktopColumns = Math.max(1, Math.min(desiredColumns, totalBookmarkCards));
  const tabletColumns = Math.max(
    1,
    Math.min(Math.min(desiredColumns, 3), totalBookmarkCards)
  );
  const mobileColumns = Math.max(
    1,
    Math.min(Math.min(desiredColumns, 2), totalBookmarkCards)
  );
  const bookmarkGridStyle = {
    '--bookmark-cols-mobile': String(mobileColumns),
    '--bookmark-cols-sm': String(tabletColumns),
    '--bookmark-cols-lg': String(desktopColumns),
  } as unknown as CSSProperties;
  const bookmarkTitleClass =
    desiredColumns >= 6
      ? 'text-[12px]'
      : desiredColumns >= 5
        ? 'text-[13px]'
        : desiredColumns >= 4
          ? 'text-sm'
          : 'text-base';
  const bookmarkMetaClass =
    desiredColumns >= 5 ? 'text-[11px]' : 'text-xs';

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

  useEffect(() => {
    const nextTitle = config.browserTitle?.trim() || 'HomePage';
    document.title = nextTitle;

    return () => {
      document.title = 'HomePage';
    };
  }, [config.browserTitle]);

  useEffect(() => {
    setIsUnlocked(isSettingsUnlocked());
  }, []);

  useEffect(() => {
    if (isLoading || autoFaviconRefreshRunningRef.current) {
      return;
    }

    if (!config.faviconAutoRefreshEnabled) {
      return;
    }

    const intervalMinutes = Math.max(
      1,
      Math.round(config.faviconAutoRefreshMinutes || 60)
    );
    const lastRefreshTimestamp = Date.parse(
      config.faviconLastRefreshAt || new Date(0).toISOString()
    );
    const elapsed = Date.now() - (Number.isFinite(lastRefreshTimestamp) ? lastRefreshTimestamp : 0);

    if (elapsed < intervalMinutes * 60 * 1000) {
      return;
    }

    autoFaviconRefreshRunningRef.current = true;

    void (async () => {
      try {
        const refreshedBookmarks = await Promise.all(
          config.bookmarks.map(async (bookmark) => {
            if (isCustomIconBookmark(bookmark)) {
              return bookmark;
            }

            const fetchedIcon = await fetchBookmarkFavicon(bookmark.url);
            if (!fetchedIcon) {
              return bookmark;
            }

            return {
              ...bookmark,
              icon: fetchedIcon,
              isCustomIcon: false,
            };
          })
        );

        const nextConfig: HomepageConfig = {
          ...config,
          bookmarks: refreshedBookmarks,
          faviconLastRefreshAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const saved = await saveHomepageConfig(nextConfig);
        setConfig(saved);
      } catch {
        // Ignore background refresh errors to avoid interrupting normal browsing.
      } finally {
        autoFaviconRefreshRunningRef.current = false;
      }
    })();
  }, [
    config,
    isLoading,
    autoFaviconRefreshRunningRef,
  ]);

  const markHomepageConfigured = async () => {
    const nextConfig: HomepageConfig = {
      ...config,
      homepageConfigured: true,
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveHomepageConfig(nextConfig);
    setConfig(saved);
  };

  const openUnlockModal = (reason: string, actionAfterUnlock?: () => void) => {
    setUnlockReason(reason);
    setUnlockPasswordInput('');
    setUnlockError(null);
    pendingUnlockActionRef.current = actionAfterUnlock || null;
    setShowUnlockModal(true);
  };

  const ensureUnlocked = (reason: string, actionAfterUnlock?: () => void) => {
    if (isUnlocked) {
      return true;
    }

    openUnlockModal(reason, actionAfterUnlock);
    return false;
  };

  const handleUnlockSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isUnlockVerifying) {
      return;
    }

    const password = unlockPasswordInput.trim();
    if (!password) {
      setUnlockError('请输入密码');
      return;
    }

    setIsUnlockVerifying(true);
    const verified = await verifyUnlockPassword(password);
    setIsUnlockVerifying(false);

    if (!verified) {
      setUnlockError('密码错误，请重试');
      return;
    }

    saveSettingsUnlock();
    setIsUnlocked(true);
    setShowUnlockModal(false);

    const pendingAction = pendingUnlockActionRef.current;
    pendingUnlockActionRef.current = null;

    if (pendingAction) {
      pendingAction();
    }
  };

  const handleSetHomepage = async () => {
    if (isSettingHomepage) {
      return;
    }

    setIsSettingHomepage(true);
    const currentUrl = window.location.href;
    let autoSuccess = false;

    try {
      const body = document.body as unknown as {
        style?: { behavior?: string };
        setHomePage?: (url: string) => void;
      };

      if (body?.style) {
        body.style.behavior = 'url(#default#homepage)';
      }

      if (typeof body?.setHomePage === 'function') {
        body.setHomePage(currentUrl);
        autoSuccess = true;
      }
    } catch {
      autoSuccess = false;
    }

    if (autoSuccess) {
      try {
        await markHomepageConfigured();
        alert('已尝试将当前页面设为主页。');
      } catch (error) {
        alert(`已执行设为主页，但同步状态失败：${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        setIsSettingHomepage(false);
      }
      return;
    }

    const manualDone = window.confirm(
      `自动设为主页失败（多数现代浏览器限制此能力）。\n\n请在浏览器设置中将当前网址设为主页：\n${currentUrl}\n\n完成后点击“确定”，我将不再提示。`
    );

    if (manualDone) {
      try {
        await markHomepageConfigured();
      } catch (error) {
        alert(`状态保存失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    setIsSettingHomepage(false);
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

  const openBookmarkMenu = (bookmark: Bookmark, x: number, y: number) => {
    setContextMenu({ bookmark, x, y });
  };

  const handleBookmarkContextMenu = (
    event: React.MouseEvent<HTMLDivElement>,
    bookmark: Bookmark
  ) => {
    event.preventDefault();

    if (!ensureUnlocked('解锁后可编辑或删除书签')) {
      return;
    }

    openBookmarkMenu(bookmark, event.clientX, event.clientY);
  };

  const handleBookmarkMenuButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    bookmark: Bookmark
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!ensureUnlocked('解锁后可编辑或删除书签')) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    openBookmarkMenu(bookmark, rect.right - 8, rect.bottom + 6);
  };

  const handleEditBookmark = (bookmark: Bookmark) => {
    if (!ensureUnlocked('解锁后可编辑书签')) {
      return;
    }

    setEditForm({
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      icon: bookmark.icon || '',
      isCustomIcon: isCustomIconBookmark(bookmark),
    });
    setEditError(null);
    setIsEditDialogOpen(true);
  };

  const handleEditBookmarkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditError(null);

    const title = editForm.title.trim();
    const iconInput = editForm.icon.trim();

    if (!title) {
      setEditError('书签标题不能为空');
      return;
    }

    let normalizedUrl = '';
    try {
      normalizedUrl = new URL(editForm.url.trim()).toString();
    } catch {
      setEditError('请输入合法的 URL');
      return;
    }

    setIsSavingEdit(true);

    let finalIcon = iconInput;
    let finalIsCustomIcon = iconInput ? editForm.isCustomIcon : false;

    if (!finalIcon) {
      setIsFetchingEditIcon(true);
      const fetchedIcon = await fetchBookmarkFavicon(normalizedUrl);
      setIsFetchingEditIcon(false);

      if (fetchedIcon) {
        finalIcon = fetchedIcon;
      }

      finalIsCustomIcon = false;
    }

    try {
      const nextConfig: HomepageConfig = {
        ...config,
        bookmarks: config.bookmarks.map((bookmark) =>
          bookmark.id === editForm.id
            ? {
                ...bookmark,
                title,
                url: normalizedUrl,
                icon: finalIcon || undefined,
                isCustomIcon: finalIcon ? finalIsCustomIcon : false,
              }
            : bookmark
        ),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveHomepageConfig(nextConfig);
      setConfig(saved);
      setIsEditDialogOpen(false);
      setEditForm({
        id: '',
        title: '',
        url: '',
        icon: '',
        isCustomIcon: false,
      });
    } catch (error) {
      setEditError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteBookmark = async (bookmark: Bookmark) => {
    if (!ensureUnlocked('解锁后可删除书签')) {
      return;
    }

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

    if (!ensureUnlocked('解锁后可添加书签')) {
      return;
    }

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
    const newBookmarkId = `bookmark_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newBookmark: Bookmark = {
      id: newBookmarkId,
      title,
      url: normalizedUrl,
      icon: undefined,
      isCustomIcon: false,
    };

    const optimisticConfig: HomepageConfig = {
      ...config,
      bookmarks: [...config.bookmarks, newBookmark],
      updatedAt: new Date().toISOString(),
    };

    setConfig(optimisticConfig);
    setQuickAddForm({ title: '', url: '' });
    setShowQuickAdd(false);
    setIsAddingBookmark(false);

    try {
      const savedConfig = await saveHomepageConfig(optimisticConfig);
      setConfig(savedConfig);

      void (async () => {
        const fetchedIcon = await fetchBookmarkFavicon(normalizedUrl);
        if (!fetchedIcon) {
          return;
        }

        try {
          const withIconConfig: HomepageConfig = {
            ...savedConfig,
            bookmarks: savedConfig.bookmarks.map((bookmark) =>
              bookmark.id === newBookmarkId
                ? {
                    ...bookmark,
                    icon: fetchedIcon,
                    isCustomIcon: false,
                  }
                : bookmark
            ),
            updatedAt: new Date().toISOString(),
          };

          const iconSaved = await saveHomepageConfig(withIconConfig);
          setConfig(iconSaved);
        } catch {
          // Keep initial letter fallback when icon sync fails.
        }
      })();
    } catch (error) {
      setQuickAddError(
        `已添加到当前页面，但同步失败：${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  };

  const handleSettingsClick = () => {
    if (isUnlocked) {
      router.push('/settings');
      return;
    }

    openUnlockModal('请输入密码后进入设置页', () => {
      router.push('/settings');
    });
  };

  const handleBookmarkDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    bookmarkId: string
  ) => {
    if (!ensureUnlocked('解锁后可拖拽排序书签')) {
      event.preventDefault();
      return;
    }

    setDraggingBookmarkId(bookmarkId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', bookmarkId);
  };

  const handleBookmarkDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    bookmarkId: string
  ) => {
    if (!isUnlocked || !draggingBookmarkId || draggingBookmarkId === bookmarkId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleBookmarkDragEnd = () => {
    setDraggingBookmarkId(null);
  };

  const handleBookmarkDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    targetBookmarkId: string
  ) => {
    event.preventDefault();

    if (!isUnlocked || !draggingBookmarkId || draggingBookmarkId === targetBookmarkId) {
      setDraggingBookmarkId(null);
      return;
    }

    const fromIndex = config.bookmarks.findIndex((item) => item.id === draggingBookmarkId);
    const toIndex = config.bookmarks.findIndex((item) => item.id === targetBookmarkId);

    if (fromIndex < 0 || toIndex < 0) {
      setDraggingBookmarkId(null);
      return;
    }

    const reorderedBookmarks = [...config.bookmarks];
    const [movedBookmark] = reorderedBookmarks.splice(fromIndex, 1);
    reorderedBookmarks.splice(toIndex, 0, movedBookmark);

    const previousConfig = config;
    const nextConfig: HomepageConfig = {
      ...config,
      bookmarks: reorderedBookmarks,
      updatedAt: new Date().toISOString(),
    };

    setConfig(nextConfig);
    setDraggingBookmarkId(null);

    try {
      const saved = await saveHomepageConfig(nextConfig);
      setConfig(saved);
    } catch (error) {
      setConfig(previousConfig);
      alert(`排序保存失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleNewsConfigChange = async (
    patch: Partial<HomepageConfig['news']>
  ) => {
    const previousConfig = config;
    const nextConfig: HomepageConfig = {
      ...config,
      news: {
        ...config.news,
        ...patch,
      },
      updatedAt: new Date().toISOString(),
    };

    setConfig(nextConfig);

    try {
      const saved = await saveHomepageConfig(nextConfig);
      setConfig(saved);
    } catch (error) {
      setConfig(previousConfig);
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
    <section className="relative min-h-screen overflow-hidden px-4 py-8 text-white sm:px-6 lg:px-10">
      <AnimatedBackground config={config.background} />

      <div className="fixed right-4 top-4 z-30 flex items-center gap-2 sm:right-6 sm:top-6">
        {!config.homepageConfigured ? (
          <button
            type="button"
            onClick={handleSetHomepage}
            disabled={isSettingHomepage}
            className="text-shadow-soft rounded-xl border border-white/20 bg-slate-950/75 px-3 py-2 text-xs text-white shadow-lg backdrop-blur transition hover:border-white/60 hover:bg-slate-900/85 disabled:opacity-60"
          >
            {isSettingHomepage ? '设置中...' : '设为主页'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleSettingsClick}
          className="rounded-xl border border-white/20 bg-slate-950/70 p-2 text-white shadow-lg backdrop-blur transition hover:border-white/60 hover:bg-slate-900/80"
          title="设置"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="relative rounded-3xl border border-white/15 bg-slate-900/50 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-3xl border border-white/20 bg-white/10 p-3 shadow-lg">
                <AnalogClock time={now} size={132} />
              </div>

              <div>
                <h1 className="text-shadow-title text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {config.pageTitle}
                </h1>
                <p className="text-shadow-soft mt-1 text-sm text-white/95">{config.pageSubtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-white/95">
              <span className="text-shadow-soft rounded-full border border-white/20 bg-slate-950/60 px-3 py-1.5">
                {weather
                  ? `🌤 ${weather.cityName} · ${weather.weatherText} · ${weather.temperature.toFixed(1)}°C`
                  : weatherError
                    ? `🌤 ${weatherError}`
                    : '🌤 天气加载中...'}
              </span>
              <span className="text-shadow-soft rounded-full border border-white/20 bg-slate-950/60 px-3 py-1.5">
                👁️ 访问：{visitCount ?? '-'}
              </span>
              <div className="rounded-2xl border border-white/15 bg-slate-950/55 px-4 py-3 text-sm text-white">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-shadow-soft text-xs text-white/85">
                      {now.toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-shadow-soft text-xs text-white/80">
                      {now.toLocaleDateString('zh-CN', { weekday: 'long' })}
                    </p>
                    <p className="text-shadow-title text-lg font-semibold">
                      {now.toLocaleTimeString('zh-CN', { hour12: false })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loadError ? (
            <p className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">
              配置加载异常：{loadError}
            </p>
          ) : null}
        </header>

        <article className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900/75 via-slate-900/55 to-slate-900/35 p-6 shadow-xl backdrop-blur">
          <div className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.16),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(236,72,153,0.12),transparent_32%)]" />
          </div>

          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">
                  Multi-engine Search
                </p>
                <h2 className="text-shadow-title text-xl font-semibold text-white">
                  想搜点什么？
                </h2>
                <p className="text-sm text-white/80">
                  支持 {config.searchEngines.length} 个搜索引擎，回车即可跳转。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {config.searchEngines.map((engine) => (
                  <button
                    key={engine.id}
                    type="button"
                    onClick={() => setSelectedEngineId(engine.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selectedEngineId === engine.id
                        ? 'border-white bg-white text-slate-900 shadow-sm'
                        : 'border-white/25 bg-white/5 text-white hover:border-white/60 hover:bg-white/15'
                    }`}
                    aria-pressed={selectedEngineId === engine.id}
                  >
                    {engine.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSearch}>
              <div className="group relative flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-950/70 px-4 py-4 shadow-[0_10px_40px_rgba(15,23,42,0.45)] backdrop-blur">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-cyan-300 transition group-focus-within:bg-white/20">
                  <Search className="h-5 w-5" />
                </div>
                <input
                  ref={searchInputRef}
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  className="w-full bg-transparent text-base text-white placeholder:text-white/60 outline-none"
                  placeholder={`使用 ${selectedEngine?.name ?? '搜索引擎'} 搜索...`}
                />
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:from-cyan-300 hover:to-blue-400"
                >
                  搜索
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-xs text-white/85">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                Enter / 回车快速搜索
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                当前引擎：{selectedEngine?.name}
              </span>
              {quickSearchKeywords.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => {
                    setSearchKeyword(keyword);
                    searchInputRef.current?.focus();
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/85 transition hover:border-white/40 hover:bg-white/15"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-white/15 bg-slate-900/50 p-5 shadow-lg backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-shadow-title flex items-center gap-2 text-lg font-semibold text-white">
                <BookmarkIcon className="h-5 w-5 text-white" />
                书签收藏
              </h2>
              <p className="text-shadow-soft mt-1 text-xs text-white/85">
                支持右键和菜单按钮快速编辑；布局可在设置页调整。
              </p>
            </div>
            <span className="text-shadow-soft rounded-full border border-white/20 bg-slate-950/50 px-2 py-1 text-xs text-white/80">
              {config.bookmarks.length} 个书签
            </span>
          </div>

          <div className="bookmark-grid mt-4" style={bookmarkGridStyle}>
            {config.bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                draggable={isUnlocked}
                onDragStart={(event) => handleBookmarkDragStart(event, bookmark.id)}
                onDragOver={(event) => handleBookmarkDragOver(event, bookmark.id)}
                onDrop={(event) => handleBookmarkDrop(event, bookmark.id)}
                onDragEnd={handleBookmarkDragEnd}
                onContextMenu={(event) => handleBookmarkContextMenu(event, bookmark)}
                className={`group relative rounded-xl border border-white/15 bg-slate-950/45 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/45 hover:shadow-md ${
                  draggingBookmarkId === bookmark.id ? 'opacity-60' : ''
                } ${
                  isCompactMode ? 'p-3' : 'p-4'
                }`}
              >
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={isCompactMode ? 'flex items-center gap-3' : 'block'}
                >
                  <div
                    className={`flex items-center justify-center rounded-xl bg-white/10 ${
                      isCompactMode
                        ? 'h-12 w-12 shrink-0'
                        : 'mb-3 h-14 w-14 transition group-hover:scale-105'
                    }`}
                  >
                    <BookmarkAvatar bookmark={bookmark} />
                  </div>
                  <div className={isCompactMode ? 'min-w-0 flex-1' : ''}>
                    <h3 className={`text-shadow-soft truncate font-medium text-white ${bookmarkTitleClass}`}>
                      {bookmark.title}
                    </h3>
                    <p className={`truncate text-white/70 ${bookmarkMetaClass}`}>
                      {new URL(bookmark.url).hostname}
                    </p>
                  </div>
                </a>

                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-md p-1 text-white/60 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                  onClick={(event) => handleBookmarkMenuButtonClick(event, bookmark)}
                  aria-label="打开书签菜单"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            ))}

            {showQuickAdd ? (
              <div className="rounded-xl border border-dashed border-white/40 bg-slate-950/50 p-3">
                <form onSubmit={handleQuickAddBookmark}>
                  <input
                    type="text"
                    placeholder="书签标题"
                    value={quickAddForm.title}
                    onChange={(e) =>
                      setQuickAddForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="mb-2 w-full rounded-lg border border-white/20 bg-slate-900/70 px-2 py-1.5 text-sm text-white outline-none focus:border-white/60"
                    autoFocus
                  />
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={quickAddForm.url}
                    onChange={(e) =>
                      setQuickAddForm((prev) => ({ ...prev, url: e.target.value }))
                    }
                    className="mb-2 w-full rounded-lg border border-white/20 bg-slate-900/70 px-2 py-1.5 text-sm text-white outline-none focus:border-white/60"
                  />
                  {quickAddError ? (
                    <p className="mb-2 text-xs text-amber-200">{quickAddError}</p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isAddingBookmark}
                      className="flex-1 rounded-lg border border-white/25 bg-white/10 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
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
                      className="rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white transition hover:bg-white/20"
                    >
                      取消
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!ensureUnlocked('解锁后可添加书签')) {
                    return;
                  }

                  setShowQuickAdd(true);
                }}
                className={`group rounded-xl border border-dashed border-white/35 bg-slate-950/45 transition hover:border-white/65 hover:bg-slate-900/65 ${
                  isCompactMode
                    ? 'flex items-center gap-3 p-3 text-left'
                    : 'flex flex-col items-center justify-center gap-2 p-3 text-center'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white/90 transition group-hover:bg-white/20">
                  <Plus className="h-6 w-6" />
                </div>
                <div className={isCompactMode ? 'min-w-0 flex-1' : ''}>
                  <h3 className={`text-shadow-soft font-medium text-white ${bookmarkTitleClass}`}>添加书签</h3>
                  <p className={`text-white/75 ${bookmarkMetaClass}`}>快速添加新书签</p>
                </div>
              </button>
            )}
          </div>
        </article>

        <NewsSection
          enabled={config.news.enabled}
          defaultCollapsed={config.news.collapsed}
          sourceMode={config.news.sourceMode}
          sourceId={config.news.sourceId}
          limit={config.news.limit}
          onConfigChange={handleNewsConfigChange}
        />

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

        {isEditDialogOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-slate-900/95 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">编辑书签</h3>
                <button
                  type="button"
                  onClick={() => {
                    if (isSavingEdit) {
                      return;
                    }
                    setIsEditDialogOpen(false);
                  }}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
                  aria-label="关闭编辑弹窗"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form className="space-y-3" onSubmit={handleEditBookmarkSubmit}>
                <input
                  className="w-full rounded-lg border border-white/20 bg-slate-800/80 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
                  placeholder="书签标题"
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                />

                <input
                  className="w-full rounded-lg border border-white/20 bg-slate-800/80 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
                  placeholder="URL，例如 https://example.com"
                  value={editForm.url}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, url: event.target.value }))
                  }
                />

                <input
                  className="w-full rounded-lg border border-white/20 bg-slate-800/80 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
                  placeholder="图标（可空，自动抓取）"
                  value={editForm.icon}
                  onChange={(event) => {
                    const nextIcon = event.target.value;
                    setEditForm((prev) => ({
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

                <label className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-slate-800/70 px-3 py-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={editForm.isCustomIcon}
                    disabled={!editForm.icon.trim()}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, isCustomIcon: event.target.checked }))
                    }
                  />
                  自定义图标（批量刷新自动图标时会跳过）
                </label>

                {editError ? <p className="text-sm text-amber-200">{editError}</p> : null}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={isSavingEdit}
                    className="rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/20 disabled:opacity-60"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400 disabled:opacity-70"
                  >
                    {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isFetchingEditIcon ? '抓取图标中...' : isSavingEdit ? '保存中...' : '保存修改'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {showUnlockModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900/95 p-5 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">请输入访问密码</h3>
                  <p className="mt-1 text-sm text-slate-300">{unlockReason}</p>
                  <p className="mt-1 text-xs text-slate-400">验证成功后 30 天内无需重复输入。</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isUnlockVerifying) {
                      return;
                    }
                    setShowUnlockModal(false);
                    pendingUnlockActionRef.current = null;
                  }}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
                  aria-label="关闭密码弹窗"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form className="space-y-3" onSubmit={handleUnlockSubmit}>
                <input
                  type="password"
                  autoFocus
                  value={unlockPasswordInput}
                  onChange={(event) => {
                    setUnlockPasswordInput(event.target.value);
                    setUnlockError(null);
                  }}
                  placeholder="输入密码"
                  className="w-full rounded-lg border border-white/20 bg-slate-800/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                />

                {unlockError ? <p className="text-sm text-amber-200">{unlockError}</p> : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isUnlockVerifying) {
                        return;
                      }
                      setShowUnlockModal(false);
                      pendingUnlockActionRef.current = null;
                    }}
                    className="rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/20"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isUnlockVerifying}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400 disabled:opacity-70"
                  >
                    {isUnlockVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isUnlockVerifying ? '验证中...' : '解锁'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
