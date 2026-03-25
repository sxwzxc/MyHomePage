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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const host = getFunctionsHost();
  const res = await fetch(`${host}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const data = await res.json();

  if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String(data.error)
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function getVisitCount(): Promise<number> {
  const data = await requestJson<{ visitCount: number }>('/visit', {
    method: 'GET',
  });

  return Number(data.visitCount) || 0;
}

export async function getHomepageConfig(): Promise<HomepageConfig> {
  try {
    const data = await requestJson<HomepageConfig>('/homepage-config', {
      method: 'GET',
    });

    return normalizeHomepageConfig(data);
  } catch {
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

  return normalizeHomepageConfig(data);
}
