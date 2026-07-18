// adapter.js — Pont Netlify Functions -> Next.js App Router (port Vercel)
// Convertit une Request Next.js en "event" Netlify, et la reponse
// { statusCode, headers, body } du handler en Response standard.
// IMPORTANT : le corps est lu avec req.text() (corps BRUT, jamais re-serialise)
// afin que la verification de signature Stripe (stripe-webhook) reste valide.
'use strict';

export async function toEvent(req) {
  const url = new URL(req.url);

  const headers = {};
  req.headers.forEach(function (value, key) {
    headers[key.toLowerCase()] = value;
  });

  const queryStringParameters = {};
  url.searchParams.forEach(function (value, key) {
    queryStringParameters[key] = value;
  });

  let body = '';
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.text(); // corps brut — indispensable pour stripe-webhook
  }

  return {
    httpMethod: req.method,
    headers: headers,
    queryStringParameters: queryStringParameters,
    body: body,
    path: url.pathname,
    rawUrl: req.url,
    isBase64Encoded: false
  };
}

export function toResponse(result) {
  if (!result || typeof result.statusCode !== 'number') {
    return new Response(JSON.stringify({ error: 'Reponse handler invalide' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(result.body != null ? result.body : '', {
    status: result.statusCode,
    headers: result.headers || { 'Content-Type': 'application/json' }
  });
}

// Fabrique les exports GET/POST/OPTIONS d'une route a partir d'un handler Netlify
export function makeRoute(handler) {
  const handle = async function (req) {
    return toResponse(await handler(await toEvent(req)));
  };
  return { GET: handle, POST: handle, OPTIONS: handle };
}
