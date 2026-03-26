'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Newspaper,
  ExternalLink,
  Star,
  GitFork,
  TrendingUp,
  RefreshCcw,
  Clock3,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type TrendingRepo = {
  author: string;
  name: string;
  url: string;
  description: string;
  language: string;
  languageColor: string;
  stars: number;
  forks: number;
  currentPeriodStars: number;
};

type Timeframe = 'daily' | 'weekly' | 'monthly';

const TIMEFRAME_OPTIONS: Array<{ id: Timeframe; label: string }> = [
  { id: 'daily', label: '今日' },
  { id: 'weekly', label: '本周' },
  { id: 'monthly', label: '本月' },
];

const FIXED_LANGUAGE = '';
const DEV_FUNCTIONS_HOST =
  process.env.NEXT_PUBLIC_FUNCTIONS_HOST?.trim() || 'http://localhost:8088';
const FUNCTIONS_HOST = process.env.NODE_ENV === 'development' ? DEV_FUNCTIONS_HOST : '';

async function fetchTrendingRepos({
  since,
  language,
}: {
  since: Timeframe;
  language?: string;
}): Promise<TrendingRepo[]> {
  const params = new URLSearchParams({
    since,
    language: language ?? '',
  });

  const response = await fetch(`${FUNCTIONS_HOST}/news?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('获取热点新闻失败');
  }

  const data = (await response.json()) as TrendingRepo[];
  return data.slice(0, 10);
}

type NewsSectionProps = {
  enabled: boolean;
  defaultCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

export default function NewsSection({
  enabled,
  defaultCollapsed,
  onCollapsedChange,
}: NewsSectionProps) {
  const [news, setNews] = useState<TrendingRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accordionValue, setAccordionValue] = useState<string>(
    defaultCollapsed ? '' : 'news-content'
  );
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const onCollapsedChangeRef = useRef(onCollapsedChange);

  useEffect(() => {
    onCollapsedChangeRef.current = onCollapsedChange;
  }, [onCollapsedChange]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const repos = await fetchTrendingRepos({ since: timeframe, language: FIXED_LANGUAGE });
        if (!cancelled) {
          setNews(repos);
          setLastUpdatedAt(new Date());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败');
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
  }, [enabled, timeframe, refreshNonce]);

  useEffect(() => {
    const isCollapsed = accordionValue === '';
    onCollapsedChangeRef.current(isCollapsed);
  }, [accordionValue]);

  if (!enabled) {
    return null;
  }

  const handleManualRefresh = () => {
    if (isLoading) {
      return;
    }
    setRefreshNonce((value) => value + 1);
  };

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
                    {lastUpdatedAt.toLocaleTimeString('zh-CN', { hour12: false })}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isLoading}
                  className="flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/20 disabled:opacity-60"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  {isLoading ? '刷新中...' : '刷新'}
                </button>
                <AccordionTrigger className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:bg-white/10 hover:no-underline">
                  {accordionValue === '' ? '展开' : '收起'}
                </AccordionTrigger>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                {TIMEFRAME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTimeframe(option.id)}
                    className={`rounded-lg px-3 py-1 text-xs transition ${
                      timeframe === option.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                语言：全部
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
            ) : news.length === 0 ? (
              <div className="py-4 text-center text-sm text-white/70">
                暂无热点新闻
              </div>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {news.map((repo, index) => (
                  <a
                    key={`${repo.author}-${repo.name}-${index}`}
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 p-4 transition-all hover:-translate-y-[1px] hover:border-white/30 hover:bg-slate-900/60"
                  >
                    <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/80">
                      #{index + 1}
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 rounded-full bg-white/10 p-2 text-cyan-300">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-shadow-soft truncate text-sm font-semibold text-white group-hover:text-cyan-200">
                          {repo.author} / {repo.name}
                        </h3>
                        {repo.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-white/75">
                            {repo.description}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-white/70">
                          {repo.language && (
                            <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: repo.languageColor || '#8b949e',
                                }}
                              />
                              {repo.language}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {repo.stars.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <GitFork className="h-3 w-3" />
                            {repo.forks.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1 text-cyan-300">
                            <Star className="h-3 w-3" />+
                            {repo.currentPeriodStars.toLocaleString()} today
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-white/40 transition group-hover:text-white/70" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </article>
  );
}
