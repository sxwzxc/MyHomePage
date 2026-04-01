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

function resolveGeo(request) {
  if (request && request.eo && request.eo.geo && typeof request.eo.geo === 'object') {
    return request.eo.geo;
  }

  return null;
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

function pickRequestDebugInfo(request) {
  const headers = request && request.headers ? request.headers : null;

  return {
    method: request?.method || 'UNKNOWN',
    url: request?.url || '',
    headers: {
      host: headers?.get?.('host') || '',
      'user-agent': headers?.get?.('user-agent') || '',
      'x-forwarded-for': headers?.get?.('x-forwarded-for') || '',
      'x-real-ip': headers?.get?.('x-real-ip') || '',
      'cf-connecting-ip': headers?.get?.('cf-connecting-ip') || '',
      'x-edgeone-client-ip': headers?.get?.('x-edgeone-client-ip') || '',
    },
  };
}

function normalizeErrorLog(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || '',
    };
  }

  return {
    message: String(error),
  };
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}

async function handleGetRequest(context) {
  const request = context?.request;
  const requestId = `geo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const requestInfo = pickRequestDebugInfo(request);
  const ip = resolveClientIp(request);

  console.log('[get_geo] incoming request', {
    requestId,
    clientIp: ip,
    ...requestInfo,
  });

  try {
    const geo = resolveGeo(request);
    const eo = request?.eo;

    if (!geo) {
      const eoKeys = eo && typeof eo === 'object' ? Object.keys(eo) : [];
      console.error('[get_geo] geo unavailable: request.eo.geo is empty', {
        requestId,
        clientIp: ip,
        eoType: typeof eo,
        eoKeys,
        debug: requestInfo,
      });
    } else {
      console.log('[get_geo] geo resolved', {
        requestId,
        clientIp: ip,
        geoKeys: Object.keys(geo),
        country: geo.country || geo.countryName || '',
        region: geo.region || geo.regionName || geo.province || '',
        city: geo.city || geo.cityName || '',
        timezone: geo.timezone || geo.timeZone || '',
      });
    }

    return jsonResponse({
      geo,
      ip,
      available: Boolean(geo),
      message: geo
        ? ''
        : '当前运行环境未提供 request.eo.geo（本地开发或代理链路下属于正常现象）。',
      requestId,
    });
  } catch (error) {
    console.error('[get_geo] unexpected error', {
      requestId,
      error: normalizeErrorLog(error),
      debug: requestInfo,
    });

    return jsonResponse(
      {
        geo: null,
        ip,
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
      500
    );
  }
}

export async function onRequestGet(context) {
  return handleGetRequest(context);
}

export async function onRequest(context) {
  const method = context?.request?.method || 'UNKNOWN';

  if (method === 'OPTIONS') {
    return onRequestOptions();
  }

  if (method === 'GET') {
    return onRequestGet(context);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
