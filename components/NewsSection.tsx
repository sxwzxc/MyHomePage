'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Newspaper,
  ExternalLink,
  TrendingUp,
  Clock3,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  NewsConfig,
  NEWS_SOURCE_OPTIONS,
  NewsSourceId,
  NewsSourceMode,
} from '@/lib/homepage-config';

type NewsItem = {
  title: string;
  link: string;
  summary: string;
  cover: string;
  hot: string;
  publishedAt: string;
  sourceId: NewsSourceId;
  sourceLabel: string;
};

type NewsSourcePayload = {
  sourceId: NewsSourceId;
  sourceLabel: string;
  host: string;
  items: NewsItem[];
};

type NewsCacheMeta = {
  from: 'kv' | 'origin';
  isStale: boolean;
  updatedAt: string;
  expiresAt: string;
  ttlMinutes: number;
};

const DEV_FUNCTIONS_HOST =
  process.env.NEXT_PUBLIC_FUNCTIONS_HOST?.trim() || 'http://localhost:8088';
const FUNCTIONS_HOST = process.env.NODE_ENV === 'development' ? DEV_FUNCTIONS_HOST : '';
const WEB_CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30 * 1000;

type NewsApiResponse = {
  mode: NewsSourceMode;
  activeSourceId: NewsSourceId;
  activeSourceLabel: string;
  host: string;
  items: NewsItem[];
  sources: NewsSourcePayload[];
  warnings?: string[];
  cache: NewsCacheMeta;
};

type WebCacheEntry = {
  fetchedAt: number;
  data: NewsApiResponse;
};

const webCacheByLimit = new Map<number, WebCacheEntry>();

function getWebCache(limit: number, options?: { allowExpired?: boolean }): NewsApiResponse | null {
  const cached = webCacheByLimit.get(limit);
  if (!cached) {
    return null;
  }

  const expired = Date.now() - cached.fetchedAt > WEB_CACHE_TTL_MS;
  if (expired && !options?.allowExpired) {
    return null;
  }

  return cached.data;
}

function setWebCache(limit: number, data: NewsApiResponse) {
  webCacheByLimit.set(limit, {
    fetchedAt: Date.now(),
    data,
  });
}

function hasAnyNewsItems(payload: NewsApiResponse | null): boolean {
  if (!payload) {
    return false;
  }

  if (Array.isArray(payload.items) && payload.items.length > 0) {
    return true;
  }

  return payload.sources.some((source) => source.items.length > 0);
}

function isRequestTimeoutMessage(message: string): boolean {
  return typeof message === 'string' && message.includes('超时');
}

function pickSourceFromBundle(
  payload: NewsApiResponse,
  sourceMode: NewsSourceMode,
  sourceId: NewsSourceId,
  enabledSourceIds: NewsSourceId[],
  sourceOrder: NewsSourceId[],
  autoSourceCursor: number
): NewsSourcePayload {
  const byId = new Map(payload.sources.map((source) => [source.sourceId, source]));
  const fallbackSourceIds = NEWS_SOURCE_OPTIONS.map((item) => item.id);
  const normalizedOrderIds = sourceOrder.length > 0 ? sourceOrder : fallbackSourceIds;
  const normalizedEnabledIds =
    enabledSourceIds.length > 0
      ? normalizedOrderIds.filter((id) => enabledSourceIds.includes(id))
      : normalizedOrderIds;

  if (sourceMode === 'manual') {
    return (
      byId.get(sourceId) ||
      byId.get(payload.activeSourceId) ||
      payload.sources[0] || {
        sourceId,
        sourceLabel: '未知来源',
        host: '',
        items: [],
      }
    );
  }

  const withData = normalizedEnabledIds.filter(
    (id) => (byId.get(id)?.items.length || 0) > 0
  );
  const candidateIds = withData.length > 0 ? withData : normalizedEnabledIds;

  if (candidateIds.length > 0) {
    const activeId = candidateIds[autoSourceCursor % candidateIds.length];
    const candidate = byId.get(activeId);
    if (candidate && candidate.items.length > 0) {
      return candidate;
    }

    if (candidate) {
      return candidate;
    }
  }

  for (const optionId of normalizedOrderIds) {
    const candidate = byId.get(optionId);
    if (candidate && candidate.items.length > 0) {
      return candidate;
    }
  }

  for (const option of NEWS_SOURCE_OPTIONS) {
    const candidate = byId.get(option.id);
    if (candidate && candidate.items.length > 0) {
      return candidate;
    }
  }

  return (
    byId.get(payload.activeSourceId) ||
    payload.sources[0] || {
      sourceId: payload.activeSourceId,
      sourceLabel: payload.activeSourceLabel,
      host: payload.host,
      items: payload.items,
    }
  );
}

async function fetchNewsFeed({
  sourceMode,
  sourceId,
  limit,
  refresh,
  allowWebCache,
}: {
  sourceMode: NewsSourceMode;
  sourceId: NewsSourceId;
  limit: number;
  refresh: boolean;
  allowWebCache: boolean;
}): Promise<NewsApiResponse> {
  if (allowWebCache && !refresh) {
    const fromCache = getWebCache(limit);
    if (fromCache) {
      return fromCache;
    }
  }

  const source = sourceMode === 'auto' ? 'auto' : sourceId;
  const params = new URLSearchParams({
    source,
    limit: String(limit),
  });

  if (refresh) {
    params.set('refresh', '1');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${FUNCTIONS_HOST}/news?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('获取热点新闻失败');
    }

    const payload = (await response.json()) as NewsApiResponse;
    const previous = getWebCache(limit, { allowExpired: true });
    const shouldOverwriteCache =
      hasAnyNewsItems(payload) || !previous || !hasAnyNewsItems(previous);

    if (shouldOverwriteCache) {
      setWebCache(limit, payload);
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

type NewsSectionProps = {
  enabled: boolean;
  defaultCollapsed: boolean;
  sourceMode: NewsSourceMode;
  sourceId: NewsSourceId;
  enabledSourceIds: NewsSourceId[];
  sourceOrder: NewsSourceId[];
  autoSwitchSeconds: number;
  limit: number;
  onConfigChange: (patch: Partial<NewsConfig>) => void;
};

export default function NewsSection({
  enabled,
  defaultCollapsed,
  sourceMode,
  sourceId,
  enabledSourceIds,
  sourceOrder,
  autoSwitchSeconds,
  limit,
  onConfigChange,
}: NewsSectionProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [accordionValue, setAccordionValue] = useState<string>(
    defaultCollapsed ? '' : 'news-content'
  );
  const [activeSourceLabel, setActiveSourceLabel] = useState<string>('自动');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [cachedUntil, setCachedUntil] = useState<Date | null>(null);
  const [bundle, setBundle] = useState<NewsApiResponse | null>(null);
  const [autoSourceCursor, setAutoSourceCursor] = useState(0);

  const onConfigChangeRef = useRef(onConfigChange);
  const sourceModeRef = useRef(sourceMode);
  const sourceIdRef = useRef(sourceId);
  const enabledSourceIdsRef = useRef(enabledSourceIds);
  const sourceOrderRef = useRef(sourceOrder);
  const autoSourceCursorRef = useRef(autoSourceCursor);
  const bundleRef = useRef<NewsApiResponse | null>(null);
  const pendingBundleRef = useRef<NewsApiResponse | null>(null);
  const backgroundRefreshRunningRef = useRef(false);

  const normalizedSourceOrder = useMemo(() => {
    const byId = new Map(NEWS_SOURCE_OPTIONS.map((item) => [item.id, item]));
    const ordered = sourceOrder
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    for (const option of NEWS_SOURCE_OPTIONS) {
      if (!ordered.some((item) => item.id === option.id)) {
        ordered.push(option);
      }
    }

    return ordered;
  }, [sourceOrder]);

  const visibleSourceOptions = useMemo(
    () =>
      normalizedSourceOrder.filter((item) => enabledSourceIds.includes(item.id)),
    [normalizedSourceOrder, enabledSourceIds]
  );
  const enabledSourceKey = useMemo(() => enabledSourceIds.join('|'), [enabledSourceIds]);

  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  useEffect(() => {
    sourceModeRef.current = sourceMode;
    sourceIdRef.current = sourceId;
    enabledSourceIdsRef.current = enabledSourceIds;
    sourceOrderRef.current = sourceOrder;
  }, [sourceMode, sourceId, enabledSourceIds, sourceOrder]);

  useEffect(() => {
    autoSourceCursorRef.current = autoSourceCursor;
  }, [autoSourceCursor]);

  useEffect(() => {
    setAccordionValue(defaultCollapsed ? '' : 'news-content');
  }, [defaultCollapsed]);

  const applyBundleToView = useCallback((
    payload: NewsApiResponse,
    options?: { prependWarning?: string }
  ) => {
    const active = pickSourceFromBundle(
      payload,
      sourceModeRef.current,
      sourceIdRef.current,
      enabledSourceIdsRef.current,
      sourceOrderRef.current,
      autoSourceCursorRef.current
    );

    setNews(active.items);
    setActiveSourceLabel(active.sourceLabel);

    const warnings = [...(payload.warnings || [])];

    if (sourceModeRef.current === 'manual' && active.items.length === 0) {
      warnings.push(`来源 ${active.sourceLabel} 暂无可展示数据，请稍后刷新重试`);
    }

    if (payload.cache.isStale) {
      warnings.unshift('后台正在刷新，可稍后手动刷新更新数据');
    }

    if (options?.prependWarning) {
      warnings.unshift(options.prependWarning);
    }

    setWarning(warnings[0] || null);

    const updatedAt = Date.parse(payload.cache.updatedAt);
    const expiresAt = Date.parse(payload.cache.expiresAt);
    setLastUpdatedAt(Number.isFinite(updatedAt) ? new Date(updatedAt) : new Date());
    setCachedUntil(Number.isFinite(expiresAt) ? new Date(expiresAt) : null);
  }, []);

  const applyPendingBundleOnSourceSwitch = useCallback((prependWarning: string): boolean => {
    const pendingBundle = pendingBundleRef.current;
    if (!pendingBundle) {
      return false;
    }

    pendingBundleRef.current = null;
    bundleRef.current = pendingBundle;
    setBundle(pendingBundle);
    applyBundleToView(pendingBundle, { prependWarning });
    return true;
  }, [applyBundleToView]);

  const triggerBackgroundRefreshAfterTimeout = useCallback(async () => {
    if (backgroundRefreshRunningRef.current) {
      return;
    }

    backgroundRefreshRunningRef.current = true;
    try {
      const refreshed = await fetchNewsFeed({
        sourceMode: sourceModeRef.current,
        sourceId: sourceIdRef.current,
        limit,
        refresh: true,
        allowWebCache: false,
      });

      pendingBundleRef.current = refreshed;
    } catch {
      // Keep stale bundle on screen when background refresh fails.
    } finally {
      backgroundRefreshRunningRef.current = false;
    }
  }, [limit]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function load() {
      const hasBundle = Boolean(bundleRef.current);
      const isManualRefresh = refreshNonce > 0;

      setIsLoading(!hasBundle);
      setIsSyncing(hasBundle || isManualRefresh);
      setError(null);
      setWarning(null);

      let usedExpiredWebCache = false;

      if (!hasBundle && !isManualRefresh) {
        const freshWebCache = getWebCache(limit);
        const staleWebCache = getWebCache(limit, { allowExpired: true });

        if (!freshWebCache && staleWebCache) {
          usedExpiredWebCache = true;
          bundleRef.current = staleWebCache;
          setBundle(staleWebCache);
          applyBundleToView(staleWebCache, {
            prependWarning: '正在刷新最新数据…',
          });
          setIsLoading(false);
          setIsSyncing(true);
        }
      }

      try {
        const result = await fetchNewsFeed({
          sourceMode: sourceModeRef.current,
          sourceId: sourceIdRef.current,
          limit,
          refresh: isManualRefresh,
          allowWebCache: !isManualRefresh,
        });

        if (cancelled) {
          return;
        }

        bundleRef.current = result;
        setBundle(result);
        applyBundleToView(result);
        setIsSyncing(false);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '加载失败';
          const isTimeoutError = isRequestTimeoutMessage(message);

          if (usedExpiredWebCache || Boolean(bundleRef.current)) {
            setError(null);

            if (isTimeoutError) {
              setWarning('请求超时，已保留旧缓存并转后台更新；切换来源时将展示最新内容');
              void triggerBackgroundRefreshAfterTimeout();
            } else {
              setWarning(`旧缓存已展示，刷新最新数据失败：${message}`);
            }
          } else {
            setError(message);
          }
          setIsSyncing(false);
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
  }, [enabled, limit, refreshNonce, triggerBackgroundRefreshAfterTimeout, applyBundleToView]);

  useEffect(() => {
    if (!bundle || !enabled) {
      return;
    }

    bundleRef.current = bundle;
    applyBundleToView(bundle);
  }, [bundle, enabled, sourceMode, sourceId, enabledSourceIds, sourceOrder, autoSourceCursor, applyBundleToView]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    applyPendingBundleOnSourceSwitch('已切换来源，已展示后台更新后的内容');
  }, [enabled, sourceMode, sourceId, autoSourceCursor, applyPendingBundleOnSourceSwitch]);

  useEffect(() => {
    setAutoSourceCursor(0);
  }, [sourceMode, enabledSourceKey]);

  useEffect(() => {
    if (!enabled || sourceMode !== 'auto' || !bundle) {
      return;
    }

    if (visibleSourceOptions.length <= 1) {
      return;
    }

    const intervalMs = Math.max(5, Math.min(300, Math.round(autoSwitchSeconds))) * 1000;
    const timer = window.setInterval(() => {
      setAutoSourceCursor((value) => value + 1);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, sourceMode, bundle, autoSwitchSeconds, visibleSourceOptions.length]);

  useEffect(() => {
    const isCollapsed = accordionValue === '';
    onConfigChangeRef.current({ collapsed: isCollapsed });
  }, [accordionValue]);

  if (!enabled) {
    return null;
  }

  const handleManualRefresh = () => {
    if (isLoading || isSyncing) {
      return;
    }

    setRefreshNonce((value) => value + 1);
  };

  const sourceDisplayName =
    sourceMode === 'auto'
      ? `自动（当前：${activeSourceLabel}）`
      : visibleSourceOptions.find((item) => item.id === sourceId)?.label || activeSourceLabel;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-900/60 p-5 shadow-lg backdrop-blur">
      <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(236,72,153,0.12),transparent_32%)]" />
      </div>

      <Accordion
        type="single"
        collapsible
        value={accordionValue}
        onValueChange={setAccordionValue}
      >
        <AccordionItem value="news-content" className="border-none">
          <div className="mb-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-shadow-title flex items-center gap-2 text-lg font-semibold text-white">
                  <Newspaper className="h-5 w-5 text-white" />
                  全球热点新闻
                </h2>
                {!isLoading && news.length > 0 ? (
                  <span className="text-shadow-soft rounded-full border border-white/20 bg-slate-950/50 px-2 py-1 text-xs text-white/80">
                    {news.length} 条
                  </span>
                ) : null}
                {lastUpdatedAt ? (
                  <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/75">
                    <Clock3 className="h-3 w-3" />
                    更新 {lastUpdatedAt.toLocaleTimeString('zh-CN', { hour12: false })}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <AccordionTrigger className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:bg-white/10 hover:no-underline">
                  {accordionValue === '' ? '展开' : '收起'}
                </AccordionTrigger>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => onConfigChangeRef.current({ sourceMode: 'auto' })}
                  className={`rounded-lg px-3 py-1 text-xs transition ${
                    sourceMode === 'auto'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  自动
                </button>

                {visibleSourceOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      onConfigChangeRef.current({
                        sourceMode: 'manual',
                        sourceId: option.id,
                      })
                    }
                    className={`rounded-lg px-3 py-1 text-xs transition ${
                      sourceMode === 'manual' && sourceId === option.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {option.label.replace('热搜', '')}
                  </button>
                ))}
              </div>

              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                来源：{sourceDisplayName}
              </span>
            </div>
          </div>

          <AccordionContent>
            {isLoading ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-7 w-7 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/3 rounded-full bg-white/15" />
                        <div className="h-3 w-1/2 rounded-full bg-white/10" />
                      </div>
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-white/5" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center justify-between rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-3 text-sm text-red-100">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  className="rounded-lg border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/15"
                >
                  重试
                </button>
              </div>
            ) : (
              <>
                {warning ? (
                  <div className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-3 text-sm text-amber-100">
                    {warning}
                  </div>
                ) : null}

                {news.length === 0 ? (
                  <div className="py-4 text-center text-sm text-white/70">
                    暂无热点新闻
                  </div>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {news.map((repo, index) => (
                      <div
                        key={`${repo.sourceId}-${repo.link || repo.title}-${index}`}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 p-4 transition-all hover:-translate-y-[1px] hover:border-white/30 hover:bg-slate-900/60"
                      >
                        <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/80">
                          #{index + 1}
                        </div>

                        <div className="flex gap-3">
                          {repo.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={repo.cover}
                              alt={repo.title}
                              className="mt-1 h-16 w-20 shrink-0 rounded-lg border border-white/10 object-cover"
                            />
                          ) : (
                            <div className="mt-1 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/10 text-cyan-300">
                              <TrendingUp className="h-5 w-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            {repo.link ? (
                              <a
                                href={repo.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex max-w-full items-start gap-1"
                              >
                                <h3 className="text-shadow-soft line-clamp-2 text-sm font-semibold text-white group-hover:text-cyan-200">
                                  {repo.title}
                                </h3>
                                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40 transition group-hover:text-white/70" />
                              </a>
                            ) : (
                              <h3 className="text-shadow-soft line-clamp-2 text-sm font-semibold text-white">
                                {repo.title}
                              </h3>
                            )}

                            {repo.summary ? (
                              <p className="mt-1 line-clamp-2 text-xs text-white/75">{repo.summary}</p>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                              <span className="rounded-full bg-white/5 px-2 py-1">{repo.sourceLabel}</span>
                              {repo.hot ? (
                                <span className="rounded-full bg-cyan-500/20 px-2 py-1 text-cyan-100">
                                  {repo.hot}
                                </span>
                              ) : null}
                              {repo.publishedAt ? (
                                <span className="rounded-full bg-white/5 px-2 py-1">
                                  {repo.publishedAt}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </article>
  );
}
