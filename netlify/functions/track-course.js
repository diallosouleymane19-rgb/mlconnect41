'use strict';
var utils = require('./utils');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  var ref = (event.queryStringParameters && event.queryStringParameters.ref) || '';
  if (!ref) return utils.err(400, 'Reference requise');
  try {
    var rows = await utils.sheetsGet('T3-Courses!A:M');
    if (!rows || rows.length < 2) return utils.err(404, 'Course introuvable');
    var found = rows.slice(1).find(function(r) {
      return (r[11]||'  ').trim().toUpperCase() === ref.trim().toUpperCase();
    });
    if (!found) return utils.err(404, 'Reference introuvable');
    // v51 sécurité : ne renvoie PAS le tel passager ni le motif médical
    // (protège contre le brute-force de références — RGPD/données de santé)
    var result = {
      id:found[0]||'', date:found[1]||'', heure:found[2]||'',
      depart:found[5]||'', arrivee:found[6]||'',
      statut:found[7]||'en_attente',
      ref:found[11]||''
    };
    if (result.transporteur_id) {
      var tRows = await utils.sheetsGet('T1-Transporteurs!A:L');
      var t = (tRows||[]).slice(1).find(function(r) {
        return (r[0]||'').toUpperCase() === result.transporteur_id.toUpperCase();
      });
      if (t) { result.transporteur_nom = t[1]||''; result.transporteur_tel = t[4]||''; }
    }
    return utils.ok(result);
  } catch(e) { return utils.err(500, 'Erreur serveur'); }
};
