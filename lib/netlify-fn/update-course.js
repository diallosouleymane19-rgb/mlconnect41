'use strict';
var utils = require('./utils');

var STATUTS_VALIDES = ['confirmee', 'refusee', 'en_cours', 'terminee'];

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  if (event.httpMethod !== 'POST') return utils.err(405, 'Methode non autorisee');

  var body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return utils.err(400, 'JSON invalide'); }

  var token = body.token;
  var course_id = body.course_id;
  var statut = body.statut;

  if (!token) return utils.err(400, 'token requis');
  if (!course_id) return utils.err(400, 'course_id requis');
  if (!statut) return utils.err(400, 'statut requis');
  if (STATUTS_VALIDES.indexOf(statut) === -1) return utils.err(400, 'statut invalide');

  var session;
  try { session = utils.verifySession(token); }
  catch (e) { return utils.err(401, e.message); }

  try {
    var rows = await utils.sheetsGet('T3-Courses!A:I');
    var rowIndex = rows.findIndex(function(r, i) {
      return i > 0 && (r[0] || '').trim() === course_id.trim() &&
             (r[8] || '').trim().toUpperCase() === session.id.toUpperCase();
    });

    if (rowIndex === -1) return utils.err(404, 'Course introuvable');

    var sheetRow = rowIndex + 1;
    await utils.sheetsUpdate('T3-Courses!H' + sheetRow, [[statut]]);

    console.log('[update-course] ' + course_id + ' -> ' + statut + ' (' + session.id + ')');

    if (statut === 'confirmee') {
      var webhookUrl = process.env.MAKE_WEBHOOK_SCENARIO_B;
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              course_id: course_id,
              statut: 'confirmee',
              transporteur_id: session.id,
              transporteur_nom: session.nom
            })
          });
        } catch (we) {
          console.error('[update-course] Webhook erreur:', we.message);
        }
      }
    }

    return utils.ok({ success: true, course_id: course_id, statut: statut });

  } catch (e) {
    console.error('[update-course] Erreur:', e.message);
    return utils.err(500, 'Erreur serveur: ' + e.message);
  }
};
