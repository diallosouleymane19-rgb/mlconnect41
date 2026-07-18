// MobiLoireConnect41 — lib/netlify-fn/utils.js  v36 (port Vercel)
// Pure Node.js 18 — pas de dependances npm
// Fix OpenSSL 3 DECODER : passage DER binaire direct (bypass PEM parsing)
'use strict';
var crypto = require('crypto');

// Extrait les bytes DER depuis une clé PEM (PKCS#8 ou PKCS#1)
function pemToDer(raw) {
  var pem = raw
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/\\r/g, '')
    .trim();
  // Supprimer tout header/footer PEM
  var b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  if (!b64) throw new Error('Cle privee vide apres extraction base64');
  return Buffer.from(b64, 'base64');
}

// Google Sheets Auth — JWT RS256 compatible Node 18 / OpenSSL 3
async function getAccessToken() {
  var rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!rawKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY manquante');
  var email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!email) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL manquante');

  var der = pemToDer(rawKey);
  var now = Math.floor(Date.now() / 1000);

  var header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  var payload = Buffer.from(JSON.stringify({
    iss:   email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now
  })).toString('base64url');

  var toSign = header + '.' + payload;

  // Essai 1 : DER PKCS#8 (format Google Service Account standard)
  var privateKey;
  try {
    privateKey = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  } catch(e1) {
    // Essai 2 : DER PKCS#1 RSA
    try {
      privateKey = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs1' });
    } catch(e2) {
      // Essai 3 : PEM brut reconstruit
      try {
        var lines = [];
        var b64str = der.toString('base64');
        for (var i = 0; i < b64str.length; i += 64) lines.push(b64str.slice(i, i + 64));
        var pem = '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----';
        privateKey = crypto.createPrivateKey({ key: pem, format: 'pem' });
      } catch(e3) {
        throw new Error('createPrivateKey echec: ' + e1.message + ' / ' + e2.message + ' / ' + e3.message);
      }
    }
  }

  var signer = crypto.createSign('RSA-SHA256');
  signer.update(toSign);
  var sig = signer.sign(privateKey, 'base64url');

  var res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: toSign + '.' + sig
    })
  });
  var data = await res.json();
  if (!data.access_token) throw new Error('Google OAuth2 echec: ' + JSON.stringify(data));
  return data.access_token;
}

// Google Sheets helpers (fetch natif — pas googleapis)
async function sheetsGet(range) {
  var token   = await getAccessToken();
  var sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID manquant');
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId +
            '/values/' + encodeURIComponent(range);
  var res  = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  var data = await res.json();
  if (data.error) throw new Error('Sheets GET [' + range + ']: ' + data.error.message);
  return data.values || [];
}

async function sheetsUpdate(range, values) {
  var token   = await getAccessToken();
  var sheetId = process.env.GOOGLE_SHEET_ID;
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId +
            '/values/' + encodeURIComponent(range) + '?valueInputOption=RAW';
  var res  = await fetch(url, {
    method:  'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: range, majorDimension: 'ROWS', values: values })
  });
  var data = await res.json();
  if (data.error) throw new Error('Sheets PUT [' + range + ']: ' + data.error.message);
  return data;
}

async function sheetsAppend(range, values) {
  var token   = await getAccessToken();
  var sheetId = process.env.GOOGLE_SHEET_ID;
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId +
            '/values/' + encodeURIComponent(range) +
            ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
  var res  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: range, majorDimension: 'ROWS', values: values })
  });
  var data = await res.json();
  if (data.error) throw new Error('Sheets APPEND [' + range + ']: ' + data.error.message);
  return data;
}

async function sheetsUpdateCell(range, value) {
  return sheetsUpdate(range, [[value]]);
}

// Session HMAC
function createSession(payload) {
  var secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET manquant');
  var data = Buffer.from(JSON.stringify(Object.assign({}, payload, { iat: Date.now() }))).toString('base64url');
  var sig  = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return data + '.' + sig;
}

function verifySession(token) {
  if (!token || typeof token !== 'string') throw new Error('Token manquant');
  var secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET manquant');
  var dot  = token.lastIndexOf('.');
  if (dot === -1) throw new Error('Token malforme');
  var data = token.slice(0, dot);
  var sig  = token.slice(dot + 1);
  var expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  var eBuf = Buffer.from(expected, 'base64url');
  var sBuf = Buffer.from(sig, 'base64url');
  if (eBuf.length !== sBuf.length || !crypto.timingSafeEqual(eBuf, sBuf))
    throw new Error('Signature invalide');
  var p = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  if (Date.now() - p.iat > 24 * 60 * 60 * 1000) throw new Error('Session expiree');
  return p;
}

// Rate limiting en memoire — R3 v50 : 5 tentatives / 15 min / IP
var RATE_MAX    = 5;
var RATE_WINDOW = 15 * 60 * 1000;
var rateMap     = new Map();

function getClientIp(event) {
  var h = event.headers || {};
  // Port Vercel : x-real-ip / x-vercel-forwarded-for en plus des en-tetes Netlify
  return h['x-nf-client-connection-ip'] || h['client-ip'] || h['x-real-ip'] ||
         (h['x-vercel-forwarded-for'] || '').split(',')[0].trim() ||
         (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

function rateLimited(ip) {
  var e = rateMap.get(ip);
  if (!e) return false;
  if (Date.now() - e.start > RATE_WINDOW) { rateMap.delete(ip); return false; }
  return e.count >= RATE_MAX;
}

function rateFail(ip) {
  var e = rateMap.get(ip);
  if (!e || Date.now() - e.start > RATE_WINDOW) e = { start: Date.now(), count: 0 };
  e.count++;
  rateMap.set(ip, e);
  if (rateMap.size > 5000) rateMap.clear(); // garde-fou memoire
}

function rateReset(ip) { rateMap.delete(ip); }

// v52 : rate limiting distribué via Netlify Blobs (compteur partagé entre conteneurs).
// Repli automatique sur le compteur mémoire si Blobs indisponible → le login ne casse jamais.
var _rlStore;
function rlStore() {
  // Port Vercel : Netlify Blobs n'existe pas sur Vercel -> repli sur le compteur
  // memoire par instance (meme comportement que le fallback v52 d'origine).
  if (_rlStore === undefined) _rlStore = null;
  return _rlStore;
}

// Ouvre une « porte » : renvoie { limited, ctx }. ctx sert aux bump/clear.
async function rateGate(ip, name) {
  var store = rlStore();
  if (!store) return { limited: rateLimited(ip), ctx: { mem: true, ip: ip } };
  var key = name + ':' + ip;
  try {
    var rec = await store.get(key, { type: 'json' });
    var now = Date.now();
    if (rec && (now - rec.start) <= RATE_WINDOW && rec.count >= RATE_MAX) {
      return { limited: true, ctx: { key: key, rec: rec, now: now, ip: ip } };
    }
    return { limited: false, ctx: { key: key, rec: rec, now: now, ip: ip } };
  } catch (e) {
    return { limited: rateLimited(ip), ctx: { mem: true, ip: ip } };
  }
}

// Enregistre un echec (tentative ratee)
async function rateBump(ctx) {
  if (!ctx || ctx.mem) { rateFail(ctx ? ctx.ip : 'unknown'); return; }
  var store = rlStore();
  if (!store) { rateFail(ctx.ip); return; }
  try {
    var rec = ctx.rec;
    if (!rec || (ctx.now - rec.start) > RATE_WINDOW) rec = { start: ctx.now, count: 0 };
    rec.count++;
    await store.setJSON(ctx.key, rec);
  } catch (e) { rateFail(ctx.ip); }
}

// Reinitialise (login reussi)
async function rateClear(ctx) {
  if (!ctx) return;
  if (ctx.mem) { rateReset(ctx.ip); return; }
  var store = rlStore();
  if (store && ctx.key) { try { await store.delete(ctx.key); } catch (e) {} }
  rateReset(ctx.ip);
}

// HTTP helpers
var CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

function ok(body)          { return { statusCode: 200, headers: CORS, body: JSON.stringify(body) }; }
function err(status, msg)  { return { statusCode: status, headers: CORS, body: JSON.stringify({ error: msg }) }; }
function preflight()       { return { statusCode: 200, headers: CORS, body: '' }; }

module.exports = {
  sheetsGet, sheetsUpdate, sheetsAppend, sheetsUpdateCell,
  createSession, verifySession,
  ok, err, preflight,
  getClientIp, rateLimited, rateFail, rateReset,
  rateGate, rateBump, rateClear
};
