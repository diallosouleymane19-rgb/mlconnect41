// MobiLoireConnect41 — netlify/functions/request-course.js  v33
'use strict';
var utils  = require('./utils');
var crypto = require('crypto');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  if (event.httpMethod !== 'POST') return utils.err(405, 'Methode non autorisee');

  var body;
  try { body = JSON.parse(event.body || '{}'); }
  catch(e) { return utils.err(400, 'JSON invalide'); }

  var nom          = (body.nom          || '').trim();
  var prenom       = (body.prenom       || '').trim();
  var tel          = (body.tel          || '').trim();
  var depart       = (body.depart       || '').trim();
  var arrivee      = (body.arrivee      || '').trim();
  var date         = (body.date         || '').trim();
  var heure        = (body.heure        || '').trim();
  var motif        = (body.motif        || '').trim();
  var type_service = (body.type_service || 'taxi_immediat').trim();
  var prescription = (body.prescription || '').trim();
  var montant_estime = parseFloat(body.montant_estime || 0) || 0;

  if (!nom || !tel || !depart || !arrivee || !date || !heure || !type_service)
    return utils.err(400, 'Champs obligatoires manquants');

  try {
    var ref      = 'REF-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    var courseId = 'C' + Date.now();
    var passager = prenom ? nom + ' ' + prenom : nom;
    var now      = new Date().toISOString();

    // T3-Courses colonnes A→O (15 champs)
    // A:id  B:date  C:heure  D:passager  E:tel  F:depart  G:arrivee
    // H:statut  I:transporteur_id  J:transporteur_nom  K:notes
    // L:ref  M:motif  N:type_service  O:prescription
    await utils.sheetsAppend('T3-Courses!A1', [[
      courseId, date, heure, passager, tel, depart, arrivee,
      'en_attente', '', '', '',
      ref, motif, type_service, prescription,
      '', '', '', '', montant_estime
    ]]);

    // Broadcast OneSignal a tous les transporteurs abonnes
    var osKey = process.env.ONESIGNAL_API_KEY;
    var osApp = process.env.ONESIGNAL_APP_ID;
    if (osKey && osApp) {
      try {
        await fetch('https://onesignal.com/api/v1/notifications', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Basic ' + osKey
          },
          body: JSON.stringify({
            app_id:             osApp,
            included_segments:  ['All'],
            headings:   { fr: 'Nouvelle course disponible' },
            contents:   { fr: depart + ' → ' + arrivee + ' (' + date + ' ' + heure + ')' },
            data:       { course_id: courseId, action: 'new_course' }
          })
        });
      } catch(osErr) {
        console.warn('[request-course] OneSignal erreur:', osErr.message);
      }
    } else {
      console.warn('[request-course] OneSignal non configure (ONESIGNAL_API_KEY ou ONESIGNAL_APP_ID manquant)');
    }

    return utils.ok({ ref: ref, id: courseId, statut: 'en_attente' });

  } catch(e) {
    console.error('[request-course]', e.message);
    return utils.err(500, 'Erreur serveur: ' + e.message);
  }
};
