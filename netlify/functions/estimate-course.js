'use strict';
// estimate-course.js — Calcul du montant estimé d'une course
// SMD GLOBAL CONSULTING LLC — MobiLoireConnect41
// Tarifs homologués Taxis Loir-et-Cher (41) — Arrêté préfectoral 2024-2025
// VTC : tarif libre marché | Médical : convention CPAM Loir-et-Cher

var utils = require('./utils');

// ─── BARÈMES OFFICIELS ────────────────────────────────────────────────────────
// Source : Arrêté préfectoral Loir-et-Cher (41) + convention CPAM Centre-Val-de-Loire
var TARIFS = {
  taxi: {
    prise_en_charge : 2.60,   // € fixe au départ (toujours)
    tarif_A         : 1.10,   // €/km — jour (6h-20h), semaine, agglomération
    tarif_B         : 1.65,   // €/km — nuit (20h-6h) OU dimanche/fériés OU hors agglomération
    tarif_C         : 1.10,   // €/km — retour à vide (même tarif que A)
    attente_heure   : 28.00,  // €/h d'attente
    supplement_bagage: 0.50,  // € par bagage volumineux
    supplement_animal: 0.70,  // € par animal
    majoration_nuit  : 0.00   // inclus dans tarif_B
  },
  vtc: {
    prise_en_charge : 5.00,   // € fixe — tarif libre marché
    tarif_km        : 1.80,   // €/km — tarif libre marché Loir-et-Cher
    minimum         : 15.00,  // € minimum garanti par course
    majoration_nuit : 0.20    // €/km supplémentaire nuit/WE
  },
  medical: {
    // Taxis conventionnés CPAM Centre-Val-de-Loire (Transport Sanitaire Agréé)
    prise_en_charge : 2.60,   // € fixe (identique taxi)
    tarif_km        : 0.62,   // €/km — tarif conventionné CPAM 2024
    minimum         : 10.00,  // € minimum par course
    forfait_urgence : 0.00    // à configurer si besoin
  }
};

// Taux de commission plateforme MobiLoireConnect41
var COMMISSIONS = {
  taxi   : parseFloat(process.env.COMMISSION_TAXI    || '0.10'),  // 10%
  vtc    : parseFloat(process.env.COMMISSION_VTC     || '0.12'),  // 12%
  medical: parseFloat(process.env.COMMISSION_MEDICAL || '0.08')   // 8%
};

// ─── FONCTIONS DE CALCUL ──────────────────────────────────────────────────────

function estimerTaxi(km, opts) {
  var t = TARIFS.taxi;
  // Détermine le tarif kilométrique applicable
  var tarifKm;
  if (opts.retour_vide) {
    tarifKm = t.tarif_C;
  } else if (opts.nuit || opts.hors_agglo || opts.dimanche || opts.ferie) {
    tarifKm = t.tarif_B;
  } else {
    tarifKm = t.tarif_A;
  }
  var montant = t.prise_en_charge + km * tarifKm;
  if (opts.bagage) montant += t.supplement_bagage;
  if (opts.animal) montant += t.supplement_animal;
  if (opts.attente_min && opts.attente_min > 0) {
    montant += (opts.attente_min / 60) * t.attente_heure;
  }
  return Math.round(montant * 100) / 100;
}

function estimerVTC(km, opts) {
  var t = TARIFS.vtc;
  var tarifKm = t.tarif_km;
  if (opts.nuit || opts.dimanche || opts.ferie) tarifKm += t.majoration_nuit;
  var montant = t.prise_en_charge + km * tarifKm;
  return Math.max(Math.round(montant * 100) / 100, t.minimum);
}

function estimerMedical(km) {
  var t = TARIFS.medical;
  var montant = t.prise_en_charge + km * t.tarif_km;
  return Math.max(Math.round(montant * 100) / 100, t.minimum);
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  if (event.httpMethod !== 'POST') return utils.err(405, 'Méthode non autorisée');

  var body;
  try { body = JSON.parse(event.body || '{}'); }
  catch(e) { return utils.err(400, 'JSON invalide'); }

  var type = (body.type_transporteur || 'taxi').toLowerCase().trim();
  var km   = parseFloat(body.km || 0);
  var opts = body.options || {};

  if (!km || km <= 0) return utils.err(400, 'Distance km requise et > 0');
  if (!['taxi','vtc','medical'].includes(type)) {
    return utils.err(400, 'type_transporteur invalide : taxi | vtc | medical');
  }

  var montant_brut, detail, tarif_info;

  if (type === 'taxi') {
    montant_brut = estimerTaxi(km, opts);
    var tarifApplique = (opts.nuit || opts.hors_agglo || opts.dimanche || opts.ferie)
      ? 'Tarif B (nuit/WE/hors agglo) — ' + TARIFS.taxi.tarif_B + '€/km'
      : 'Tarif A (jour/semaine) — ' + TARIFS.taxi.tarif_A + '€/km';
    detail = {
      prise_en_charge     : TARIFS.taxi.prise_en_charge,
      tarif_applique      : tarifApplique,
      km                  : km,
      supplements         : {
        bagage  : opts.bagage   ? TARIFS.taxi.supplement_bagage : 0,
        animal  : opts.animal   ? TARIFS.taxi.supplement_animal : 0,
        attente : opts.attente_min ? Math.round((opts.attente_min/60)*TARIFS.taxi.attente_heure*100)/100 : 0
      },
      base_legale: 'Arrêté préfectoral Loir-et-Cher (41) — 2024-2025'
    };
  } else if (type === 'vtc') {
    montant_brut = estimerVTC(km, opts);
    detail = {
      prise_en_charge: TARIFS.vtc.prise_en_charge,
      tarif_km       : (opts.nuit||opts.dimanche||opts.ferie) ? TARIFS.vtc.tarif_km+TARIFS.vtc.majoration_nuit : TARIFS.vtc.tarif_km,
      km             : km,
      minimum_garanti: TARIFS.vtc.minimum,
      base_legale    : 'Tarif libre marché VTC — Loir-et-Cher'
    };
  } else {
    montant_brut = estimerMedical(km);
    detail = {
      prise_en_charge : TARIFS.medical.prise_en_charge,
      tarif_km_cpam   : TARIFS.medical.tarif_km,
      km              : km,
      minimum         : TARIFS.medical.minimum,
      base_legale     : 'Convention CPAM Centre-Val-de-Loire — Taxis conventionnés 2024'
    };
  }

  var taux       = COMMISSIONS[type];
  var commission = Math.round(montant_brut * taux * 100) / 100;
  var reversement= Math.round((montant_brut - commission) * 100) / 100;
  var sk   = process.env.STRIPE_SECRET_KEY || '';
  var mode = sk.startsWith('sk_live') ? 'LIVE' : 'TEST';

  return utils.ok({
    type_transporteur       : type,
    km                      : km,
    montant_estime          : montant_brut,         // en EUROS (ex: 35.60)
    montant_estime_centimes : Math.round(montant_brut * 100), // en centimes pour Stripe
    taux_commission         : taux,
    commission_smd          : commission,
    reversement_transporteur: reversement,
    detail                  : detail,
    devise                  : 'EUR',
    mode                    : mode
  });
};
