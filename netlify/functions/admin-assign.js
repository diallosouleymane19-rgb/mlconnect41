'use strict';
var utils = require('./utils');
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  if (event.httpMethod !== 'POST') return utils.err(405, 'Methode non autorisee');
  var body;
  try { body = JSON.parse(event.body || '{}'); } catch(e) { return utils.err(400, 'JSON invalide'); }
  var token = body.token || '';
  var course_id = (body.course_id || '').trim();
  var tid = (body.transporteur_id || '').trim();
  var statut = (body.statut || 'confirmee').trim();
  try { var s = utils.verifySession(token); if (s.role !== 'admin') return utils.err(403, 'Acces refuse'); }
  catch(e) { return utils.err(401, e.message); }
  if (!course_id) return utils.err(400, 'course_id requis');
  try {
    var rows = await utils.sheetsGet('T3-Courses!A:A');
    var rowIndex = -1;
    for (var i = 1; i < rows.length; i++) {
      if ((rows[i][0]||'').trim() === course_id) { rowIndex = i + 1; break; }
    }
    if (rowIndex === -1) return utils.err(404, 'Course introuvable');
    await utils.sheetsUpdateCell('T3-Courses!I' + rowIndex, tid);
    await utils.sheetsUpdateCell('T3-Courses!H' + rowIndex, statut);
    return utils.ok({ success: true, course_id: course_id, transporteur_id: tid, statut: statut });
  } catch(e) {
    console.error('[admin-assign]', e.message);
    return utils.err(500, 'Erreur serveur: ' + e.message);
  }
};
