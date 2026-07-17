'use strict';
var utils = require('./utils');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();

  var token = (event.queryStringParameters && event.queryStringParameters.token) ||
    ((event.headers && event.headers.authorization) || '').replace(/^Bearer\s+/i, '');

  if (!token) return utils.err(401, 'Token requis');

  var session;
  try { session = utils.verifySession(token); }
  catch (e) { return utils.err(401, e.message); }

  try {
    var rows = await utils.sheetsGet('T3-Courses!A:T');
    if (!rows || rows.length < 2) return utils.ok({ courses: [] });

    var dataRows = rows.slice(1);
    var courses = dataRows
      .filter(function(r) {
        return (r[8] || '').trim().toUpperCase() === session.id.toUpperCase();
      })
      .map(function(r) {
        return {
          id:          r[0] || '',
          date:        r[1] || '',
          heure:       r[2] || '',
          passager:    r[3] || '',
          tel_passager:r[4] || '',
          depart:      r[5] || '',
          arrivee:     r[6] || '',
          statut:      r[7] || 'en_attente',
          prix:        parseFloat(r[19] || '') || 0,
          notes:       r[10] || ''
        };
      });

    var ORDER = { en_attente: 0, confirmee: 1, en_cours: 2, terminee: 3, refusee: 4 };
    courses.sort(function(a, b) {
      return (ORDER[a.statut] !== undefined ? ORDER[a.statut] : 9) -
             (ORDER[b.statut] !== undefined ? ORDER[b.statut] : 9);
    });

    return utils.ok({ courses: courses });

  } catch (e) {
    console.error('[get-courses] Erreur:', e.message);
    return utils.err(500, 'Erreur serveur');
  }
};
