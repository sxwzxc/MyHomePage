const BACKGROUND_IMAGE_KEY = 'homepage:background:image:v1';
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const BACKGROUND_IMAGE_CHUNK_PREFIX = `${BACKGROUND_IMAGE_KEY}:chunk:`;
const BASE64_CHUNK_SIZE = 256 * 1024;

function getChunkKey(index) {
  return `${BACKGROUND_IMAGE_CHUNK_PREFIX}${index}`;
}

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

function splitIntoChunks(text, chunkSize) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function encodeUint8ArrayToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function buildImagePayloadFromJson(body) {
  const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : '';
  const fileName = typeof body?.fileName === 'string' ? body.fileName : '';

  const parsed = parseImageDataUrl(imageDataUrl);
  if (!parsed) {
    return {
      ok: false,
      error: 'imageDataUrl must be a valid image data URL',
      status: 400,
    };
  }

  const byteLength = base64ByteLength(parsed.base64Data);
  if (byteLength <= 0) {
    return {
      ok: false,
      error: 'Uploaded image is empty',
      status: 400,
    };
  }

  return {
    ok: true,
    contentType: parsed.contentType,
    base64Data: parsed.base64Data,
    fileName,
    byteLength,
  };
}

async function buildImagePayloadFromFormData(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return {
      ok: false,
      error: 'Invalid form data body',
      status: 400,
    };
  }

  const file = formData.get('file') || formData.get('image');
  if (!file || typeof file === 'string') {
    return {
      ok: false,
      error: 'file must be an uploaded image file',
      status: 400,
    };
  }

  const contentType = typeof file.type === 'string' ? file.type.toLowerCase() : '';
  if (!contentType.startsWith('image/')) {
    return {
      ok: false,
      error: '仅支持图片文件上传',
      status: 400,
    };
  }

  let bytes;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return {
      ok: false,
      error: '读取上传文件失败',
      status: 400,
    };
  }

  const byteLength = bytes.byteLength;
  if (byteLength <= 0) {
    return {
      ok: false,
      error: 'Uploaded image is empty',
      status: 400,
    };
  }

  const explicitName = formData.get('fileName');
  const fileName =
    typeof explicitName === 'string' && explicitName.trim()
      ? explicitName.trim()
      : typeof file.name === 'string'
        ? file.name
        : '';

  return {
    ok: true,
    contentType,
    base64Data: encodeUint8ArrayToBase64(bytes),
    fileName,
    byteLength,
  };
}

async function readStoredBase64(kv, parsed) {
  if (typeof parsed?.base64Data === 'string' && parsed.base64Data) {
    return parsed.base64Data;
  }

  const chunkCountRaw = parsed?.chunkCount;
  const chunkCount = Number(chunkCountRaw);
  const isChunked = parsed?.chunked === true && Number.isInteger(chunkCount) && chunkCount > 0;

  if (!isChunked) {
    return '';
  }

  let base64Data = '';
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = await kv.get(getChunkKey(index));
    if (typeof chunk !== 'string' || !chunk) {
      throw new Error(`Missing image chunk at index ${index}`);
    }
    base64Data += chunk;
  }

  return base64Data;
}

async function writeImagePayloadToKv(kv, payload, updatedAt) {
  let previousChunkCount = 0;
  try {
    const previousRaw = await kv.get(BACKGROUND_IMAGE_KEY);
    if (previousRaw) {
      const previousParsed = JSON.parse(previousRaw);
      const count = Number(previousParsed?.chunkCount);
      if (previousParsed?.chunked === true && Number.isInteger(count) && count > 0) {
        previousChunkCount = count;
      }
    }
  } catch {
    // ignore previous metadata parse errors
  }

  const chunks = splitIntoChunks(payload.base64Data, BASE64_CHUNK_SIZE);

  for (let index = 0; index < chunks.length; index += 1) {
    await kv.put(getChunkKey(index), chunks[index]);
  }

  await kv.put(
    BACKGROUND_IMAGE_KEY,
    JSON.stringify({
      contentType: payload.contentType,
      fileName: payload.fileName,
      byteLength: payload.byteLength,
      updatedAt,
      chunked: true,
      chunkCount: chunks.length,
      chunkSize: BASE64_CHUNK_SIZE,
      version: 2,
    })
  );

  if (typeof kv.delete === 'function' && previousChunkCount > chunks.length) {
    for (let index = chunks.length; index < previousChunkCount; index += 1) {
      await kv.delete(getChunkKey(index));
    }
  }
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
  if (!contentType.startsWith('image/')) {
    return jsonResponse({ error: 'Stored background image payload is incomplete' }, 500);
  }

  let base64Data = '';
  try {
    base64Data = await readStoredBase64(kv, parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: `Failed to read stored background image: ${message}` }, 500);
  }

  if (!base64Data) {
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

  const request = context.request;
  const requestContentType = (request.headers.get('content-type') || '').toLowerCase();

  const payload = requestContentType.includes('multipart/form-data')
    ? await buildImagePayloadFromFormData(request)
    : await (async () => {
        let body;
        try {
          body = await request.json();
        } catch {
          return {
            ok: false,
            error: 'Invalid JSON body',
            status: 400,
          };
        }

        return buildImagePayloadFromJson(body);
      })();

  if (!payload.ok) {
    return jsonResponse({ error: payload.error }, payload.status);
  }

  if (payload.byteLength > MAX_IMAGE_BYTES) {
    return jsonResponse(
      {
        error: `图片过大，当前限制 ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB`,
      },
      413
    );
  }

  const nowIso = new Date().toISOString();

  try {
    await writeImagePayloadToKv(kv, payload, nowIso);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: `背景图片写入 KV 失败：${message}` }, 500);
  }

  const cacheBustedUrl = `/background-image?v=${encodeURIComponent(nowIso)}`;

  return jsonResponse({
    imageUrl: cacheBustedUrl,
    updatedAt: nowIso,
    byteLength: payload.byteLength,
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
  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: `Internal server error: ${message}` }, 500);
  }
}
