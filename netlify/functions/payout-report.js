'use strict';
// payout-report.js — Rapport mensuel commissions MobiLoireConnect41
// GET  ?mois=YYYY-MM  → lit T4-Commissions et renvoie les lignes (affichage admin)
// POST { mois? }      → agrège T3-Courses → écrit T4-Commissions (idempotent)
// Netlify Scheduled Function : exécution auto le 1er du mois à 02:00 UTC

var utils = require('./utils');

exports.handler = async function(event) {
  var method = (event.httpMethod || 'GET').toUpperCase();
  var qs = event.queryStringParameters || {};
  var now = new Date();

  // ── GET : lecture de T4-Commissions pour affichage admin ──
  if (method === 'GET') {
    // Validation token admin (optionnel mais recommandé)
    var token = qs.token || '';
    if (token) {
      try { utils.verifySession(token); } catch(e) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Token invalide' }) };
      }
    }
    var mois = qs.mois || getLastMonthStr(now);
    try {
      var t4Rows = await utils.sheetsGet('T4-Commissions!A:H');
      var rows = t4Rows || [];
      var commissions = [];
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (!r[0]) continue;
        if (mois && r[0] !== mois) continue;
        commissions.push({
          mois:             r[0] || '',
          transporteur_id:  r[1] || '',
          transporteur_nom: r[2] || '',
          nb_courses:       parseInt(r[3]) || 0,
          ca_total:         parseFloat(r[4]) * 100 || 0,  // centimes pour affichage
          commission_smd:   parseFloat(r[5]) * 100 || 0,
          reversement:      parseFloat(r[6]) * 100 || 0,
          statut_virement:  r[7] || 'en_attente'
        });
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, mois: mois, commissions: commissions })
      };
    } catch(e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── POST / Scheduled : génération du rapport ──
  var body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  // Validation token admin si appel manuel
  if (body.token) {
    try { utils.verifySession(body.token); } catch(e) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token invalide' }) };
    }
  }

  var mois = body.mois || getLastMonthStr(now);
  console.log('[payout-report] Génération pour le mois :', mois);

  try {
    // 1. Lire T3-Courses
    var coursesRows = await utils.sheetsGet('T3-Courses!A:V');
    var courses = coursesRows || [];

    // 2. Lire T1-Transporteurs pour les noms
    var transRows = await utils.sheetsGet('T1-Transporteurs!A:M');
    var transporteurs = transRows || [];
    var transMap = {};
    for (var t = 1; t < transporteurs.length; t++) {
      var row = transporteurs[t];
      if (row[0]) transMap[row[0]] = row[1] || row[0];
    }

    // 3. Agréger les courses du mois
    // Col A=id H=statut N=transporteur_id R=capture_date S=montant_final U=commission V=reversement
    var stats = {};
    for (var i = 1; i < courses.length; i++) {
      var c = courses[i];
      var status       = (c[7]  || '').trim();
      var capture_date = (c[17] || '').trim();
      var trans_id     = (c[13] || '').trim();
      var montant      = parseFloat(c[18] || 0);
      var commission   = parseFloat(c[20] || 0);
      var reversement  = parseFloat(c[21] || 0);

      if (status !== 'captured' && status !== 'terminee') continue;
      if (!capture_date.startsWith(mois)) continue;
      if (!trans_id) continue;

      if (!stats[trans_id]) {
        stats[trans_id] = { nb: 0, ca: 0, commission: 0, reversement: 0 };
      }
      stats[trans_id].nb          += 1;
      stats[trans_id].ca          += montant;
      stats[trans_id].commission  += commission;
      stats[trans_id].reversement += reversement;
    }

    // 4. Idempotence : vérifier T4-Commissions
    var t4Rows2 = await utils.sheetsGet('T4-Commissions!A:H');
    var t4Data = t4Rows2 || [];
    var existingKeys = new Set();
    for (var r2 = 1; r2 < t4Data.length; r2++) {
      existingKeys.add((t4Data[r2][0] || '') + '_' + (t4Data[r2][1] || ''));
    }

    // 5. Écrire les nouvelles lignes
    var inserted = 0;
    for (var tid in stats) {
      var key = mois + '_' + tid;
      if (existingKeys.has(key)) { continue; }
      var s = stats[tid];
      var ligne = [
        mois, tid, transMap[tid] || tid,
        s.nb,
        s.ca.toFixed(2),
        s.commission.toFixed(2),
        s.reversement.toFixed(2),
        'en_attente'
      ];
      await utils.sheetsAppend('T4-Commissions!A:H', [ligne]);
      inserted++;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true, mois: mois,
        transporteurs: Object.keys(stats).length,
        inserted: inserted
      })
    };

  } catch(e) {
    console.error('[payout-report] Erreur :', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

function getLastMonthStr(date) {
  var d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
