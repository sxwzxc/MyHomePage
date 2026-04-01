const VISIT_EVENTS_KEY = 'visit:events:v2';
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

function normalizeTimestamp(value, fallback) {
  const parsed = Date.parse(asString(value));
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  return fallback;
}

function normalizeVisitEvent(value, fallbackNowIso) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const ip = asString(value.ip, 'unknown').trim() || 'unknown';
  const location = asString(value.location, '未知位置').trim() || '未知位置';
  const visitedAt = normalizeTimestamp(value.visitedAt, fallbackNowIso);

  const geoValue = value.geo && typeof value.geo === 'object' ? value.geo : {};

  return {
    ip,
    location,
    visitedAt,
    geo: {
      country: asString(geoValue.country).trim(),
      region: asString(geoValue.region).trim(),
      city: asString(geoValue.city).trim(),
      district: asString(geoValue.district).trim(),
      timezone: asString(geoValue.timezone).trim(),
    },
  };
}

async function loadVisitEvents(kv, nowIso) {
  const raw = await kv.get(VISIT_EVENTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeVisitEvent(item, nowIso))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function pruneVisitEvents(events, nowMs) {
  const cutoff = nowMs - VISIT_RETENTION_MS;

  return events.filter((event) => {
    const visitedAt = Date.parse(event.visitedAt);
    return Number.isFinite(visitedAt) && visitedAt >= cutoff;
  });
}

function aggregateVisitEvents(events) {
  const grouped = new Map();

  for (const event of events) {
    const key = `${event.ip}__${event.location}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ip: event.ip,
        location: event.location,
        count: 1,
        firstVisitedAt: event.visitedAt,
        lastVisitedAt: event.visitedAt,
        geo: {
          ...event.geo,
        },
      });
      continue;
    }

    existing.count += 1;

    if (Date.parse(event.visitedAt) < Date.parse(existing.firstVisitedAt)) {
      existing.firstVisitedAt = event.visitedAt;
    }

    if (Date.parse(event.visitedAt) > Date.parse(existing.lastVisitedAt)) {
      existing.lastVisitedAt = event.visitedAt;
    }

    existing.geo = {
      country: event.geo.country || existing.geo.country || '',
      region: event.geo.region || existing.geo.region || '',
      city: event.geo.city || existing.geo.city || '',
      district: event.geo.district || existing.geo.district || '',
      timezone: event.geo.timezone || existing.geo.timezone || '',
    };
  }

  const records = Array.from(grouped.values()).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt);
  });

  return {
    totalVisits: events.length,
    uniqueIps: new Set(events.map((event) => event.ip)).size,
    records,
  };
}

async function persistVisitEvents(kv, events) {
  await kv.put(VISIT_EVENTS_KEY, JSON.stringify(events));
}

async function handleGetRequest(context) {
  const kv = getKvBinding(context?.env);

  if (!kv) {
    throw new Error(
      "KV namespace binding not found. Please bind namespace 'myhomepage' (fallback: 'my_kv')."
    );
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const loadedEvents = await loadVisitEvents(kv, nowIso);
  const prunedEvents = pruneVisitEvents(loadedEvents, nowMs);

  if (prunedEvents.length !== loadedEvents.length) {
    await persistVisitEvents(kv, prunedEvents);
  }

  const summary = aggregateVisitEvents(prunedEvents);

  return jsonResponse({
    windowDays: VISIT_RETENTION_DAYS,
    totalVisits: summary.totalVisits,
    uniqueIps: summary.uniqueIps,
    records: summary.records,
    updatedAt: nowIso,
  });
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}

export async function onRequestGet(context) {
  return handleGetRequest(context);
}

export async function onRequest(context) {
  const method = context?.request?.method || 'UNKNOWN';

  try {
    if (method === 'OPTIONS') {
      return onRequestOptions();
    }

    if (method === 'GET') {
      return onRequestGet(context);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
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
