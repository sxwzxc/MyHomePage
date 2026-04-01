import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  DEFAULT_HOMEPAGE_CONFIG,
  HomepageConfig,
  normalizeHomepageConfig,
} from '@/lib/homepage-config';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getFunctionsHost() {
  return process.env.NODE_ENV === 'development' ? 'http://localhost:8088' : '';
}

const REQUEST_TIMEOUT_MS = 30000;

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError'
  );
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const host = getFunctionsHost();
  const method = init?.method ?? 'GET';
  const hasBody = typeof init?.body !== 'undefined';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${host}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.headers ?? {}),
        ...(hasBody || method !== 'GET'
          ? { 'content-type': 'application/json' }
          : {}),
      },
    });

    const rawText = await res.text();
    let data: unknown = null;

    if (rawText.trim()) {
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          `服务返回了非 JSON 内容（${res.status}），请确认函数接口已正确部署。`
        );
      }
    }

    if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
      const message =
        data && typeof data === 'object' && 'error' in data
          ? String(data.error)
          : `Request failed with status ${res.status}`;
      throw new Error(message);
    }

    return data as T;
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const CONFIG_CACHE_KEY = 'homepage_config_cache';
const CONFIG_CACHE_TTL_MS = 30_000;

export type GeoResponse = {
  geo: Record<string, unknown> | null;
  ip?: string;
  available: boolean;
  message?: string;
  requestId?: string;
  endpoint?: string;
};

export type VisitStatsRecord = {
  ip: string;
  location: string;
  count: number;
  firstVisitedAt: string;
  lastVisitedAt: string;
  geo?: {
    country?: string;
    region?: string;
    city?: string;
    district?: string;
    timezone?: string;
  };
};

export type VisitStatsResponse = {
  windowDays: number;
  totalVisits: number;
  uniqueIps: number;
  records: VisitStatsRecord[];
  updatedAt: string;
};

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function readConfigCache(): HomepageConfig | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.timestamp === 'number' &&
      typeof parsed.data === 'object' &&
      Date.now() - parsed.timestamp < CONFIG_CACHE_TTL_MS
    ) {
      return normalizeHomepageConfig(parsed.data);
    }
    return null;
  } catch {
    return null;
  }
}

function writeConfigCache(config: HomepageConfig): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(
      CONFIG_CACHE_KEY,
      JSON.stringify({ data: config, timestamp: Date.now() })
    );
  } catch {
    // ignore storage quota errors
  }
}

export async function getVisitCount(): Promise<number> {
  const data = await requestJson<{ visitCount: number }>('/visit', {
    method: 'GET',
  });

  return Number(data.visitCount) || 0;
}

export async function getVisitStats(): Promise<VisitStatsResponse> {
  const paths = ['/visit-stats', '/visit?stats=1'];
  const errors: string[] = [];

  for (const path of paths) {
    try {
      const data = await requestJson<VisitStatsResponse>(path, {
        method: 'GET',
      });

      return {
        windowDays: Number(data.windowDays) || 30,
        totalVisits: Number(data.totalVisits) || 0,
        uniqueIps: Number(data.uniqueIps) || 0,
        records: Array.isArray(data.records) ? data.records : [],
        updatedAt:
          typeof data.updatedAt === 'string'
            ? data.updatedAt
            : new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${path}: ${message}`);
    }
  }

  throw new Error(errors[0] || '访问统计服务暂不可用');
}

export async function getGeo(): Promise<GeoResponse> {
  const paths = ['/get_geo', '/geo'];
  const errors: string[] = [];

  for (const path of paths) {
    try {
      const data = await requestJson<GeoResponse>(path, {
        method: 'GET',
      });

      const response: GeoResponse = {
        ...data,
        ip: typeof data.ip === 'string' ? data.ip.trim() : '',
        endpoint: path,
      };

      if (response.available && response.geo) {
        console.info('[geo] request success', {
          endpoint: path,
          requestId: response.requestId || '',
          ip: response.ip || '',
          keys: Object.keys(response.geo),
        });
      } else {
        console.error('[geo] endpoint responded but no geo', {
          endpoint: path,
          requestId: response.requestId || '',
          ip: response.ip || '',
          response,
        });
      }

      return response;
    } catch (error) {
      const message = normalizeErrorMessage(error);
      errors.push(`${path}: ${message}`);
      console.error('[geo] request failed', {
        endpoint: path,
        error,
        message,
      });
    }
  }

  console.error('[geo] all endpoint attempts failed', {
    host:
      getFunctionsHost() ||
      (typeof window !== 'undefined' ? window.location.origin : ''),
    nodeEnv: process.env.NODE_ENV,
    errors,
  });

  return {
    geo: null,
    ip: '',
    available: false,
    message: errors[0] || '地理位置信息暂不可用',
  };
}

export async function getHomepageConfig(): Promise<HomepageConfig> {
  try {
    const data = await requestJson<HomepageConfig>('/homepage-config', {
      method: 'GET',
    });

    const config = normalizeHomepageConfig(data);
    writeConfigCache(config);
    return config;
  } catch {
    const cached = readConfigCache();
    if (cached) return cached;
    return {
      ...DEFAULT_HOMEPAGE_CONFIG,
      searchEngines: [...DEFAULT_HOMEPAGE_CONFIG.searchEngines],
      bookmarks: [...DEFAULT_HOMEPAGE_CONFIG.bookmarks],
    };
  }
}

export async function saveHomepageConfig(
  config: HomepageConfig
): Promise<HomepageConfig> {
  const data = await requestJson<HomepageConfig>('/homepage-config', {
    method: 'POST',
    body: JSON.stringify(config),
  });

  const normalized = normalizeHomepageConfig(data);
  writeConfigCache(normalized);
  return normalized;
}

export async function fetchBookmarkFavicon(url: string): Promise<string | null> {
  if (!url.trim()) {
    return null;
  }

  try {
    const data = await requestJson<{ iconDataUrl?: string }>(
      `/favicon-fetch?url=${encodeURIComponent(url)}`,
      {
        method: 'GET',
      }
    );

    return data.iconDataUrl || null;
  } catch {
    return null;
  }
}

export async function verifyUnlockPassword(password: string): Promise<boolean> {
  if (!password.trim()) {
    return false;
  }

  try {
    const data = await requestJson<{ verified?: boolean }>('/password-verify', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });

    return Boolean(data.verified);
  } catch {
    return false;
  }
}

export async function forceSyncNewsSources(): Promise<void> {
  await requestJson('/news?source=auto&limit=30&refresh=1', {
    method: 'GET',
  });
}
