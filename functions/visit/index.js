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

  return null;
}

export async function onRequest({ request, params, env }) {
  try {
    const kv = getKvBinding(env);

    if (!kv) {
      throw new Error(
        "KV namespace binding not found. Please bind namespace 'myhomepage' (fallback: 'my_kv')."
      );
    }

    const visitCount = await kv.get('visitCount');
    let visitCountInt = Number(visitCount);

    if (!Number.isFinite(visitCountInt)) {
      visitCountInt = 0;
    }

    visitCountInt += 1;
    await kv.put('visitCount', visitCountInt.toString());

    const res = JSON.stringify({
      visitCount: visitCountInt,
    });

    return new Response(res, {
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({
        error: "KV storage hasn't been set up for your EdgeOne Pages Project.",
      }),
      {
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
