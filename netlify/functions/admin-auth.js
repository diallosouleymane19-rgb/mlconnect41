// MobiLoireConnect41 — netlify/functions/admin-auth.js  v50
// R3 : rate limiting 5 tentatives / 15 min / IP
// R4 : PIN admin hashe (scrypt natif Node — pas de dependance npm, deploy drag&drop OK)
// ADMIN_PIN_HASH format "salt:hash_hex" — generer avec :
//   node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');console.log(s+':'+c.scryptSync(process.argv[1],s,32).toString('hex'))" VOTRE_PIN
'use strict';
var utils  = require('./utils');
var crypto = require('crypto');

function verifyPin(pin) {
  var stored = process.env.ADMIN_PIN_HASH || '';
  if (stored.indexOf(':') !== -1) {
    var salt = stored.split(':')[0];
    var expected = stored.split(':')[1];
    var derived = crypto.scryptSync(pin, salt, 32);
    var expBuf = Buffer.from(expected, 'hex');
    return derived.length === expBuf.length && crypto.timingSafeEqual(derived, expBuf);
  }
  // Fallback temporaire tant que ADMIN_PIN_HASH n'est pas defini dans Netlify ENV
  console.warn('[admin-auth] ADMIN_PIN_HASH absent — fallback ADMIN_PIN en clair (a corriger)');
  return pin === (process.env.ADMIN_PIN || '0000');
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  if (event.httpMethod !== 'POST') return utils.err(405, 'Methode non autorisee');
  var body;
  try { body = JSON.parse(event.body || '{}'); } catch(e) { return utils.err(400, 'JSON invalide'); }

  var ip = utils.getClientIp(event);
  var rgate = await utils.rateGate(ip, 'admin-auth');
  if (rgate.limited) return utils.err(429, 'Trop de tentatives. Reessayez dans 15 minutes.');

  var id  = (body.id  || '').trim();
  var pin = (body.pin || '').trim();
  var adminId = process.env.ADMIN_ID || 'ADMIN';
  if (id.toUpperCase() !== adminId.toUpperCase() || !verifyPin(pin)) {
    await utils.rateBump(rgate);
    return utils.err(401, 'Identifiant ou PIN incorrect');
  }
  await utils.rateClear(rgate);
  var token = utils.createSession({ id: adminId, role: 'admin', nom: 'Administrateur' });
  return utils.ok({ token: token, nom: 'Administrateur', role: 'admin' });
};
