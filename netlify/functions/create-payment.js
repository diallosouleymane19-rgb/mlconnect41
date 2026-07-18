'use strict';
// create-payment.js — Crée un Payment Intent Stripe (compte plateforme SMD uniquement)
// Modèle B : pas de Stripe Connect — reversement transporteur par virement bancaire
// MobiLoireConnect41 v45 — VERSION CORRIGÉE (audit 2026-07-18)
// FIX-A : contrôle propriété + statut de la course (le PI ne peut être créé que par le
//         transporteur assigné, course en statut en_cours)
// FIX-B : plausibilité du montant vs estimation (col T) : max(estim×2, estim+30 €), min 0,50 €
// FIX-C : type_transporteur pris depuis la SESSION serveur (plus depuis le client)
// FIX-D : réutilisation PI corrigée (parenthèses + refus si PI d'un autre transporteur)
//         et statut_pi renvoyé au client (permet de sauter confirmCardPayment si requires_capture)
// FIX-E : Idempotency-Key Stripe sur la création du PaymentIntent

var utils = require('./utils');

async function stripeRequest(method, path, data, sk, idemKey) {
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

  var headers = {
    'Authorization': 'Basic ' + Buffer.from(sk + ':').toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  if (idemKey) headers['Idempotency-Key'] = idemKey; // FIX-E
  var res = await fetch('https://api.stripe.com/v1' + path, {
    method: method,
    headers: headers,
    body: method !== 'GET' ? flatPairs.join('&') : undefined
  });
  return res.json();
}

// FIX-C : normalise le type transporteur (T1 col C) vers taxi | vtc | medical
function mapType(t) {
  t = (t || '').toLowerCase().trim();
  if (t.indexOf('ambu') !== -1 || t.indexOf('vsl') !== -1 || t.indexOf('medic') !== -1) return 'medical';
  if (t.indexOf('vtc') !== -1) return 'vtc';
  return 'taxi';
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
  // FIX-C : le type vient de la session serveur (feuille T1), pas du client
  var type_transporteur = mapType(session.type || body.type_transporteur || 'taxi');

  if (!courseId)                              return utils.err(400, 'courseId requis');
  if (!montant_estime || montant_estime <= 0) return utils.err(400, 'montant_estime requis et > 0');

  var sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return utils.err(500, 'STRIPE_SECRET_KEY non configuré');

  var COMMISSIONS = {
    taxi:    parseFloat(process.env.COMMISSION_TAXI    || '0.10'),
    vtc:     parseFloat(process.env.COMMISSION_VTC     || '0.12'),
    medical: parseFloat(process.env.COMMISSION_MEDICAL || '0.08')
  };

  // v51 sécurité : plafond serveur anti-fraude sur le montant fourni par le client
  var MONTANT_MAX = parseFloat(process.env.MONTANT_MAX_EUR || '1500');
  if (montant_estime > MONTANT_MAX) return utils.err(400, 'Montant hors bornes (max ' + MONTANT_MAX + ' €)');

  var taux             = COMMISSIONS[type_transporteur];
  var montant_cents    = Math.round(montant_estime * 100);
  var commission_cents = Math.round(montant_cents * taux);

  // FIX-A/B/D : lecture de la course — contrôle propriété, statut, plausibilité montant, PI existant
  var courseRow = null, courseRowIndex = -1;
  try {
    var pRows = await utils.sheetsGet('T3-Courses!A:T');
    for (var pk = 1; pk < (pRows || []).length; pk++) {
      if ((pRows[pk][0] || '') === courseId) { courseRow = pRows[pk]; courseRowIndex = pk + 1; break; }
    }
  } catch(e) {
    return utils.err(500, 'Lecture course impossible : ' + e.message);
  }
  if (!courseRow) return utils.err(404, 'Course introuvable : ' + courseId);

  // FIX-A : la course doit appartenir au transporteur connecté (col I) et être en_cours (col H)
  var courseTrans  = (courseRow[8] || '').trim().toUpperCase();
  var courseStatut = (courseRow[7] || '').trim().toLowerCase();
  if (courseTrans !== (session.id || '').toUpperCase()) {
    return utils.err(403, 'Cette course ne vous est pas assignée');
  }
  if (courseStatut !== 'en_cours') {
    return utils.err(400, 'Course non encaissable — statut : ' + (courseStatut || 'inconnu'));
  }

  // FIX-B : plausibilité vs estimation (col T, si renseignée) — évite un débit très supérieur à l'estimé
  var estime = parseFloat(courseRow[19] || '') || 0;
  if (montant_estime < 0.5) return utils.err(400, 'Montant minimum 0,50 €');
  if (estime > 0) {
    var plafondCourse = Math.max(estime * 2, estime + 30);
    if (montant_estime > plafondCourse) {
      return utils.err(400, 'Montant incohérent avec l\'estimation (' + estime.toFixed(2) +
        ' €) — maximum autorisé : ' + plafondCourse.toFixed(2) + ' €');
    }
  }

  // FIX-D : idempotence — réutiliser un PaymentIntent encore utilisable pour cette course
  try {
    var existingPi = (courseRow[15] || '').trim(); // col P
    if (existingPi) {
      var chk = await stripeRequest('GET', '/payment_intents/' + existingPi, null, sk);
      var reusable = chk && chk.id && !chk.error &&
        ['requires_payment_method', 'requires_confirmation', 'requires_capture'].indexOf(chk.status) !== -1 &&
        ((chk.metadata && chk.metadata.transporteur_id) || '') === (session.id || '');
      if (reusable) {
        return utils.ok({
          payment_intent_id: chk.id, client_secret: chk.client_secret,
          montant_estime: montant_estime, commission_smd: commission_cents/100,
          reversement_transporteur: (montant_cents-commission_cents)/100,
          stripe_connect: false, statut: 'reutilise',
          statut_pi: chk.status, // FIX-D : le client saute confirmCardPayment si requires_capture
          montant_autorise: chk.amount / 100,
          mode: sk.startsWith('sk_live') ? 'LIVE' : 'TEST'
        });
      }
    }
  } catch(e) { console.warn('[create-payment] idempotence check:', e.message); }

  // Payment Intent simple — compte plateforme SMD (sans transfer_data ni application_fee)
  var pi;
  var idemKey = 'mlc41-' + courseId + '-' + montant_cents; // FIX-E : même course + même montant = même PI
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
    }, sk, idemKey);
  } catch(e) {
    return utils.err(500, 'Erreur Stripe : ' + e.message);
  }
  if (pi.error) return utils.err(400, 'Stripe : ' + pi.error.message);

  // Mise à jour Sheets T3-Courses — col P (pi_id) + col Q (statut) + col T (montant_estime)
  try {
    if (courseRowIndex > 0) {
      await utils.sheetsUpdateCell('T3-Courses!P' + courseRowIndex, pi.id);
      await utils.sheetsUpdateCell('T3-Courses!Q' + courseRowIndex, 'en_attente');
      // Note : on ne réécrit plus la col T (estimation d'origine conservée pour audit)
    }
  } catch(e) {
    console.error('Sheets update (create-payment):', e.message);
  }

  return utils.ok({
    payment_intent_id:        pi.id,
    client_secret:            pi.client_secret,
    statut_pi:                pi.status, // FIX-D
    montant_estime:           montant_estime,
    commission_smd:           commission_cents / 100,
    reversement_transporteur: (montant_cents - commission_cents) / 100,
    stripe_connect:           false,
    statut:                   'en_attente',
    mode:                     sk.startsWith('sk_live') ? 'LIVE' : 'TEST'
  });
};
