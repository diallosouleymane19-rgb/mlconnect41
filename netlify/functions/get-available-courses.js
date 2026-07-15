// MobiLoireConnect41 — netlify/functions/get-available-courses.js  v50
'use strict';
var utils = require('./utils');

// v49 fix : normalise le statut (espaces, casse, accents) avant comparaison
function normalizeStatut(s) {
  return (s || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}


var HEADERS_NO_CACHE = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type':  'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate'
};

function ok(body)    { return { statusCode: 200, headers: HEADERS_NO_CACHE, body: JSON.stringify(body) }; }
function err(s, msg) { return { statusCode: s,   headers: HEADERS_NO_CACHE, body: JSON.stringify({ error: msg }) }; }

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();

  var token = (event.queryStringParameters && event.queryStringParameters.token) ||
    ((event.headers && event.headers.authorization) || '').replace(/^Bearer\s+/i, '');
  if (!token) return err(401, 'Token requis');

  var session;
  try { session = utils.verifySession(token); }
  catch(e) { return err(401, e.message); }

  var myId = (session.id || '').trim();
  console.log('[get-available-courses] v48 transporteur_id:', myId);

  try {
    var rows = await utils.sheetsGet('T3-Courses!A:T');
    var total_data = rows ? Math.max(0, rows.length - 1) : 0;
    console.log('[get-available-courses] lignes dans la feuille (hors header):', total_data);

    if (!rows || rows.length < 2) {
      console.log('[get-available-courses] feuille vide ou header seulement');
      return ok({ courses: [], total_rows: 0, en_attente: 0, debug: 'sheet_vide' });
    }

    var dataRows = rows.slice(1);

    // Log des 5 premières lignes pour diagnostic
    dataRows.slice(0, 5).forEach(function(r, i) {
      console.log('[get-available-courses] row ' + (i+2) + ': id=' + (r[0]||'') +
        ' statut="' + (r[7]||'') + '" transporteur="' + (r[8]||'') + '"');
    });

    var en_attente_count = dataRows.filter(function(r) {
      return normalizeStatut(r[7]) === 'en_attente';
    }).length;

    var courses = dataRows
      .filter(function(r) {
        var statut       = normalizeStatut(r[7]);
        var transporteur = (r[8] || '').trim();
        return statut === 'en_attente' && (transporteur === '' || transporteur === myId);
      })
      .map(function(r) {
        return {
          id:            r[0] || '',
          date:          r[1] || '',
          heure:         r[2] || '',
          passager:      r[3] || '',
          tel_passager:  r[4] || '',
          depart:        r[5] || '',
          arrivee:       r[6] || '',
          statut:        r[7] || 'en_attente',
          ref:           r[11] || '',
          motif:         r[12] || '',
          type_service:  r[13] || '',
          prescription:  r[14] || '',
          montant_estime: parseFloat(r[19] || '') || 0
        };
      });

    console.log('[get-available-courses] courses trouvées:', courses.length,
      '| total_data:', total_data, '| en_attente:', en_attente_count);

    return ok({
      courses:    courses,
      total_rows: total_data,
      en_attente: en_attente_count
    });

  } catch(e) {
    console.error('[get-available-courses] ERREUR:', e.message);
    return err(500, 'Erreur serveur: ' + e.message);
  }
};
