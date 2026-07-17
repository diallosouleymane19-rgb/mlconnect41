'use strict';
var utils = require('./utils');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  if (event.httpMethod !== 'POST') return utils.err(405, 'Methode non autorisee');

  var body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return utils.err(400, 'JSON invalide'); }

  var token = body.token;
  var player_id = body.player_id;
  if (!token) return utils.err(400, 'token requis');
  if (!player_id) return utils.err(400, 'player_id requis');

  var session;
  try { session = utils.verifySession(token); }
  catch (e) { return utils.err(401, e.message); }

  try {
    var rows = await utils.sheetsGet('T1-Transporteurs!A:A');
    var rowIndex = rows.findIndex(function(r, i) {
      return i > 0 && (r[0] || '').trim().toUpperCase() === session.id.toUpperCase();
    });

    if (rowIndex === -1) return utils.err(404, 'Transporteur introuvable');

    var sheetRow = rowIndex + 1;
    await utils.sheetsUpdate('T1-Transporteurs!K' + sheetRow, [[player_id]]);

    console.log('[update-player] ' + session.id + ' -> player_id ' + player_id);
    return utils.ok({ success: true });

  } catch (e) {
    console.error('[update-player] Erreur:', e.message);
    return utils.err(500, 'Erreur serveur: ' + e.message);
  }
};
