'use strict';
// stripe-webhook.js — Webhooks Stripe idempotents
// SMD GLOBAL CONSULTING LLC — MobiLoireConnect41 v42 — VERSION CORRIGÉE (audit 2026-07-18)
// FIX-J : une erreur dans un handler (ex : Google Sheets indisponible) renvoie désormais 500
//         → Stripe réessaie l'événement (avant : 200 → événement perdu définitivement)
// Destination 1 (Votre compte)     : payment_intent.succeeded, transfer.created, account.updated
// Destination 2 (Comptes connectés): payout.paid
// Chaque destination a sa propre clé : STRIPE_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET_CONNECT

var utils = require('./utils');
var crypto = require('crypto');

// ── Vérification signature Stripe ──────────────────────────────────────────
function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  try {
    var parts = sigHeader.split(',').reduce(function(acc, part) {
      var kv = part.split('=');
      acc[kv[0]] = kv[1];
      return acc;
    }, {});
    var timestamp = parts['t'];
    var sig       = parts['v1'];
    if (!timestamp || !sig) return false;
    var age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (age > 300) return false;
    var payload  = timestamp + '.' + rawBody;
    var expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch(e) { return false; }
}

// ── Lookup ligne dans Sheets par valeur d'une colonne ──────────────────────
async function findRowByColumn(range, colIndex, value) {
  var rows = await utils.sheetsGet(range);
  var values = rows || [];
  for (var i = 1; i < values.length; i++) {
    if ((values[i][colIndex] || '').trim() === value) {
      return { rowIndex: i + 1, row: values[i] };
    }
  }
  return null;
}

// ── Handlers ───────────────────────────────────────────────────────────────
async function onPaymentIntentSucceeded(pi) {
  var courseId = (pi.metadata && pi.metadata.course_id) || '';
  if (!courseId) return { handled: false, reason: 'pas de course_id dans metadata' };
  var found = await findRowByColumn('T3-Courses!A:V', 0, courseId);
  if (!found) return { handled: false, reason: 'course introuvable : ' + courseId };
  var current_status = found.row[16] || '';
  if (current_status !== 'captured') {
    await utils.sheetsUpdateCell('T3-Courses!Q' + found.rowIndex, 'captured');
    await utils.sheetsUpdateCell('T3-Courses!H' + found.rowIndex, 'terminee');
    return { handled: true, action: 'fallback_sheets_update', courseId: courseId };
  }
  return { handled: true, action: 'already_captured', courseId: courseId };
}

async function onTransferCreated(transfer) {
  var courseId = (transfer.metadata && transfer.metadata.course_id) || '';
  var amount   = transfer.amount / 100;
  var dest     = transfer.destination || '';
  if (courseId) {
    var found = await findRowByColumn('T3-Courses!A:V', 0, courseId);
    if (found) {
      await utils.sheetsUpdateCell('T3-Courses!V' + found.rowIndex, amount.toFixed(2));
    }
  }
  return { handled: true, action: 'transfer_logged', amount: amount, destination: dest };
}

async function onAccountUpdated(account) {
  var accountId        = account.id;
  var charges_enabled  = account.charges_enabled  || false;
  var payouts_enabled  = account.payouts_enabled  || false;
  var details_submitted = account.details_submitted || false;
  var tRows = await utils.sheetsGet('T1-Transporteurs!A:M');
  var tValues = tRows || [];
  var rowIndex = -1;
  for (var i = 1; i < tValues.length; i++) {
    if ((tValues[i][12] || '').trim() === accountId) { rowIndex = i + 1; break; }
  }
  if (rowIndex < 0) return { handled: false, reason: 'transporteur non trouvé pour ' + accountId };
  if (charges_enabled && payouts_enabled && details_submitted) {
    await utils.sheetsUpdateCell('T1-Transporteurs!G' + rowIndex, 'OUI');
    return { handled: true, action: 'transporteur_actif', accountId: accountId };
  }
  return { handled: true, action: 'account_updated_partiel', charges_enabled: charges_enabled };
}

async function onPayoutPaid(payout) {
  var amount  = payout.amount / 100;
  var arrival = new Date(payout.arrival_date * 1000).toISOString().split('T')[0];
  console.log('[webhook] payout.paid', { amount: amount, arrival: arrival });
  return { handled: true, action: 'payout_logged', amount: amount, arrival_date: arrival };
}

// ── Handler principal ───────────────────────────────────────────────────────
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  if (event.httpMethod !== 'POST') return utils.err(405, 'Méthode non autorisée');

  var rawBody   = event.body || '';
  var sigHeader = event.headers['stripe-signature'] || '';

  var secret        = process.env.STRIPE_WEBHOOK_SECRET;
  var secretConnect = process.env.STRIPE_WEBHOOK_SECRET_CONNECT;

  // Essayer les deux clés — la bonne dépend de quelle destination a envoyé l'événement
  var valid = false;
  if (secret        && verifyStripeSignature(rawBody, sigHeader, secret))        valid = true;
  if (!valid && secretConnect && verifyStripeSignature(rawBody, sigHeader, secretConnect)) valid = true;

  if (!valid && (secret || secretConnect)) {
    console.error('[webhook] Signature invalide');
    return { statusCode: 400, body: 'Signature invalide' };
  }
  // v51 sécurité : refuser tout si aucun secret configuré (fail-closed)
  if (!secret && !secretConnect) {
    console.error('[webhook] Aucun STRIPE_WEBHOOK_SECRET configuré — rejet');
    return { statusCode: 500, body: 'Webhook non configuré' };
  }

  var stripeEvent;
  try { stripeEvent = JSON.parse(rawBody); }
  catch(e) { return utils.err(400, 'JSON invalide'); }

  var eventType = stripeEvent.type || '';
  var obj       = stripeEvent.data && stripeEvent.data.object;
  console.log('[webhook] Reçu :', eventType, stripeEvent.id);

  var result;
  try {
    switch(eventType) {
      case 'payment_intent.succeeded': result = await onPaymentIntentSucceeded(obj); break;
      case 'transfer.created':         result = await onTransferCreated(obj);        break;
      case 'account.updated':          result = await onAccountUpdated(obj);         break;
      case 'payout.paid':              result = await onPayoutPaid(obj);             break;
      default: result = { handled: false, reason: 'événement non géré : ' + eventType };
    }
  } catch(e) {
    // FIX-J : 500 → Stripe réessaiera (les handlers sont idempotents, pas de double effet)
    console.error('[webhook] Erreur handler :', e.message);
    return { statusCode: 500, body: JSON.stringify({ received: false, error: e.message }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ received: true, event: eventType, result: result })
  };
};
