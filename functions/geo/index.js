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

function resolveGeoFromRequest(request) {
  if (request && request.eo && request.eo.geo && typeof request.eo.geo === 'object') {
    return request.eo.geo;
  }

  return null;
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return onRequestOptions();
  }

  if (context.request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const geo = resolveGeoFromRequest(context.request);

  return jsonResponse({
    geo,
    available: Boolean(geo),
    source: geo ? 'edge' : 'unknown',
    message: geo
      ? ''
      : '当前运行环境未提供地理位置信息（本地开发或代理链可能不携带 eo.geo）。',
  });
}
