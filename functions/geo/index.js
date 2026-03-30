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

export async function onRequest(context) {
  const request = context?.request;
  const requestId = `geo_alias_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const requestInfo = pickRequestDebugInfo(request);

  console.log('[geo] incoming request', {
    requestId,
    ...requestInfo,
  });

  try {
    if (request.method === 'OPTIONS') {
      return onRequestOptions();
    }

    if (request.method !== 'GET') {
      console.error('[geo] method not allowed', {
        requestId,
        method: request.method,
      });
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const geo = resolveGeo(request);
    const eo = request?.eo;

    if (!geo) {
      const eoKeys = eo && typeof eo === 'object' ? Object.keys(eo) : [];
      console.error('[geo] geo unavailable: request.eo.geo is empty', {
        requestId,
        eoType: typeof eo,
        eoKeys,
        debug: requestInfo,
      });
    } else {
      console.log('[geo] geo resolved', {
        requestId,
        geoKeys: Object.keys(geo),
        country: geo.country || geo.countryName || '',
        region: geo.region || geo.regionName || geo.province || '',
        city: geo.city || geo.cityName || '',
        timezone: geo.timezone || geo.timeZone || '',
      });
    }

    return jsonResponse({
      geo,
      available: Boolean(geo),
      message: geo
        ? ''
        : '当前运行环境未提供 request.eo.geo（本地开发或代理链路下属于正常现象）。',
      requestId,
    });
  } catch (error) {
    console.error('[geo] unexpected error', {
      requestId,
      error: normalizeErrorLog(error),
      debug: requestInfo,
    });

    return jsonResponse(
      {
        geo: null,
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
      500
    );
  }
}
