// MobiLoireConnect41 — netlify/functions/accept-course.js  v50
// Phase 2 : premier transporteur a cliquer "Accepter" remporte la course
// Verrou optimiste : re-lit la ligne avant d'ecrire → 409 si deja prise
'use strict';
var utils = require('./utils');

// v49 fix : normalise le statut (espaces, casse, accents) avant comparaison
function normalizeStatut(s) {
  return (s || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}


exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  if (event.httpMethod !== 'POST') return utils.err(405, 'Methode non autorisee');

  var body;
  try { body = JSON.parse(event.body || '{}'); }
  catch(e) { return utils.err(400, 'JSON invalide'); }

  var token     = (body.token     || '').trim();
  var course_id = (body.course_id || '').trim();
  if (!token)     return utils.err(400, 'token requis');
  if (!course_id) return utils.err(400, 'course_id requis');

  var session;
  try { session = utils.verifySession(token); }
  catch(e) { return utils.err(401, e.message); }

  try {
    // Lire toute la feuille pour trouver la ligne
    var rows = await utils.sheetsGet('T3-Courses!A:J');

    var rowIndex = -1;
    var courseRow = null;
    for (var i = 1; i < rows.length; i++) {
      if ((rows[i][0] || '').trim() === course_id) {
        rowIndex  = i + 1; // ligne Google Sheets (1-indexed, +1 pour header)
        courseRow = rows[i];
        break;
      }
    }

    if (rowIndex === -1) return utils.err(404, 'Course introuvable');

    var statut       = normalizeStatut(courseRow[7]);
    var transporteur = (courseRow[8] || '').trim();

    // Verrou : course deja prise ou plus en attente → 409 Conflict
    if (statut !== 'en_attente' || transporteur !== '') {
      return utils.err(409, 'Course deja acceptee par un autre transporteur');
    }

    // Ecriture atomique : affecter le transporteur + passer en "confirmee"
    await utils.sheetsUpdate('T3-Courses!H' + rowIndex + ':J' + rowIndex, [[
      'confirmee',
      session.id,
      session.nom || session.id
    ]]);

    // Declencher le webhook Make.com Scenario B (confirmation)
    var webhookUrl = process.env.MAKE_WEBHOOK_SCENARIO_B;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            course_id:        course_id,
            statut:           'confirmee',
            transporteur_id:  session.id,
            transporteur_nom: session.nom || session.id
          })
        });
      } catch(we) {
        console.warn('[accept-course] Webhook erreur:', we.message);
      }
    }

    return utils.ok({
      success:          true,
      course_id:        course_id,
      statut:           'confirmee',
      transporteur_id:  session.id,
      transporteur_nom: session.nom || session.id
    });

  } catch(e) {
    console.error('[accept-course]', e.message);
    return utils.err(500, 'Erreur serveur: ' + e.message);
  }
};
