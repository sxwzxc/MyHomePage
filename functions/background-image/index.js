const BACKGROUND_IMAGE_KEY = 'homepage:background:image:v1';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function getHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: getHeaders({
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
    }),
  });
}

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

  if (globalThis && globalThis.myhomepage) {
    return globalThis.myhomepage;
  }

  if (globalThis && globalThis.my_kv) {
    return globalThis.my_kv;
  }

  return null;
}

function parseImageDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl || '');

  if (!match) {
    return null;
  }

  const contentType = match[1].toLowerCase();
  const base64Data = match[2];

  if (!contentType.startsWith('image/')) {
    return null;
  }

  return {
    contentType,
    base64Data,
  };
}

function decodeBase64ToUint8Array(base64Data) {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function base64ByteLength(base64Data) {
  const cleaned = (base64Data || '').replace(/\s/g, '');
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  return Math.floor((cleaned.length * 3) / 4) - padding;
}

async function handleGet(context) {
  const kv = getKvBinding(context?.env);

  if (!kv) {
    return jsonResponse(
      {
        error:
          "KV namespace binding not found. Please bind namespace 'myhomepage' (fallback: 'my_kv').",
      },
      500
    );
  }

  const raw = await kv.get(BACKGROUND_IMAGE_KEY);
  if (!raw) {
    return new Response('Background image not found', {
      status: 404,
      headers: getHeaders({ 'content-type': 'text/plain; charset=UTF-8' }),
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: 'Stored background image payload is invalid' }, 500);
  }

  const contentType = typeof parsed?.contentType === 'string' ? parsed.contentType : '';
  const base64Data = typeof parsed?.base64Data === 'string' ? parsed.base64Data : '';

  if (!contentType.startsWith('image/') || !base64Data) {
    return jsonResponse({ error: 'Stored background image payload is incomplete' }, 500);
  }

  try {
    const bytes = decodeBase64ToUint8Array(base64Data);

    return new Response(bytes, {
      status: 200,
      headers: getHeaders({
        'content-type': contentType,
        'cache-control': 'public, max-age=60',
      }),
    });
  } catch {
    return jsonResponse({ error: 'Failed to decode stored background image' }, 500);
  }
}

async function handlePost(context) {
  const kv = getKvBinding(context?.env);

  if (!kv) {
    return jsonResponse(
      {
        error:
          "KV namespace binding not found. Please bind namespace 'myhomepage' (fallback: 'my_kv').",
      },
      500
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : '';
  const fileName = typeof body?.fileName === 'string' ? body.fileName : '';

  const parsed = parseImageDataUrl(imageDataUrl);
  if (!parsed) {
    return jsonResponse({ error: 'imageDataUrl must be a valid image data URL' }, 400);
  }

  const byteLength = base64ByteLength(parsed.base64Data);
  if (byteLength <= 0) {
    return jsonResponse({ error: 'Uploaded image is empty' }, 400);
  }

  if (byteLength > MAX_IMAGE_BYTES) {
    return jsonResponse(
      {
        error: `图片过大，当前限制 ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB`,
      },
      413
    );
  }

  const nowIso = new Date().toISOString();

  await kv.put(
    BACKGROUND_IMAGE_KEY,
    JSON.stringify({
      contentType: parsed.contentType,
      base64Data: parsed.base64Data,
      fileName,
      byteLength,
      updatedAt: nowIso,
    })
  );

  const cacheBustedUrl = `/background-image?v=${encodeURIComponent(nowIso)}`;

  return jsonResponse({
    imageUrl: cacheBustedUrl,
    updatedAt: nowIso,
    byteLength,
  });
}

export async function onRequestOptions() {
  return new Response('ok', {
    headers: getHeaders(),
  });
}

export async function onRequestGet(context) {
  return handleGet(context);
}

export async function onRequestPost(context) {
  return handlePost(context);
}

export async function onRequest(context) {
  const method = context?.request?.method || 'UNKNOWN';

  if (method === 'OPTIONS') {
    return onRequestOptions();
  }

  if (method === 'GET') {
    return onRequestGet(context);
  }

  if (method === 'POST') {
    return onRequestPost(context);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
