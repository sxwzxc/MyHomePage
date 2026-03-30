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

  const geo = resolveGeo(context.request);

  return jsonResponse({
    geo,
    available: Boolean(geo),
    message: geo
      ? ''
      : '当前运行环境未提供 request.eo.geo（本地开发或代理链路下属于正常现象）。',
  });
}
