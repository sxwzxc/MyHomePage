function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function normalizeSince(value) {
  if (value === 'weekly' || value === 'monthly') {
    return value;
  }

  return 'daily';
}

function normalizeLanguage(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const since = normalizeSince(url.searchParams.get('since'));
    const language = normalizeLanguage(url.searchParams.get('language'));
    const upstreamParams = new URLSearchParams({ since });
    if (language) {
      upstreamParams.set('language', language);
    }

    const upstream = await fetch(
      `https://api.gitterapp.com/repositories?${upstreamParams.toString()}`
    );

    if (!upstream.ok) {
      return jsonResponse(
        { error: `上游服务请求失败（HTTP ${upstream.status}）` },
        502
      );
    }

    const data = await upstream.json();
    if (!Array.isArray(data)) {
      return jsonResponse([], 200);
    }

    return jsonResponse(data.slice(0, 10), 200);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : '未知错误' },
      500
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return onRequestOptions();
  }

  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
