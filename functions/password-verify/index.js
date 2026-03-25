function getHeaders() {
  return {
    'content-type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: getHeaders(),
  });
}

function getExpectedPassword(env) {
  if (env && typeof env.password === 'string' && env.password.trim()) {
    return env.password;
  }

  if (typeof process !== 'undefined' && process.env && process.env.password) {
    return process.env.password;
  }

  if (typeof globalThis !== 'undefined' && typeof globalThis.password === 'string') {
    return globalThis.password;
  }

  return '';
}

export async function onRequestOptions() {
  return new Response('ok', {
    headers: getHeaders(),
  });
}

export async function onRequestPost({ request, env }) {
  const expectedPassword = getExpectedPassword(env);

  if (!expectedPassword) {
    return jsonResponse({ error: 'Server password is not configured' }, 500);
  }

  try {
    const body = await request.json();
    const password =
      body && typeof body === 'object' && typeof body.password === 'string'
        ? body.password
        : '';

    return jsonResponse({ verified: password === expectedPassword });
  } catch (err) {
    return jsonResponse(
      { error: err && err.message ? err.message : String(err) },
      400
    );
  }
}

export async function onRequest(context) {
  const method = context.request.method;

  if (method === 'OPTIONS') {
    return onRequestOptions(context);
  }

  if (method === 'POST') {
    return onRequestPost(context);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
