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
  const hasFormDataBody =
    typeof FormData !== 'undefined' && init?.body instanceof FormData;

  const headers = new Headers(init?.headers ?? {});
  if (hasBody && !hasFormDataBody && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${host}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
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

export type BackgroundImageUploadResponse = {
  imageUrl: string;
  updatedAt?: string;
  byteLength?: number;
};

export type BackgroundImageUploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
  chunkIndex: number;
  totalChunks: number;
};

type BackgroundImageUploadInitResponse = {
  uploadId: string;
  chunkByteLength: number;
  totalChunks: number;
};

const BACKGROUND_UPLOAD_CHUNK_BYTES = 512 * 1024;

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function encodeUint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
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

export async function uploadBackgroundImage(
  imageDataOrFile: string | File,
  fileName: string,
  onProgress?: (progress: BackgroundImageUploadProgress) => void
): Promise<BackgroundImageUploadResponse> {
  const isFileBody = typeof File !== 'undefined' && imageDataOrFile instanceof File;

  const data = isFileBody
    ? await (async () => {
        const file = imageDataOrFile;
        const contentType = (file.type || '').toLowerCase();

        if (!contentType.startsWith('image/')) {
          throw new Error('仅支持图片文件上传');
        }

        const totalBytes = file.size;
        if (totalBytes <= 0) {
          throw new Error('上传图片为空');
        }

        const requestedChunkByteLength = BACKGROUND_UPLOAD_CHUNK_BYTES;
        let uploadId = '';

        try {
          const init = await requestJson<BackgroundImageUploadInitResponse>(
            '/background-image?action=init',
            {
              method: 'POST',
              body: JSON.stringify({
                fileName: fileName || file.name,
                contentType,
                byteLength: totalBytes,
                chunkByteLength: requestedChunkByteLength,
              }),
            }
          );

          if (!init || typeof init.uploadId !== 'string' || !init.uploadId.trim()) {
            throw new Error('初始化分片上传失败：缺少 uploadId');
          }

          uploadId = init.uploadId;
          const chunkByteLength = Math.max(
            64 * 1024,
            Math.min(BACKGROUND_UPLOAD_CHUNK_BYTES, Number(init.chunkByteLength) || requestedChunkByteLength)
          );
          const totalChunks = Math.max(1, Number(init.totalChunks) || Math.ceil(totalBytes / chunkByteLength));

          onProgress?.({
            uploadedBytes: 0,
            totalBytes,
            percentage: 0,
            chunkIndex: 0,
            totalChunks,
          });

          for (let index = 0; index < totalChunks; index += 1) {
            const start = index * chunkByteLength;
            const end = Math.min(totalBytes, start + chunkByteLength);
            const bytes = new Uint8Array(await file.slice(start, end).arrayBuffer());
            const chunkBase64 = encodeUint8ArrayToBase64(bytes);

            await requestJson('/background-image?action=chunk', {
              method: 'POST',
              body: JSON.stringify({
                uploadId,
                index,
                chunkBase64,
              }),
            });

            const uploadedBytes = end;
            const percentage = Math.min(100, Math.round((uploadedBytes / totalBytes) * 100));
            onProgress?.({
              uploadedBytes,
              totalBytes,
              percentage,
              chunkIndex: index + 1,
              totalChunks,
            });
          }

          return await requestJson<BackgroundImageUploadResponse>(
            '/background-image?action=commit',
            {
              method: 'POST',
              body: JSON.stringify({ uploadId }),
            }
          );
        } catch (error) {
          if (uploadId) {
            try {
              await requestJson('/background-image?action=abort', {
                method: 'POST',
                body: JSON.stringify({ uploadId }),
              });
            } catch {
              // ignore abort errors
            }
          }

          throw error;
        }
      })()
    : await requestJson<BackgroundImageUploadResponse>('/background-image', {
        method: 'POST',
        body: JSON.stringify({ imageDataUrl: imageDataOrFile, fileName }),
      });

  if (!data || typeof data.imageUrl !== 'string' || !data.imageUrl.trim()) {
    throw new Error('背景图片上传成功，但返回数据缺少 imageUrl');
  }

  return {
    imageUrl: data.imageUrl,
    updatedAt: data.updatedAt,
    byteLength: Number(data.byteLength) || 0,
  };
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
