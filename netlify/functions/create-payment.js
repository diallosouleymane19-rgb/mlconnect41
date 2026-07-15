'use strict';
// create-payment.js — Crée un Payment Intent Stripe (compte plateforme SMD uniquement)
// Modèle B : pas de Stripe Connect — reversement transporteur par virement bancaire
// MobiLoireConnect41 v45

var utils = require('./utils');

async function stripeRequest(method, path, data, sk) {
  var flatPairs = [];
  function flattenObj(obj, prefix) {
    Object.keys(obj).forEach(function(k) {
      var key = prefix ? prefix + '[' + k + ']' : k;
      var v = obj[k];
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        flattenObj(v, key);
      } else {
        flatPairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
      }
    });
  }
  flattenObj(data, '');

  var res = await fetch('https://api.stripe.com/v1' + path, {
    method: method,
    headers: {
      'Authorization': 'Basic ' + Buffer.from(sk + ':').toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: method !== 'GET' ? flatPairs.join('&') : undefined
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

  var courseId          = (body.courseId || '').trim();
  var montant_estime    = parseFloat(body.montant_estime || 0);
  var type_transporteur = (body.type_transporteur || 'taxi').toLowerCase().trim();

  if (!courseId)                              return utils.err(400, 'courseId requis');
  if (!montant_estime || montant_estime <= 0) return utils.err(400, 'montant_estime requis et > 0');
  if (!['taxi','vtc','medical'].includes(type_transporteur)) return utils.err(400, 'type_transporteur invalide');

  var sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return utils.err(500, 'STRIPE_SECRET_KEY non configuré');

  var COMMISSIONS = {
    taxi:    parseFloat(process.env.COMMISSION_TAXI    || '0.10'),
    vtc:     parseFloat(process.env.COMMISSION_VTC     || '0.12'),
    medical: parseFloat(process.env.COMMISSION_MEDICAL || '0.08')
  };

  var taux             = COMMISSIONS[type_transporteur];
  var montant_cents    = Math.round(montant_estime * 100);
  var commission_cents = Math.round(montant_cents * taux);

  // Payment Intent simple — compte plateforme SMD (sans transfer_data ni application_fee)
  var pi;
  try {
    pi = await stripeRequest('POST', '/payment_intents', {
      amount:                  montant_cents,
      currency:                'eur',
      capture_method:          'manual',
      'payment_method_types[]': 'card',
      description:             'Course MobiLoireConnect41 — ' + courseId,
      'metadata[course_id]':                    courseId,
      'metadata[transporteur_id]':              session.id || '',
      'metadata[type_transporteur]':            type_transporteur,
      'metadata[commission_smd_eur]':           (commission_cents / 100).toFixed(2),
      'metadata[reversement_transporteur_eur]': ((montant_cents - commission_cents) / 100).toFixed(2)
    }, sk);
  } catch(e) {
    return utils.err(500, 'Erreur Stripe : ' + e.message);
  }
  if (pi.error) return utils.err(400, 'Stripe : ' + pi.error.message);

  // Mise à jour Sheets T3-Courses — col P (pi_id) + col Q (statut) + col T (montant_estime)
  try {
    var cRows = await utils.sheetsGet('T3-Courses!A:A');
    var rowIndex = -1;
    for (var j = 1; j < (cRows || []).length; j++) {
      if ((cRows[j][0] || '') === courseId) { rowIndex = j + 1; break; }
    }
    if (rowIndex > 0) {
      await utils.sheetsUpdateCell('T3-Courses!P' + rowIndex, pi.id);
      await utils.sheetsUpdateCell('T3-Courses!Q' + rowIndex, 'en_attente');
      await utils.sheetsUpdateCell('T3-Courses!T' + rowIndex, montant_estime.toFixed(2));
    }
  } catch(e) {
    console.error('Sheets update (create-payment):', e.message);
  }

  return utils.ok({
    payment_intent_id:        pi.id,
    client_secret:            pi.client_secret,
    montant_estime:           montant_estime,
    commission_smd:           commission_cents / 100,
    reversement_transporteur: (montant_cents - commission_cents) / 100,
    stripe_connect:           false,
    statut:                   'en_attente',
    mode:                     sk.startsWith('sk_live') ? 'LIVE' : 'TEST'
  });
};
