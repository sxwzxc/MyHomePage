const BACKGROUND_IMAGE_KEY = 'homepage:background:image:v1';
const BACKGROUND_IMAGE_STREAM_KEY = `${BACKGROUND_IMAGE_KEY}:stream`;
const BACKGROUND_IMAGE_UPLOAD_PREFIX = `${BACKGROUND_IMAGE_KEY}:upload:`;
const BACKGROUND_IMAGE_CHUNK_PREFIX = `${BACKGROUND_IMAGE_KEY}:chunk:`;

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const BASE64_CHUNK_SIZE = 256 * 1024;
const UPLOAD_REQUEST_CHUNK_BYTE_LIMIT = 512 * 1024;
const MAX_UPLOAD_CHUNK_BASE64_LENGTH =
  Math.ceil((UPLOAD_REQUEST_CHUNK_BYTE_LIMIT * 4) / 3) + 16;

function getChunkKey(index) {
  return `${BACKGROUND_IMAGE_CHUNK_PREFIX}${index}`;
}

function getUploadMetaKey(uploadId) {
  return `${BACKGROUND_IMAGE_UPLOAD_PREFIX}${uploadId}:meta`;
}

function getUploadChunkKey(uploadId, index) {
  return `${BACKGROUND_IMAGE_UPLOAD_PREFIX}${uploadId}:chunk:${index}`;
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

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function createUploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `u_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function isSafeUploadId(uploadId) {
  return typeof uploadId === 'string' && /^u_[a-zA-Z0-9_]{10,80}$/.test(uploadId);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function createReadableStreamFromBase64(base64Data) {
  let index = 0;
  const chunks = splitIntoChunks(base64Data, BASE64_CHUNK_SIZE);

  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }

      try {
        controller.enqueue(decodeBase64ToUint8Array(chunks[index]));
        index += 1;
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function getPreviousLegacyChunkCount(kv) {
  try {
    const previousRaw = await kv.get(BACKGROUND_IMAGE_KEY);
    if (!previousRaw) {
      return 0;
    }

    const previousParsed = JSON.parse(previousRaw);
    const count = Number(previousParsed?.chunkCount);
    if (previousParsed?.chunked === true && Number.isInteger(count) && count > 0) {
      return count;
    }
  } catch {
    // ignore parse failures
  }

  return 0;
}

async function cleanupLegacyChunks(kv, chunkCount) {
  if (typeof kv.delete !== 'function') {
    return;
  }

  if (!Number.isInteger(chunkCount) || chunkCount <= 0) {
    return;
  }

  for (let index = 0; index < chunkCount; index += 1) {
    await kv.delete(getChunkKey(index));
  }
}

async function writeImageStreamToKv(kv, payloadMeta, stream, updatedAt) {
  const previousLegacyChunkCount = await getPreviousLegacyChunkCount(kv);

  await kv.put(BACKGROUND_IMAGE_STREAM_KEY, stream);
  await kv.put(
    BACKGROUND_IMAGE_KEY,
    JSON.stringify({
      contentType: payloadMeta.contentType,
      fileName: payloadMeta.fileName,
      byteLength: payloadMeta.byteLength,
      updatedAt,
      storageType: 'stream',
      streamKey: BACKGROUND_IMAGE_STREAM_KEY,
      version: 3,
    })
  );

  await cleanupLegacyChunks(kv, previousLegacyChunkCount);
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

async function readUploadMeta(kv, uploadId) {
  const raw = await kv.get(getUploadMetaKey(uploadId));
  if (!raw) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const contentType = typeof parsed?.contentType === 'string' ? parsed.contentType : '';
  const fileName = typeof parsed?.fileName === 'string' ? parsed.fileName : '';
  const byteLength = Number(parsed?.byteLength);
  const totalChunks = Number(parsed?.totalChunks);
  const chunkByteLength = Number(parsed?.chunkByteLength);

  if (!contentType.startsWith('image/')) {
    return null;
  }

  if (!Number.isInteger(byteLength) || byteLength <= 0 || byteLength > MAX_IMAGE_BYTES) {
    return null;
  }

  if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > 4096) {
    return null;
  }

  if (
    !Number.isInteger(chunkByteLength) ||
    chunkByteLength <= 0 ||
    chunkByteLength > UPLOAD_REQUEST_CHUNK_BYTE_LIMIT
  ) {
    return null;
  }

  return {
    uploadId,
    contentType,
    fileName,
    byteLength,
    totalChunks,
    chunkByteLength,
  };
}

async function cleanupUploadSession(kv, uploadId, totalChunks) {
  if (typeof kv.delete !== 'function') {
    return;
  }

  await kv.delete(getUploadMetaKey(uploadId));

  if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
    return;
  }

  for (let index = 0; index < totalChunks; index += 1) {
    await kv.delete(getUploadChunkKey(uploadId, index));
  }
}

async function ensureUploadChunksComplete(kv, meta) {
  let totalBytes = 0;

  for (let index = 0; index < meta.totalChunks; index += 1) {
    const chunkBase64 = await kv.get(getUploadChunkKey(meta.uploadId, index));
    if (typeof chunkBase64 !== 'string' || !chunkBase64) {
      throw new Error(`Missing upload chunk at index ${index}`);
    }

    const chunkByteLength = base64ByteLength(chunkBase64);
    if (!Number.isFinite(chunkByteLength) || chunkByteLength <= 0) {
      throw new Error(`Upload chunk at index ${index} is invalid`);
    }

    if (chunkByteLength > meta.chunkByteLength) {
      throw new Error(`Upload chunk at index ${index} exceeds byte limit`);
    }

    if (index < meta.totalChunks - 1 && chunkByteLength !== meta.chunkByteLength) {
      throw new Error(`Upload chunk at index ${index} has unexpected size`);
    }

    totalBytes += chunkByteLength;
  }

  if (totalBytes !== meta.byteLength) {
    throw new Error(
      `Upload size mismatch: expected ${meta.byteLength} bytes, got ${totalBytes} bytes`
    );
  }
}

function createUploadChunkStream(kv, meta) {
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index >= meta.totalChunks) {
        controller.close();
        return;
      }

      try {
        const chunkBase64 = await kv.get(getUploadChunkKey(meta.uploadId, index));
        if (typeof chunkBase64 !== 'string' || !chunkBase64) {
          throw new Error(`Missing upload chunk at index ${index}`);
        }

        controller.enqueue(decodeBase64ToUint8Array(chunkBase64));
        index += 1;
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function handleUploadInit(kv, body) {
  const contentType =
    typeof body?.contentType === 'string' ? body.contentType.toLowerCase().trim() : '';
  if (!contentType.startsWith('image/')) {
    return jsonResponse({ error: '仅支持图片文件上传' }, 400);
  }

  const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : '';
  const byteLength = Number(body?.byteLength);

  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    return jsonResponse({ error: 'byteLength must be a positive integer' }, 400);
  }

  if (byteLength > MAX_IMAGE_BYTES) {
    return jsonResponse(
      {
        error: `图片过大，当前限制 ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB`,
      },
      413
    );
  }

  const requestedChunkByteLength = Number(body?.chunkByteLength);
  const chunkByteLength = Math.max(
    64 * 1024,
    Math.min(
      UPLOAD_REQUEST_CHUNK_BYTE_LIMIT,
      Number.isInteger(requestedChunkByteLength)
        ? requestedChunkByteLength
        : UPLOAD_REQUEST_CHUNK_BYTE_LIMIT
    )
  );
  const totalChunks = Math.max(1, Math.ceil(byteLength / chunkByteLength));

  const uploadId = createUploadId();
  await kv.put(
    getUploadMetaKey(uploadId),
    JSON.stringify({
      uploadId,
      contentType,
      fileName,
      byteLength,
      chunkByteLength,
      totalChunks,
      createdAt: new Date().toISOString(),
      version: 1,
    })
  );

  return jsonResponse({
    uploadId,
    chunkByteLength,
    totalChunks,
    byteLength,
  });
}

async function handleUploadChunk(kv, body) {
  const uploadId = typeof body?.uploadId === 'string' ? body.uploadId.trim() : '';
  if (!isSafeUploadId(uploadId)) {
    return jsonResponse({ error: 'Invalid uploadId' }, 400);
  }

  const index = Number(body?.index);
  if (!Number.isInteger(index) || index < 0) {
    return jsonResponse({ error: 'Invalid chunk index' }, 400);
  }

  const chunkBase64 = typeof body?.chunkBase64 === 'string' ? body.chunkBase64.trim() : '';
  if (!chunkBase64) {
    return jsonResponse({ error: 'chunkBase64 is required' }, 400);
  }

  if (chunkBase64.length > MAX_UPLOAD_CHUNK_BASE64_LENGTH) {
    return jsonResponse({ error: 'Chunk payload too large' }, 413);
  }

  const meta = await readUploadMeta(kv, uploadId);
  if (!meta) {
    return jsonResponse({ error: 'Upload session not found or expired' }, 404);
  }

  if (index >= meta.totalChunks) {
    return jsonResponse({ error: 'Chunk index out of range' }, 400);
  }

  const chunkByteLength = base64ByteLength(chunkBase64);
  if (!Number.isFinite(chunkByteLength) || chunkByteLength <= 0) {
    return jsonResponse({ error: 'Invalid chunk payload' }, 400);
  }

  if (chunkByteLength > meta.chunkByteLength) {
    return jsonResponse({ error: 'Chunk payload exceeds configured byte length' }, 413);
  }

  if (index < meta.totalChunks - 1 && chunkByteLength !== meta.chunkByteLength) {
    return jsonResponse({ error: 'Chunk payload size mismatch' }, 400);
  }

  await kv.put(getUploadChunkKey(uploadId, index), chunkBase64);

  return jsonResponse({
    uploadId,
    index,
    received: true,
    chunkByteLength,
  });
}

async function handleUploadCommit(kv, body) {
  const uploadId = typeof body?.uploadId === 'string' ? body.uploadId.trim() : '';
  if (!isSafeUploadId(uploadId)) {
    return jsonResponse({ error: 'Invalid uploadId' }, 400);
  }

  const meta = await readUploadMeta(kv, uploadId);
  if (!meta) {
    return jsonResponse({ error: 'Upload session not found or expired' }, 404);
  }

  const nowIso = new Date().toISOString();

  try {
    await ensureUploadChunksComplete(kv, meta);

    const stream = createUploadChunkStream(kv, meta);
    await writeImageStreamToKv(
      kv,
      {
        contentType: meta.contentType,
        fileName: meta.fileName,
        byteLength: meta.byteLength,
      },
      stream,
      nowIso
    );

    await cleanupUploadSession(kv, uploadId, meta.totalChunks);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message.includes('Missing upload chunk') ||
      message.includes('size mismatch') ||
      message.includes('Upload chunk')
        ? 400
        : 500;

    return jsonResponse({ error: `背景图片分片合并失败：${message}` }, status);
  }

  const cacheBustedUrl = `/background-image?v=${encodeURIComponent(nowIso)}`;

  return jsonResponse({
    imageUrl: cacheBustedUrl,
    updatedAt: nowIso,
    byteLength: meta.byteLength,
  });
}

async function handleUploadAbort(kv, body) {
  const uploadId = typeof body?.uploadId === 'string' ? body.uploadId.trim() : '';
  if (!isSafeUploadId(uploadId)) {
    return jsonResponse({ error: 'Invalid uploadId' }, 400);
  }

  const meta = await readUploadMeta(kv, uploadId);
  if (meta) {
    await cleanupUploadSession(kv, uploadId, meta.totalChunks);
  } else if (typeof kv.delete === 'function') {
    await kv.delete(getUploadMetaKey(uploadId));
  }

  return jsonResponse({
    uploadId,
    aborted: true,
  });
}

async function handleLegacyPost(kv, request) {
  const requestContentType = (request.headers.get('content-type') || '').toLowerCase();

  const payload = requestContentType.includes('multipart/form-data')
    ? await buildImagePayloadFromFormData(request)
    : await (async () => {
        const body = await readJsonBody(request);
        if (!body) {
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
    const stream = createReadableStreamFromBase64(payload.base64Data);
    await writeImageStreamToKv(
      kv,
      {
        contentType: payload.contentType,
        fileName: payload.fileName,
        byteLength: payload.byteLength,
      },
      stream,
      nowIso
    );
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

  if (parsed?.storageType === 'stream') {
    const streamKey =
      typeof parsed?.streamKey === 'string' && parsed.streamKey
        ? parsed.streamKey
        : BACKGROUND_IMAGE_STREAM_KEY;

    try {
      const stream = await kv.get(streamKey, { type: 'stream' });
      if (!stream) {
        return jsonResponse({ error: 'Stored background image stream not found' }, 500);
      }

      return new Response(stream, {
        status: 200,
        headers: getHeaders({
          'content-type': contentType,
          'cache-control': 'public, max-age=60',
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonResponse({ error: `Failed to read stored background image stream: ${message}` }, 500);
    }
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
  const url = new URL(request.url);
  const action = (url.searchParams.get('action') || '').trim().toLowerCase();

  if (action) {
    const body = await readJsonBody(request);
    if (!body) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (action === 'init') {
      return handleUploadInit(kv, body);
    }

    if (action === 'chunk') {
      return handleUploadChunk(kv, body);
    }

    if (action === 'commit') {
      return handleUploadCommit(kv, body);
    }

    if (action === 'abort') {
      return handleUploadAbort(kv, body);
    }

    return jsonResponse({ error: `Unsupported upload action: ${action}` }, 400);
  }

  return handleLegacyPost(kv, request);
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
