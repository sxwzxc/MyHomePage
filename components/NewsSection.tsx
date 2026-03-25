'use client';

import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Star, GitFork, TrendingUp } from 'lucide-react';
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

async function fetchTrendingRepos(): Promise<TrendingRepo[]> {
  const response = await fetch('https://api.gitterapp.com/repositories?since=daily&language=');

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

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const repos = await fetchTrendingRepos();
        if (!cancelled) {
          setNews(repos);
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
  }, [enabled]);

  useEffect(() => {
    const isCollapsed = accordionValue === '';
    onCollapsedChange(isCollapsed);
  }, [accordionValue, onCollapsedChange]);

  if (!enabled) {
    return null;
  }

  return (
    <article className="rounded-2xl border border-white/15 bg-slate-900/50 p-5 shadow-lg backdrop-blur">
      <Accordion
        type="single"
        collapsible
        value={accordionValue}
        onValueChange={setAccordionValue}
      >
        <AccordionItem value="news-content" className="border-none">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-shadow-title flex items-center gap-2 text-lg font-semibold text-white">
                <Newspaper className="h-5 w-5 text-white" />
                全球热点新闻
              </h2>
              {!isLoading && news.length > 0 && (
                <span className="text-shadow-soft rounded-full border border-white/20 bg-slate-950/50 px-2 py-1 text-xs text-white/80">
                  {news.length} 条
                </span>
              )}
            </div>
            <AccordionTrigger className="hover:no-underline">
              <span className="text-xs text-white/70">
                {accordionValue === '' ? '展开' : '收起'}
              </span>
            </AccordionTrigger>
          </div>

          <AccordionContent>
            {isLoading ? (
              <div className="py-4 text-center text-sm text-white/70">
                正在加载热点新闻...
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">
                {error}
              </div>
            ) : news.length === 0 ? (
              <div className="py-4 text-center text-sm text-white/70">
                暂无热点新闻
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {news.map((repo, index) => (
                  <a
                    key={`${repo.author}-${repo.name}-${index}`}
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-xl border border-white/10 bg-slate-950/40 p-3 transition-all hover:border-white/30 hover:bg-slate-900/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 shrink-0 text-cyan-400" />
                          <h3 className="text-shadow-soft truncate text-sm font-semibold text-white group-hover:text-cyan-300">
                            {repo.author} / {repo.name}
                          </h3>
                        </div>
                        {repo.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-white/70">
                            {repo.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/60">
                          {repo.language && (
                            <span className="flex items-center gap-1">
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
                          <span className="flex items-center gap-1 text-cyan-400">
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
