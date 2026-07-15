'use strict';
// auth.js — Login transporteur par PIN — MobiLoireConnect41 v41
// Lit jusqu'à la colonne M pour inclure stripe_account_id (col M = index 12)
const { sheetsGet, createSession, ok, err, preflight, getClientIp, rateLimited, rateFail, rateReset } = require('./utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err(405, 'Methode non autorisee');

  var body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return err(400, 'JSON invalide'); }

  var id  = (body.id  || '').trim();
  var pin = (body.pin || '').trim();
  if (!id || !pin) return err(400, 'Champs id et pin requis');

  // R3 v50 : rate limiting 5 tentatives / 15 min / IP
  var ip = getClientIp(event);
  if (rateLimited(ip)) return err(429, 'Trop de tentatives. Reessayez dans 15 minutes.');

  try {
    var rows = await sheetsGet('T1-Transporteurs!A:M'); // Étendu jusqu'à M (stripe_account_id)
    var dataRows = rows.slice(1);

    await new Promise(function(r) { setTimeout(r, 300); });

    var found = dataRows.find(function(r) {
      return (r[0] || '').trim().toUpperCase() === id.toUpperCase() &&
             (r[11] || '').trim() === pin;
    });

    if (!found) { rateFail(ip); return err(401, 'Identifiant ou PIN incorrect'); }

    rateReset(ip);
    var stripe_account_id = (found[12] || '').trim(); // col M

    var token = createSession({
      id:      (found[0] || '').trim(),
      nom:     (found[1] || '').trim(),
      type:    (found[2] || '').trim(),
      commune: (found[3] || '').trim()
    });

    return ok({
      token:              token,
      id:                 (found[0] || '').trim(),
      nom:                (found[1] || '').trim(),
      type:               (found[2] || '').trim(),
      commune:            (found[3] || '').trim(),
      stripe_account_id:  stripe_account_id,
      stripe_actif:       stripe_account_id !== ''
    });

  } catch (e) {
    console.error('[auth] Erreur:', e.message);
    return err(500, 'Erreur serveur: ' + e.message);
  }
};
