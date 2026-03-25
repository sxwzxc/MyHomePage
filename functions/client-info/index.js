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

function extractIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const realIp = request.headers.get('x-real-ip') || '';
  const cfIp = request.headers.get('cf-connecting-ip') || '';

  const candidates = [cfIp, realIp, forwardedFor]
    .map((item) => item.split(',')[0].trim())
    .filter(Boolean);

  const ip = candidates[0] || '';

  if (!ip) {
    return 'unknown';
  }

  // IPv6 mapped IPv4: ::ffff:1.2.3.4
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '');
  }

  return ip;
}

function isPrivateIp(ip) {
  return (
    ip === 'unknown' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.')
  );
}

async function getGeoInfo(ip) {
  if (isPrivateIp(ip)) {
    return null;
  }

  const resp = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`Geo lookup failed: ${resp.status}`);
  }

  const data = await resp.json();

  return {
    city: data.city || '',
    region: data.region || '',
    country: data.country_name || data.country || '',
  };
}

export async function onRequestOptions() {
  return new Response('ok', {
    headers: getHeaders(),
  });
}

export async function onRequestGet({ request }) {
  try {
    const ip = extractIp(request);

    let city = '';
    let region = '';
    let country = '';

    try {
      const geo = await getGeoInfo(ip);
      city = geo?.city || '';
      region = geo?.region || '';
      country = geo?.country || '';
    } catch (err) {
      console.error('Geo lookup failed:', err);
    }

    const location = [city, region, country].filter(Boolean).join(' · ');

    return jsonResponse({
      ip,
      location,
      city,
      region,
      country,
    });
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
