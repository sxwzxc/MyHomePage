function getHeaders() {
  return {
    'content-type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: getHeaders(),
  });
}

function toBase64DataUrl(contentType, arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';

  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 = btoa(binary);
  return `data:${contentType};base64,${base64}`;
}

async function tryFetchIcon(url) {
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'image/*,*/*;q=0.8',
      },
    });

    if (!resp.ok) {
      return null;
    }

    const contentType = (resp.headers.get('content-type') || '').toLowerCase();

    if (!contentType.includes('image') && !url.endsWith('.ico')) {
      return null;
    }

    const arrayBuffer = await resp.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return null;
    }

    const normalizedType = contentType.includes('image')
      ? contentType.split(';')[0]
      : 'image/x-icon';

    return toBase64DataUrl(normalizedType, arrayBuffer);
  } catch (err) {
    console.error('Fetch icon failed:', url, err);
    return null;
  }
}

function buildIconSources(targetUrl) {
  const parsed = new URL(targetUrl);
  const hostname = parsed.hostname;

  return [
    `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
    `${parsed.protocol}//${hostname}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`,
  ];
}

export async function onRequestOptions() {
  return new Response('ok', {
    headers: getHeaders(),
  });
}

export async function onRequestGet({ request }) {
  try {
    const requestUrl = new URL(request.url);
    const targetUrl = requestUrl.searchParams.get('url') || '';

    if (!targetUrl) {
      return jsonResponse({ error: 'Missing url query parameter' }, 400);
    }

    let sources = [];

    try {
      sources = buildIconSources(targetUrl);
    } catch {
      return jsonResponse({ error: 'Invalid url parameter' }, 400);
    }

    for (const source of sources) {
      const iconDataUrl = await tryFetchIcon(source);
      if (iconDataUrl) {
        return jsonResponse({ iconDataUrl, source });
      }
    }

    return jsonResponse({ error: 'Failed to download icon' }, 404);
  } catch (err) {
    return jsonResponse(
      {
        error: err && err.message ? err.message : String(err),
      },
      500
    );
  }
}

export async function onRequest(context) {
  const method = context.request.method;

  if (method === 'OPTIONS') {
    return onRequestOptions(context);
  }

  if (method === 'GET') {
    return onRequestGet(context);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
