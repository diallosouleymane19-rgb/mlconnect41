'use strict';
// transporter-onboarding.js — Stripe Connect Express KYC onboarding
// SMD GLOBAL CONSULTING LLC — MobiLoireConnect41 v41
// Crée un compte Stripe Express pour le transporteur et génère le lien KYC

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
  if (data) flattenObj(data, '');
  var body = flatPairs.join('&');

  var res = await fetch('https://api.stripe.com/v1' + path, {
    method: method,
    headers: {
      'Authorization': 'Basic ' + Buffer.from(sk + ':').toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: method !== 'GET' ? (body || ' ') : undefined
  });
  return res.json();
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  if (event.httpMethod !== 'POST') return utils.err(405, 'Méthode non autorisée');

  // Vérification session transporteur
  var session;
  try { session = utils.verifySession((event.headers['authorization'] || '').replace(/^Bearer /i, '')); }
  catch(e) { return utils.err(401, 'Session invalide'); }

  var transporteur_id = session.id;
  if (!transporteur_id) return utils.err(400, 'transporteur_id introuvable dans la session');

  var sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return utils.err(500, 'STRIPE_SECRET_KEY non configuré');

  var APP_URL = process.env.APP_URL || 'https://mlconnect41.netlify.app';

  try {
    // 1. Récupérer le transporteur depuis T1-Transporteurs
    var rows = await utils.sheetsGet('T1-Transporteurs!A:M');
    var values = rows || [];

    var rowIndex = -1;
    var transporteur = null;
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === transporteur_id) {
        rowIndex = i + 1; // Numéro de ligne Sheets (1-indexed, +1 pour header)
        transporteur = {
          id:               values[i][0] || '',
          nom:              values[i][1] || '',
          type:             values[i][2] || 'taxi',
          email:            values[i][5] || '',
          stripe_account_id: values[i][12] || '' // Colonne M (index 12)
        };
        break;
      }
    }

    if (!transporteur) return utils.err(404, 'Transporteur introuvable : ' + transporteur_id);

    var stripe_account_id = transporteur.stripe_account_id;

    // 2. Créer le compte Stripe Express si absent
    if (!stripe_account_id) {
      var accountData = {
        type: 'express',
        country: 'FR',
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
        'business_type': 'individual',
        'business_profile[mcc]': '4121',         // Taxi & limousines
        'business_profile[product_description]': 'Transport médical et taxi — Loir-et-Cher (41)',
        'settings[payouts][schedule][interval]': 'daily'
      };

      // Pré-remplir email si disponible
      if (transporteur.email) accountData.email = transporteur.email;

      var account = await stripeRequest('POST', '/accounts', accountData, sk);
      if (account.error) return utils.err(400, 'Stripe compte : ' + account.error.message);

      stripe_account_id = account.id;

      // 3. Stocker stripe_account_id dans T1-Transporteurs colonne M
      if (rowIndex > 0) {
        await utils.sheetsUpdateCell('T1-Transporteurs!M' + rowIndex, stripe_account_id);
      }
    }

    // 4. Générer le lien onboarding (Account Link)
    var linkData = {
      account: stripe_account_id,
      'refresh_url': APP_URL + '?stripe=refresh&id=' + transporteur_id,
      'return_url':  APP_URL + '?stripe=success&id=' + transporteur_id,
      type: 'account_onboarding'
    };

    var accountLink = await stripeRequest('POST', '/account_links', linkData, sk);
    if (accountLink.error) return utils.err(400, 'Stripe lien : ' + accountLink.error.message);

    // 5. Vérifier statut KYC du compte
    var accountInfo = await stripeRequest('GET', '/accounts/' + stripe_account_id, null, sk);
    var kyc_complet = accountInfo.details_submitted && !accountInfo.requirements.currently_due.length;

    return utils.ok({
      stripe_account_id: stripe_account_id,
      onboarding_url: accountLink.url,
      kyc_complet: kyc_complet,
      charges_enabled: accountInfo.charges_enabled || false,
      payouts_enabled: accountInfo.payouts_enabled || false,
      message: kyc_complet ? 'KYC validé — vous pouvez recevoir des paiements' : 'Complétez votre inscription Stripe'
    });

  } catch(e) {
    return utils.err(500, 'Erreur onboarding : ' + e.message);
  }
};
