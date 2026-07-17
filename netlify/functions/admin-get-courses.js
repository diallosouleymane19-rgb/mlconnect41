'use strict';
var utils = require('./utils');
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  var token = (event.queryStringParameters && event.queryStringParameters.token) || '';
  if (!token) return utils.err(401, 'Token requis');
  try { var s = utils.verifySession(token); if (s.role !== 'admin') return utils.err(403, 'Acces refuse'); }
  catch(e) { return utils.err(401, e.message); }
  try {
    var rows = await utils.sheetsGet('T3-Courses!A:M');
    if (!rows || rows.length < 2) return utils.ok({ courses: [] });
    var courses = rows.slice(1).filter(function(r){ return r[0]; }).map(function(r) {
      return { id:r[0]||'', date:r[1]||'', heure:r[2]||'', passager:r[3]||'',
        tel:r[4]||'', depart:r[5]||'', arrivee:r[6]||'',
        statut:r[7]||'en_attente', transporteur_id:r[8]||'',
        notes:r[10]||'', ref:r[11]||'', motif:r[12]||''};
    });
    var O={en_attente:0,confirmee:1,en_cours:2,terminee:3,refusee:4};
    courses.sort(function(a,b){return (O[a.statut]||9)-(O[b.statut]||9);});
    return utils.ok({ courses: courses });
  } catch(e) { return utils.err(500, 'Erreur serveur'); }
};
