'use strict';
// confirm-payment.js — Capture le paiement + mise à jour Sheets
// Modèle B : pas de Stripe Connect — tout va sur le compte SMD
// MobiLoireConnect41 v45

var utils = require('./utils');

async function stripeRequest(method, path, data, sk) {
  var body;
  if (method !== 'GET' && data) {
    body = Object.keys(data).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
    }).join('&');
  }
  var res = await fetch('https://api.stripe.com/v1' + path, {
    method: method,
    headers: {
      'Authorization': 'Basic ' + Buffer.from(sk + ':').toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  });
  return res.json();
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  if (event.httpMethod !== 'POST') return utils.err(405, 'Méthode non autorisée');

  var session;
  try { session = utils.verifySession((event.headers['authorization'] || '').replace(/^Bearer /i, '')); }
  catch(e) { return utils.err(401, 'Session invalide'); }

  var body;
  try { body = JSON.parse(event.body || '{}'); } catch(e) { return utils.err(400, 'JSON invalide'); }

  var courseId      = (body.courseId || '').trim();
  var pi_id         = (body.payment_intent_id || '').trim();
  var montant_final = parseFloat(body.montant_final || 0);

  if (!courseId) return utils.err(400, 'courseId requis');
  if (!pi_id)    return utils.err(400, 'payment_intent_id requis');

  var sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return utils.err(500, 'STRIPE_SECRET_KEY non configuré');

  // 1. Récupérer le Payment Intent
  var pi;
  try { pi = await stripeRequest('GET', '/payment_intents/' + pi_id, null, sk); }
  catch(e) { return utils.err(500, 'Erreur Stripe GET : ' + e.message); }
  if (pi.error) return utils.err(400, 'Stripe : ' + pi.error.message);
  if (pi.status !== 'requires_capture') {
    return utils.err(400, 'Payment Intent non capturable — statut : ' + pi.status);
  }

  // 2. Capture (avec ajustement montant si différent de l'estimé)
  var captureData = {};
  if (montant_final > 0) {
    var montant_final_cents = Math.round(montant_final * 100);
    if (montant_final_cents !== pi.amount) {
      captureData['amount_to_capture'] = montant_final_cents;
    }
  }

  var captured;
  try { captured = await stripeRequest('POST', '/payment_intents/' + pi_id + '/capture', captureData, sk); }
  catch(e) { return utils.err(500, 'Erreur Stripe capture : ' + e.message); }
  if (captured.error) return utils.err(400, 'Stripe capture : ' + captured.error.message);

  // 3. Calcul commission et reversement (comptabilité interne SMD)
  var meta          = pi.metadata || {};
  var type_t        = meta.type_transporteur || 'taxi';
  var COMMISSIONS   = {
    taxi:    parseFloat(process.env.COMMISSION_TAXI    || '0.10'),
    vtc:     parseFloat(process.env.COMMISSION_VTC     || '0.12'),
    medical: parseFloat(process.env.COMMISSION_MEDICAL || '0.08')
  };
  var taux              = COMMISSIONS[type_t] || 0.10;
  var montant_reel      = captured.amount / 100;
  var commission_finale = Math.round(montant_reel * taux * 100) / 100;
  var reversement_final = Math.round((montant_reel - commission_finale) * 100) / 100;
  var capture_date      = new Date().toISOString();

  // 4. Mise à jour Google Sheets T3-Courses
  // H=Statut P=pi_id Q=payment_status R=capture_date S=montant_final U=commission_smd V=reversement_transporteur
  try {
    var rows = await utils.sheetsGet('T3-Courses!A:A');
    var rowIndex = -1;
    for (var i = 1; i < (rows || []).length; i++) {
      if ((rows[i][0] || '') === courseId) { rowIndex = i + 1; break; }
    }
    if (rowIndex > 0) {
      await utils.sheetsUpdateCell('T3-Courses!H' + rowIndex, 'terminee');
      await utils.sheetsUpdateCell('T3-Courses!P' + rowIndex, pi_id);
      await utils.sheetsUpdateCell('T3-Courses!Q' + rowIndex, 'captured');
      await utils.sheetsUpdateCell('T3-Courses!R' + rowIndex, capture_date);
      await utils.sheetsUpdateCell('T3-Courses!S' + rowIndex, montant_reel.toFixed(2));
      await utils.sheetsUpdateCell('T3-Courses!U' + rowIndex, commission_finale.toFixed(2));
      await utils.sheetsUpdateCell('T3-Courses!V' + rowIndex, reversement_final.toFixed(2));
    }
  } catch(e) {
    console.error('Sheets confirm error:', e.message);
  }

  // 5. Notification admin via Make.com Scénario D
  var webhookD = process.env.MAKE_WEBHOOK_SCENARIO_D;
  if (webhookD) {
    try {
      await fetch(webhookD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id:                courseId,
          payment_intent_id:        pi_id,
          montant_final:            montant_reel,
          commission_smd:           commission_finale,
          reversement_transporteur: reversement_final,
          capture_date:             capture_date,
          statut:                   'payee'
        })
      });
    } catch(e) { console.error('Webhook D error:', e.message); }
  }

  return utils.ok({
    courseId:                 courseId,
    payment_intent_id:        pi_id,
    statut:                   'payee',
    montant_final:            montant_reel,
    commission_smd:           commission_finale,
    reversement_transporteur: reversement_final,
    mode:                     sk.includes('live') ? 'LIVE' : 'TEST'
  });
};
