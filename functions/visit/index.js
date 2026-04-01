const VISIT_COUNT_KEY = 'visitCount';
const VISIT_DETAILS_KEY = 'visit:details:v1';
const VISIT_RETENTION_DAYS = 30;
const VISIT_RETENTION_MS = VISIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function getKvBinding(env) {
  if (env && env.myhomepage) {
    return env.myhomepage;
  }

  if (typeof myhomepage !== 'undefined') {
    return myhomepage;
  }

  if (env && env.my_kv) {
    return env.my_kv;
  }

  if (typeof my_kv !== 'undefined') {
    return my_kv;
  }

  return null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function readGeoValue(geo, keys) {
  if (!geo || typeof geo !== 'object') {
    return '';
  }

  for (const key of keys) {
    const value = geo[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function resolveClientIp(request) {
  const eoClientIp = request?.eo?.clientIp;
  if (typeof eoClientIp === 'string' && eoClientIp.trim()) {
    return eoClientIp.trim();
  }

  const headers = request?.headers;
  const xForwardedFor = headers?.get?.('x-forwarded-for') || '';
  if (xForwardedFor.trim()) {
    return xForwardedFor.split(',')[0].trim();
  }

  return (
    headers?.get?.('x-real-ip') ||
    headers?.get?.('cf-connecting-ip') ||
    headers?.get?.('x-edgeone-client-ip') ||
    ''
  ).trim();
}

function pickGeoSnapshot(request) {
  const geo = request?.eo?.geo;

  return {
    country: readGeoValue(geo, ['country', 'countryName']),
    region: readGeoValue(geo, ['region', 'regionName', 'province', 'state']),
    city: readGeoValue(geo, ['city', 'cityName']),
    district: readGeoValue(geo, ['district', 'districtName']),
    timezone: readGeoValue(geo, ['timezone', 'timeZone']),
  };
}

function formatGeoLocation(geoSnapshot) {
  const parts = [
    geoSnapshot.district,
    geoSnapshot.city,
    geoSnapshot.region,
    geoSnapshot.country,
  ].filter(Boolean);

  const uniqueParts = parts.filter((part, index) => parts.indexOf(part) === index);

  return uniqueParts.join(' · ') || '未知位置';
}

function normalizeTimestamp(value, fallback) {
  const parsed = Date.parse(asString(value));
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  return fallback;
}

function normalizeVisitEntry(value, fallbackNowIso) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const ip = asString(value.ip, 'unknown').trim() || 'unknown';
  const location = asString(value.location, '未知位置').trim() || '未知位置';
  const countRaw = Number(value.count);
  const count = Number.isFinite(countRaw) && countRaw > 0 ? Math.round(countRaw) : 1;

  const geoValue = value.geo && typeof value.geo === 'object' ? value.geo : {};

  const geo = {
    country: asString(geoValue.country).trim(),
    region: asString(geoValue.region).trim(),
    city: asString(geoValue.city).trim(),
    district: asString(geoValue.district).trim(),
    timezone: asString(geoValue.timezone).trim(),
  };

  const lastVisitedAt = normalizeTimestamp(value.lastVisitedAt, fallbackNowIso);
  const firstVisitedAt = normalizeTimestamp(value.firstVisitedAt, lastVisitedAt);

  return {
    ip,
    location,
    count,
    firstVisitedAt,
    lastVisitedAt,
    geo,
  };
}

async function loadVisitEntries(kv, nowIso) {
  const raw = await kv.get(VISIT_DETAILS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeVisitEntry(item, nowIso))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function pruneVisitEntries(entries, nowMs) {
  const cutoff = nowMs - VISIT_RETENTION_MS;

  return entries.filter((entry) => {
    const lastVisitedAt = Date.parse(entry.lastVisitedAt);
    return Number.isFinite(lastVisitedAt) && lastVisitedAt >= cutoff;
  });
}

function upsertVisitEntry(entries, request, nowIso) {
  const ip = resolveClientIp(request) || 'unknown';
  const geo = pickGeoSnapshot(request);
  const location = formatGeoLocation(geo);

  const existing = entries.find((entry) => entry.ip === ip && entry.location === location);

  if (!existing) {
    return [
      ...entries,
      {
        ip,
        location,
        count: 1,
        firstVisitedAt: nowIso,
        lastVisitedAt: nowIso,
        geo,
      },
    ];
  }

  return entries.map((entry) => {
    if (entry.ip !== ip || entry.location !== location) {
      return entry;
    }

    return {
      ...entry,
      count: entry.count + 1,
      lastVisitedAt: nowIso,
      geo: {
        country: geo.country || entry.geo.country || '',
        region: geo.region || entry.geo.region || '',
        city: geo.city || entry.geo.city || '',
        district: geo.district || entry.geo.district || '',
        timezone: geo.timezone || entry.geo.timezone || '',
      },
    };
  });
}

function summarizeVisitEntries(entries) {
  const totalVisits = entries.reduce((sum, entry) => sum + entry.count, 0);
  const uniqueIps = new Set(entries.map((entry) => entry.ip)).size;

  const records = [...entries].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt);
  });

  return {
    totalVisits,
    uniqueIps,
    records,
  };
}

async function persistVisitEntries(kv, entries) {
  await kv.put(VISIT_DETAILS_KEY, JSON.stringify(entries));
}

async function incrementVisitCount(kv) {
  const rawVisitCount = await kv.get(VISIT_COUNT_KEY);
  let visitCount = Number(rawVisitCount);

  if (!Number.isFinite(visitCount)) {
    visitCount = 0;
  }

  visitCount += 1;
  await kv.put(VISIT_COUNT_KEY, String(visitCount));
  return visitCount;
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}

export async function onRequest({ request, env }) {
  try {
    const kv = getKvBinding(env);

    if (!kv) {
      throw new Error(
        "KV namespace binding not found. Please bind namespace 'myhomepage' (fallback: 'my_kv')."
      );
    }

    if (request.method === 'OPTIONS') {
      return onRequestOptions();
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const url = new URL(request.url);
    const queryStatsOnly = url.searchParams.get('stats') === '1';

    if (queryStatsOnly) {
      const existingEntries = await loadVisitEntries(kv, nowIso);
      const prunedEntries = pruneVisitEntries(existingEntries, nowMs);

      if (prunedEntries.length !== existingEntries.length) {
        await persistVisitEntries(kv, prunedEntries);
      }

      const summary = summarizeVisitEntries(prunedEntries);

      return jsonResponse({
        windowDays: VISIT_RETENTION_DAYS,
        totalVisits: summary.totalVisits,
        uniqueIps: summary.uniqueIps,
        records: summary.records,
        updatedAt: nowIso,
      });
    }

    const visitCount = await incrementVisitCount(kv);
    const existingEntries = await loadVisitEntries(kv, nowIso);
    const prunedEntries = pruneVisitEntries(existingEntries, nowMs);
    const nextEntries = upsertVisitEntry(prunedEntries, request, nowIso);

    await persistVisitEntries(kv, nextEntries);

    return jsonResponse({
      visitCount,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(
      {
        error:
          err && err.message
            ? err.message
            : "KV storage hasn't been set up for your EdgeOne Pages Project.",
      },
      500
    );
  }
}
