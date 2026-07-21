// MobiLoireConnect41 — app.js v9
// Architecture : OneSignal v16 push + Netlify Functions + Google Sheets + Stripe
// Flux : Login PIN → token HMAC → courses → accepter/refuser → paiement Stripe → Scénario D Make.com

'use strict';

const APP_VERSION = 'v10';
const API         = '/.netlify/functions';
const OS_APP_ID   = '58ea61f3-139f-4f2a-9083-402d7c8b34cc';
// FIX-1 : clé publique surchargeable (window.MLC41_STRIPE_PK dans index.html) pour basculer
// en mode TEST sans toucher au code. Par défaut : clé LIVE de production.
const STRIPE_PK   = (typeof window !== 'undefined' && window.MLC41_STRIPE_PK) ||
  'pk_test_51TdciAEN9yUrhHVflSkmN14ZqQOo1PBULaoKhuNmC3mNjBheiTKn1gDI0NBiuXVZDqn68AjyLX2UC1MjHQJcuuqj00grO328gt';

// Session en mémoire (sessionStorage pour persistance onglet)
let SESSION = null;

// v51 sécurité : échappement HTML anti-XSS stocké (données usager non fiables)
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}

// ════════════════════════════════════════════════════════════
// INITIALISATION
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  setLoading(false);
  loadSession();
  registerSW();

  // Bind events
  document.getElementById('loginForm')?.addEventListener('submit', onLoginSubmit);
  document.getElementById('uTypeService')?.addEventListener('change', estimateOnChange);
  document.getElementById('btnRefresh')?.addEventListener('click', loadCourses);
  document.getElementById('btnLogout')?.addEventListener('click', doLogout);
  document.getElementById('btnNotif')?.addEventListener('click', toggleNotifications);

  handleStripeReturn(); // Gérer retour depuis Stripe KYC

  if (SESSION) {
    showPanel('main');
    updateHeader();
    renderStripeBanner();
    loadCourses();
    initOneSignal();
  } else {
    showPanel('home');
  }
});

// ════════════════════════════════════════════════════════════
// SERVICE WORKER
// ════════════════════════════════════════════════════════════

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then(reg => console.log('[SW] Actif :', reg.scope))
    .catch(e  => console.warn('[SW] Échec :', e.message));
}

// ════════════════════════════════════════════════════════════
// SESSION
// ════════════════════════════════════════════════════════════

function loadSession() {
  try {
    const raw = sessionStorage.getItem('mlc41_session');
    if (raw) SESSION = JSON.parse(raw);
  } catch { SESSION = null; }
}

function saveSession(data) {
  SESSION = data;
  try { sessionStorage.setItem('mlc41_session', JSON.stringify(data)); } catch {}
  renderStripeBanner();
}

function clearSession() {
  SESSION = null;
  try { sessionStorage.removeItem('mlc41_session'); } catch {}
}

// ════════════════════════════════════════════════════════════
// LOGIN / LOGOUT
// ════════════════════════════════════════════════════════════

async function onLoginSubmit(e) {
  e.preventDefault();
  const id  = document.getElementById('inputId')?.value.trim() || '';
  const pin = document.getElementById('inputPin')?.value.trim() || '';
  if (!id || !pin) return showToast('Renseignez votre identifiant et PIN', 'warning');
  await doLogin(id, pin);
}

async function doLogin(id, pin) {
  setLoading(true, 'Connexion en cours…');
  try {
    const res  = await fetch(`${API}/auth`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, pin })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Échec de connexion');

    saveSession(data);
    showPanel('main');
    updateHeader();
    loadCourses();
    initOneSignal();
    showToast(`Bonjour ${data.nom} 👋`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

function doLogout() {
  clearSession();
  showPanel('home');
  const fId  = document.getElementById('inputId');
  const fPin = document.getElementById('inputPin');
  if (fId)  fId.value  = '';
  if (fPin) fPin.value = '';
  showToast('Déconnecté', 'info');
}

// ════════════════════════════════════════════════════════════
// ONESIGNAL v16
// ════════════════════════════════════════════════════════════

function initOneSignal() {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      await OneSignal.init({
        appId: OS_APP_ID,
        serviceWorkerParam: { scope: '/' },
        allowLocalhostAsSecureOrigin: true
      });

      // État initial
      const sub = OneSignal.User.PushSubscription;
      updateNotifUI(!!sub.optedIn);
      if (sub.optedIn && sub.id) savePlayerId(sub.id);

      // Écouter les changements
      sub.addEventListener('change', (evt) => {
        const current = evt.current;
        updateNotifUI(!!current.optedIn);
        if (current.optedIn && current.id) savePlayerId(current.id);
      });

    } catch (e) {
      console.warn('[OneSignal] Init erreur :', e.message);
    }
  });
}

async function toggleNotifications() {
  const OS = window.OneSignal;
  if (!OS) return showToast('OneSignal non chargé', 'error');
  try {
    const sub = OS.User.PushSubscription;
    if (sub.optedIn) {
      await sub.optOut();
      updateNotifUI(false);
      showToast('Notifications désactivées', 'info');
    } else {
      await sub.optIn();
      // le listener 'change' prend le relais
    }
  } catch (e) {
    showToast('Erreur notifications : ' + e.message, 'error');
  }
}

function updateNotifUI(enabled) {
  const btn    = document.getElementById('btnNotif');
  const status = document.getElementById('notifStatus');
  if (btn)    btn.textContent = enabled ? '🔕 Désactiver' : '🔔 Activer';
  if (status) {
    status.textContent = enabled ? '✅ Actives' : '⚪ Désactivées';
    status.className   = 'notif-status ' + (enabled ? 'on' : 'off');
  }
}

async function savePlayerId(playerId) {
  if (!SESSION?.token) return;
  try {
    await fetch(`${API}/update-player`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: SESSION.token, player_id: playerId })
    });
    console.log('[OneSignal] Player ID enregistré :', playerId);
  } catch (e) {
    console.warn('[OneSignal] Sauvegarde player_id échouée :', e.message);
  }
}

// ════════════════════════════════════════════════════════════
// COURSES
// ════════════════════════════════════════════════════════════

// ─── Phase 2 : onglet actif (dispo / mes-courses) ─────────
var _activeTab = 'dispo';

async function loadCourses() {
  if (!SESSION?.token) return;
  if (_activeTab === 'dispo') {
    await loadAvailableCourses();
  } else {
    await loadMyCourses();
  }
}

function switchCoursesTab(tab) {
  _activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  var el = document.getElementById('tab-' + tab);
  if (el) el.classList.add('active');
  loadCourses();
}

// Courses disponibles (Phase 2 — premier a cliquer)
async function loadAvailableCourses() {
  const list = document.getElementById('coursesList');
  if (list) list.innerHTML = '<p class="msg-info">Chargement…</p>';
  try {
    const url  = `${API}/get-available-courses?token=${encodeURIComponent(SESSION.token)}&_=${Date.now()}`;
    const res  = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    console.log('[get-available-courses] reponse:', JSON.stringify(data));
    if (!res.ok) throw new Error(data.error || 'Erreur chargement');
    const courses = data.courses || [];
    if (!list) return;
    if (courses.length === 0) {
      var dbg = '';
      if (data.total_rows !== undefined) {
        dbg = '<small style="color:#aaa;display:block;margin-top:4px">' +
          'Feuille : ' + data.total_rows + ' ligne(s) | en_attente : ' + (data.en_attente || 0) +
          (data.debug ? ' | ' + data.debug : '') + '</small>';
      }
      list.innerHTML = '<p class="msg-empty">Aucune course disponible pour le moment.' + dbg + '</p>';
      return;
    }
    list.innerHTML = courses.map(c => buildAvailableCard(c)).join('');
  } catch (e) {
    if (list) list.innerHTML = `<p class="msg-error">Erreur : ${e.message}</p>`;
  }
}

// Mes courses (statut en cours / confirmees)
async function loadMyCourses() {
  const list = document.getElementById('coursesList');
  if (list) list.innerHTML = '<p class="msg-info">Chargement…</p>';
  try {
    const res  = await fetch(`${API}/get-courses?token=${encodeURIComponent(SESSION.token)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur chargement');
    const courses = data.courses || [];
    // Gains du jour
    renderGainsDuJour(courses);
    const actives = courses.filter(c => !['terminee', 'refusee', 'terminée', 'refusée'].includes(c.statut));
    if (!list) return;
    if (actives.length === 0) {
      list.innerHTML = '<p class="msg-empty">Aucune course en cours. ✅</p>';
      return;
    }
    list.innerHTML = actives.map(c => buildCourseCard(c)).join('');
  } catch (e) {
    if (list) list.innerHTML = `<p class="msg-error">Erreur : ${e.message}</p>`;
  }
}

function renderGainsDuJour(courses) {
  // Supprimer ancienne bannière
  var old = document.getElementById('gainsBanner');
  if (old) old.remove();
  // Date du jour YYYY-MM-DD
  var today = new Date();
  var yy = today.getFullYear();
  var mm = String(today.getMonth()+1).padStart(2,'0');
  var dd = String(today.getDate()).padStart(2,'0');
  var todayStr = yy+'-'+mm+'-'+dd;
  // Filtrer courses capturées aujourd'hui (col R = capture_date, col S = montant_final)
  var total = 0;
  courses.forEach(function(c) {
    if (c.statut === 'terminee' || c.statut === 'terminée') {
      var d = c.capture_date || '';
      if (d.startsWith(todayStr)) {
        var m = parseFloat(c.montant_final) || 0;
        total += m;
      }
    }
  });
  var banner = document.createElement('div');
  banner.id = 'gainsBanner';
  banner.className = 'gains-banner';
  banner.innerHTML = '<span>💰 Gains aujourd\'hui</span><span class="gains-amount">' + total.toFixed(2) + ' €</span>'; // FIX-6 : montant_final déjà en euros
  var section = document.querySelector('.courses-section');
  if (section) section.parentNode.insertBefore(banner, section);
}

function buildAvailableCard(c) {
  const typeLabel = { taxi_immediat: '🚕 Taxi immédiat', taxi_planifie: '📅 VSL planifié', ambulance: '🚑 Ambulance' };
  const type = typeLabel[c.type_service] || c.type_service || '';
  return `
<article class="card card-dispo" data-id="${c.id}">
  <div class="card-head">
    <span class="badge badge-dispo">🟢 Disponible</span>
    ${type ? `<span class="badge badge-type">${type}</span>` : ''}
  </div>
  <div class="card-body">
    <div class="row-info">📅 ${esc(c.date)} · ${esc(c.heure)}</div>
    <div class="row-trajet">
      <div class="trajet-from">🟢 ${esc(c.depart)}</div>
      <div class="trajet-to">🔴 ${esc(c.arrivee)}</div>
    </div>
    ${c.motif ? `<div class="row-info">📋 ${esc(c.motif)}</div>` : ''}
  </div>
  <div class="card-actions">
    <button class="btn btn-accept" onclick="acceptCourse('${c.id}')">✅ Accepter cette course</button>
  </div>
</article>`;
}

async function acceptCourse(courseId) {
  if (!SESSION?.token) return;
  const card = document.querySelector(`.card[data-id="${courseId}"]`);
  if (card) card.querySelectorAll('.btn').forEach(b => { b.disabled = true; b.textContent = 'En cours…'; });

  try {
    const res  = await fetch(`${API}/accept-course`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: SESSION.token, course_id: courseId })
    });
    const data = await res.json();
    if (res.status === 409) {
      showToast('Course déjà acceptée par un autre transporteur.', 'warning');
      setTimeout(() => loadAvailableCourses(), 600);
      return;
    }
    if (!res.ok) throw new Error(data.error || 'Erreur');
    showToast('Course acceptée ! Elle est dans "Mes courses".', 'success');
    _activeTab = 'mes-courses';
    var btnDispo = document.getElementById('tab-dispo');
    var btnMes   = document.getElementById('tab-mes-courses');
    if (btnDispo) btnDispo.classList.remove('active');
    if (btnMes)   btnMes.classList.add('active');
    setTimeout(() => loadMyCourses(), 500);
  } catch(e) {
    showToast(e.message, 'error');
    if (card) card.querySelectorAll('.btn').forEach(b => { b.disabled = false; b.textContent = '✅ Accepter cette course'; });
  }
}

function buildCourseCard(c) {
  const statutClass = (c.statut || '').replace(/_/g, '-').replace(/[éè]/g, 'e');
  const badgeLabel  = {
    en_attente: '⏳ En attente', confirmee: '✅ Confirmée', confirmée: '✅ Confirmée',
    en_cours: '🚗 En cours', terminee: '🏁 Terminée', terminée: '🏁 Terminée'
  }[c.statut] || c.statut;

  const actions = (function() {
    if (c.statut === 'confirmee' || c.statut === 'confirmée') {
      return `<button class="btn btn-go" onclick="respondCourse('${c.id}','en_cours')">🚗 Démarrer</button>`;
    }
    if (c.statut === 'en_cours') {
      return `<button class="btn btn-end" onclick="startPayment('${c.id}','${c.prix || ''}')">💳 Terminer &amp; Encaisser</button>`;
    }
    return '';
  })();

  return `
<article class="card statut-${statutClass}" data-id="${c.id}">
  <div class="card-head">
    <span class="card-id">${c.id}</span>
    <span class="badge badge-${statutClass}">${badgeLabel}</span>
  </div>
  <div class="card-body">
    <div class="row-info">📅 ${esc(c.date)}${c.heure ? ' · ' + esc(c.heure) : ''}</div>
    <div class="row-info">👤 <strong>${esc(c.passager)}</strong>${c.tel_passager ? ' — ' + esc(c.tel_passager) : ''}</div>
    <div class="row-trajet">
      <div class="trajet-from">🟢 ${esc(c.depart)}</div>
      <div class="trajet-to">🔴 ${esc(c.arrivee)}</div>
    </div>
    ${c.prix ? `<div class="row-prix">💰 Estimé : ${parseFloat(c.prix).toFixed(2)} €</div>` : ''}
    ${c.notes ? `<div class="row-notes">📝 ${esc(c.notes)}</div>` : ''}
  </div>
  ${actions ? `<div class="card-actions">${actions}</div>` : ''}
</article>`;
}

async function respondCourse(courseId, statut) {
  if (!SESSION?.token) return;
  const card = document.querySelector(`.card[data-id="${courseId}"]`);
  if (card) card.querySelectorAll('.btn').forEach(b => b.disabled = true);

  try {
    const res  = await fetch(`${API}/update-course`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: SESSION.token, course_id: courseId, statut })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur mise a jour');
    const labels = { confirmee: 'acceptée ✅', en_cours: 'démarrée 🚗', terminee: 'terminée 🏁' };
    showToast('Course ' + (labels[statut] || statut), 'success');
    setTimeout(() => loadMyCourses(), 800);
  } catch (e) {
    showToast(e.message, 'error');
    if (card) card.querySelectorAll('.btn').forEach(b => b.disabled = false);
  }
}

// ════════════════════════════════════════════════════════════
// PAIEMENT STRIPE
// ════════════════════════════════════════════════════════════

var _stripe      = null;
var _stripeCard  = null;
var _payCoursId  = null;
var _payPiId     = null;
var _payMontant  = 0;

async function startPayment(courseId, prixEstime) {
  _payCoursId = courseId;
  _payPiId    = null;

  // Initialiser Stripe.js (chargé avant app.js dans index.html)
  if (!_stripe) {
    if (typeof Stripe === 'undefined') {
      showToast('Stripe non chargé — rafraîchissez la page', 'error');
      return;
    }
    _stripe = Stripe(STRIPE_PK);
  }

  // Pré-remplir le montant avec le prix estimé de la course
  var montant = parseFloat(prixEstime) || 0;
  _payMontant = montant;

  var prixEl  = document.getElementById('payMontantEstime');
  var inputEl = document.getElementById('payMontantFinal');
  if (prixEl)  prixEl.textContent = montant > 0 ? montant.toFixed(2) + ' €' : '—';
  if (inputEl) inputEl.value      = montant > 0 ? montant.toFixed(2) : '';

  // Monter l'élément carte Stripe (une seule fois)
  if (!_stripeCard) {
    var elements = _stripe.elements();
    _stripeCard  = elements.create('card', {
      hidePostalCode: true,
      style: {
        base: {
          fontSize: '16px',
          color: '#1a3a5c',
          '::placeholder': { color: '#8a9ab0' }
        },
        invalid: { color: '#dc3545' }
      }
    });
  }
  var cardContainer = document.getElementById('stripe-card-element');
  if (cardContainer && !cardContainer._mounted) {
    _stripeCard.mount('#stripe-card-element');
    cardContainer._mounted = true;
    _stripeCard.addEventListener('change', function(evt) {
      var errEl = document.getElementById('pay-card-error');
      if (errEl) errEl.textContent = evt.error ? evt.error.message : '';
    });
  }

  // Réinitialiser le bouton et afficher la modal
  var btn = document.getElementById('paySubmitBtn');
  if (btn) { btn.disabled = false; btn.textContent = '💳 Encaisser'; }
  var errEl = document.getElementById('pay-card-error');
  if (errEl) errEl.textContent = '';

  var modal = document.getElementById('payModal');
  if (modal) modal.hidden = false;
}

function closePayModal() {
  var modal = document.getElementById('payModal');
  if (modal) modal.hidden = true;
}


// FIX-3 : mappe le type transporteur (feuille T1) vers les types attendus par create-payment
function mapTypeTransporteur(t) {
  t = (t || '').toLowerCase();
  if (t.indexOf('ambu') !== -1 || t.indexOf('vsl') !== -1 || t.indexOf('medic') !== -1) return 'medical';
  if (t.indexOf('vtc') !== -1) return 'vtc';
  return 'taxi';
}

async function submitPayment() {
  if (!_payCoursId || !SESSION?.token) return;

  var inputEl = document.getElementById('payMontantFinal');
  var montant = parseFloat(inputEl?.value);
  if (!montant || montant < 0.5) { showToast('Montant invalide (minimum 0,50 \u20ac)', 'error'); return; } // FIX-2 : min Stripe 0,50 \u20ac
  _payMontant = montant;

  var btn   = document.getElementById('paySubmitBtn');
  var errEl = document.getElementById('pay-card-error');
  if (btn)   { btn.disabled = true; btn.textContent = 'Traitement…'; }
  if (errEl) errEl.textContent = '';

  try {
    // ── Étape 1 : créer le Payment Intent (capture manual) ──
    var res1 = await fetch(API + '/create-payment', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SESSION.token },
      // FIX-3 : transmettre le type de transporteur (sinon commission toujours 10% taxi)
      body:    JSON.stringify({ token: SESSION.token, courseId: _payCoursId, montant_estime: montant,
                                type_transporteur: mapTypeTransporteur(SESSION.type) })
    });
    var data1 = await res1.json();
    if (!res1.ok) throw new Error(data1.error || 'Erreur création paiement');

    var clientSecret = data1.client_secret;
    _payPiId         = data1.payment_intent_id;

    // FIX-4 : garde-fou LIVE/TEST — la clé publique et la clé serveur doivent être dans le même mode
    var pkLive = STRIPE_PK.indexOf('pk_live_') === 0;
    if (data1.mode && ((data1.mode === 'LIVE') !== pkLive)) {
      throw new Error('Configuration Stripe incohérente (clé publique ' + (pkLive ? 'LIVE' : 'TEST') +
        ' / serveur ' + data1.mode + ') — paiement annulé');
    }
    if (data1.mode === 'TEST') showToast('⚠️ MODE TEST Stripe — aucun débit réel', 'warning');

    // FIX-5 : si le PI réutilisé est déjà autorisé (requires_capture), ne pas re-confirmer la carte
    if (data1.statut_pi !== 'requires_capture') {
      if (btn) btn.textContent = 'Confirmation carte…';

      // ── Étape 2 : confirmer la carte via Stripe.js ──
      var result = await _stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: _stripeCard }
      });
      if (result.error) throw new Error(result.error.message);
    }

    if (btn) btn.textContent = 'Capture en cours…';

    // ── Étape 3 : capturer côté serveur + MAJ Sheets + email admin ──
    var res2 = await fetch(API + '/confirm-payment', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SESSION.token },
      body:    JSON.stringify({
        courseId:          _payCoursId,
        payment_intent_id: _payPiId,
        montant_final:     montant
      })
    });
    var data2 = await res2.json();
    if (!res2.ok) throw new Error(data2.error || 'Erreur capture');

    closePayModal();
    showToast('✅ Paiement encaissé — ' + montant.toFixed(2) + ' €', 'success');
    setTimeout(function() { loadMyCourses(); }, 1000);

  } catch (e) {
    if (errEl) errEl.textContent = e.message;
    showToast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💳 Encaisser'; }
  }
}

// ════════════════════════════════════════════════════════════
// STRIPE CONNECT — ONBOARDING TRANSPORTEUR
// ════════════════════════════════════════════════════════════

// Modèle B (v46): pas de Stripe Connect — bannière toujours masquée
function renderStripeBanner() {
  var banner = document.getElementById('stripe-banner');
  if (banner) banner.hidden = true;
}

// Lance le flux KYC Stripe Connect Express
async function startStripeOnboarding() {
  if (!SESSION?.token) return;
  setLoading(true, 'Connexion à Stripe…');
  try {
    var res  = await fetch(API + '/transporter-onboarding', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SESSION.token }
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur onboarding');
    if (data.kyc_complet) {
      SESSION.stripe_actif = true;
      SESSION.stripe_account_id = data.stripe_account_id;
      try { sessionStorage.setItem('mlc41_session', JSON.stringify(SESSION)); } catch {}
      renderStripeBanner();
      showToast('✅ Compte Stripe validé — paiements activés !', 'success');
    } else {
      showToast('Redirection vers Stripe…', 'info');
      setTimeout(function() { window.location.href = data.onboarding_url; }, 800);
    }
  } catch(e) {
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

// Gérer le retour depuis Stripe (?stripe=success ou ?stripe=refresh)
function handleStripeReturn() {
  var params = new URLSearchParams(window.location.search);
  var stripeParam = params.get('stripe');
  if (!stripeParam) return;
  history.replaceState({}, '', window.location.pathname);
  if (stripeParam === 'success') {
    showToast('✅ Inscription Stripe complétée ! Vos paiements seront activés sous peu.', 'success');
    if (SESSION?.token) {
      SESSION.stripe_actif = true;
      try { sessionStorage.setItem('mlc41_session', JSON.stringify(SESSION)); } catch {}
      renderStripeBanner();
    }
  } else if (stripeParam === 'refresh') {
    showToast('Le lien Stripe a expiré. Cliquez sur "Rejoindre Stripe" pour un nouveau lien.', 'warning');
  }
}

// ════════════════════════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════════════════════════

function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.hidden = true);
  const el = document.getElementById('panel-' + name);
  if (el) el.hidden = false;
}

function chooseRole(role) {
  if (role === 'transporteur') {
    showPanel('transporteur-choice');
  } else {
    showToast('Bientot disponible', 'info');
  }
}


function updateHeader() {
  if (!SESSION) return;
  const nom  = document.getElementById('headerNom');
  const type = document.getElementById('headerType');
  if (nom)  nom.textContent  = SESSION.nom     || '';
  if (type) type.textContent = SESSION.type    || '';
}

function setLoading(show, msg) {
  const overlay = document.getElementById('loadingOverlay');
  const txt     = document.getElementById('loadingText');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
  if (txt && msg) txt.textContent = msg;
}

function showToast(msg, type = 'info') {
  document.getElementById('toast-el')?.remove();
  const t = document.createElement('div');
  t.id        = 'toast-el';
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ════════════════════════════════════════════════════════════
// USAGER
// ════════════════════════════════════════════════════════════

function uTab(name, btn) {
  document.querySelectorAll('.u-tab').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.u-section').forEach(function(s) { s.hidden = true; });
  document.getElementById('u-' + name).hidden = false;
  if (btn) btn.classList.add('active');
}

function uNewDemande() {
  document.getElementById('courseForm').reset();
  document.getElementById('courseForm').hidden = false;
  document.getElementById('u-confirm').hidden = true;
}

document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('courseForm');
  if (form) form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var nom     = document.getElementById('uNom').value.trim();
    var prenom  = document.getElementById('uPrenom').value.trim();
    var tel     = document.getElementById('uTel').value.trim();
    var depart  = document.getElementById('uDepart').value.trim();
    var arrivee = document.getElementById('uArrivee').value.trim();
    var date    = document.getElementById('uDate').value.trim();
    var heure   = document.getElementById('uHeure').value.trim();
    var motif   = document.getElementById('uMotif').value.trim();
    if (!nom || !tel || !depart || !arrivee || !date || !heure) {
      showToast('Remplissez tous les champs obligatoires', 'error'); return;
    }
    setLoading(true, 'Envoi en cours...');
    try {
      var res = await fetch(API + '/request-course', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nom, prenom: prenom, tel: tel,
          depart: depart, arrivee: arrivee, date: date, heure: heure, motif: motif,
          type_service: (document.getElementById('uTypeService') || {}).value || 'taxi_immediat',
          prescription: (document.getElementById('uPrescription') || {}).value || '',
          montant_estime: _lastMontantEstime })
      });
      var data = await res.json();
      if (!res.ok) { showToast(data.error || 'Erreur', 'error'); return; }
      document.getElementById('u-ref-box').textContent = data.ref;
      document.getElementById('courseForm').hidden = true;
      document.getElementById('u-confirm').hidden = false;
    } catch(err) {
      showToast('Erreur reseau', 'error');
    } finally { setLoading(false); }
  });
});

async function uTrack() {
  var ref = (document.getElementById('uRef').value || '').trim().toUpperCase();
  if (!ref) { showToast('Entrez votre code de reference', 'warning'); return; }
  setLoading(true, 'Recherche...');
  var resultEl = document.getElementById('u-track-result');
  resultEl.hidden = true;
  try {
    var res = await fetch(API + '/track-course?ref=' + encodeURIComponent(ref));
    var data = await res.json();
    if (!res.ok) { showToast(data.error || 'Reference introuvable', 'error'); return; }
    var statutLabel = {
      en_attente: '⏳ En attente', confirmee: '✅ Confirmee',
      en_cours: '🚗 En cours', terminee: '🏁 Terminee', refusee: '❌ Refusee'
    };
    var tel = data.transporteur_tel || '';
    resultEl.innerHTML =
      '<div class="track-statut">' + (statutLabel[data.statut] || data.statut) + '</div>' +
      '<div class="track-row"><span class="track-label">Ref :</span><span>' + esc(data.ref) + '</span></div>' +
      '<div class="track-row"><span class="track-label">Date :</span><span>' + esc(data.date) + ' a ' + esc(data.heure) + '</span></div>' +
      '<div class="track-row"><span class="track-label">Depart :</span><span>' + esc(data.depart) + '</span></div>' +
      '<div class="track-row"><span class="track-label">Arrivee :</span><span>' + esc(data.arrivee) + '</span></div>' +
      (data.motif ? '<div class="track-row"><span class="track-label">Motif :</span><span>' + esc(data.motif) + '</span></div>' : '') +
      (data.transporteur_nom ? '<div class="track-row"><span class="track-label">Taxi :</span><span>' + esc(data.transporteur_nom) + '</span></div>' : '') +
      (tel ? '<div class="track-row"><span class="track-label">Tel :</span><a href="tel:' + tel + '" class="track-tel">' + tel + '</a></div>' : '') +
      (data.notes ? '<div class="track-row"><span class="track-label">Note :</span><span>' + data.notes + '</span></div>' : '');
    resultEl.hidden = false;
  } catch(err) {
    showToast('Erreur reseau', 'error');
  } finally { setLoading(false); }
}

// ════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════

var ADMIN_SESSION = null;
var ADMIN_COURSES = [];
var ADMIN_TRANSPORTEURS = [];
var ASSIGN_COURSE_ID = null;

(function() {
  try {
    var raw = sessionStorage.getItem('mlc41_admin_session');
    if (raw) ADMIN_SESSION = JSON.parse(raw);
  } catch(e) { ADMIN_SESSION = null; }
})();

document.addEventListener('DOMContentLoaded', function() {
  var adminForm = document.getElementById('adminLoginForm');
  if (adminForm) adminForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var id  = document.getElementById('adminId').value.trim();
    var pin = document.getElementById('adminPin').value.trim();
    setLoading(true, 'Connexion...');
    try {
      var res = await fetch(API + '/admin-auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, pin: pin })
      });
      var data = await res.json();
      if (!res.ok) { showToast(data.error || 'Erreur', 'error'); return; }
      ADMIN_SESSION = data;
      sessionStorage.setItem('mlc41_admin_session', JSON.stringify(data));
      showPanel('admin-dash');
      adminRefresh();
    } catch(err) { showToast('Erreur reseau', 'error'); }
    finally { setLoading(false); }
  });

  // Auto-login admin if session exists
  if (ADMIN_SESSION && ADMIN_SESSION.token) {
    // Don't auto-navigate, but session is ready if needed
  }
});

function adminLogout() {
  ADMIN_SESSION = null;
  sessionStorage.removeItem('mlc41_admin_session');
  showPanel('home');
}

function adminTab(name, btn) {
  document.querySelectorAll('.admin-tab').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.admin-section').forEach(function(s) { s.hidden = true; });
  document.getElementById('admin-' + name).hidden = false;
  if (btn) btn.classList.add('active');
  if (name === 'transporteurs' && ADMIN_TRANSPORTEURS.length === 0) adminLoadTransporteurs();
}

async function adminRefresh() {
  if (!ADMIN_SESSION) return;
  setLoading(true, 'Chargement...');
  try {
    var res = await fetch(API + '/admin-get-courses?token=' + encodeURIComponent(ADMIN_SESSION.token));
    var data = await res.json();
    if (!res.ok) { if (res.status === 401) { adminLogout(); return; } showToast(data.error, 'error'); return; }
    ADMIN_COURSES = data.courses || [];
    adminRenderCourses();
  } catch(e) { showToast('Erreur reseau', 'error'); }
  finally { setLoading(false); }
}

function adminRenderCourses() {
  var filter = document.getElementById('adminFilter').value;
  var list = ADMIN_COURSES.filter(function(c) { return !filter || c.statut === filter; });
  var el = document.getElementById('adminCoursesList');
  if (!list.length) { el.innerHTML = '<p class="msg-empty">Aucune course</p>'; return; }
  var STATUT = { en_attente:'⏳ En attente', confirmee:'✅ Confirmee', en_cours:'🚗 En cours', terminee:'🏁 Terminee', refusee:'❌ Refusee' };
  el.innerHTML = list.map(function(c) {
    var btns = '';
    if (c.statut === 'en_attente' || c.statut === 'confirmee') {
      btns += '<button class="btn-assign" onclick="adminOpenAssign(\'' + c.id + '\',\'' + (c.passager||'').replace(/\'/g,'') + '\')">Assigner</button>';
      btns += '<button class="btn-refuse" onclick="adminRefuseCourse(\'' + c.id + '\')">Refuser</button>';
    }
    return '<div class="admin-card">' +
      '<div class="admin-card-top"><span class="badge badge-' + c.statut.replace('_','-') + '">' + (STATUT[c.statut]||c.statut) + '</span>' +
      '<span class="admin-card-ref">' + esc(c.ref||c.id) + '</span></div>' +
      '<div class="admin-card-passager">' + esc(c.passager||'—') + ' · ' + esc(c.tel||'—') + '</div>' +
      '<div class="admin-card-info">📅 ' + esc(c.date) + ' ' + esc(c.heure) + '</div>' +
      '<div class="admin-card-info">📍 ' + esc(c.depart) + '</div>' +
      '<div class="admin-card-info">🏥 ' + esc(c.arrivee) + '</div>' +
      (c.transporteur_id ? '<div class="admin-card-info">🚗 ' + esc(c.transporteur_id) + '</div>' : '') +
      (btns ? '<div class="admin-card-actions">' + btns + '</div>' : '') +
      '</div>';
  }).join('');
}

async function adminLoadTransporteurs() {
  if (!ADMIN_SESSION) return;
  setLoading(true, 'Chargement...');
  try {
    var res = await fetch(API + '/admin-get-transporteurs?token=' + encodeURIComponent(ADMIN_SESSION.token));
    var data = await res.json();
    if (!res.ok) { showToast(data.error, 'error'); return; }
    ADMIN_TRANSPORTEURS = data.transporteurs || [];
    adminRenderTransporteurs();
  } catch(e) { showToast('Erreur reseau', 'error'); }
  finally { setLoading(false); }
}

function adminRenderTransporteurs() {
  var el = document.getElementById('adminTransporteursList');
  if (!ADMIN_TRANSPORTEURS.length) { el.innerHTML = '<p class="msg-empty">Aucun transporteur</p>'; return; }
  el.innerHTML = ADMIN_TRANSPORTEURS.map(function(t) {
    return '<div class="t-card">' +
      '<div class="t-card-dot' + (t.actif ? '' : ' off') + '"></div>' +
      '<div class="t-card-info"><div class="t-card-nom">' + esc(t.nom) + '</div>' +
      '<div class="t-card-detail">' + esc(t.id) + ' · ' + esc(t.type) + ' · ' + esc(t.commune) + '</div></div>' +
      (t.tel ? '<a href="tel:' + t.tel + '" class="t-card-tel">' + t.tel + '</a>' : '') +
      '</div>';
  }).join('');
}

function adminOpenAssign(courseId, passager) {
  ASSIGN_COURSE_ID = courseId;
  document.getElementById('assignCourseInfo').textContent = 'Course : ' + passager;
  var sel = document.getElementById('assignSelect');
  if (!ADMIN_TRANSPORTEURS.length) {
    adminLoadTransporteurs().then(function() { adminFillSelect(sel); });
  } else { adminFillSelect(sel); }
  document.getElementById('assignModal').hidden = false;
}

function adminFillSelect(sel) {
  sel.innerHTML = '<option value="">-- Choisir --</option>' +
    ADMIN_TRANSPORTEURS.filter(function(t){ return t.actif; }).map(function(t) {
      return '<option value="' + esc(t.id) + '">' + esc(t.nom) + ' (' + esc(t.type) + ' - ' + esc(t.commune) + ')</option>';
    }).join('');
}

async function adminAssignConfirm() {
  var tid = document.getElementById('assignSelect').value;
  if (!tid) { showToast('Choisissez un transporteur', 'warning'); return; }
  document.getElementById('assignModal').hidden = true;
  setLoading(true, 'Assignation...');
  try {
    var res = await fetch(API + '/admin-assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ADMIN_SESSION.token, course_id: ASSIGN_COURSE_ID,
        transporteur_id: tid, statut: 'confirmee' })
    });
    var data = await res.json();
    if (!res.ok) { showToast(data.error || 'Erreur', 'error'); return; }
    showToast('Course assignee !', 'success');
    adminRefresh();
  } catch(e) { showToast('Erreur reseau', 'error'); }
  finally { setLoading(false); }
}

async function adminRefuseCourse(courseId) {
  if (!confirm('Refuser cette course ?')) return;
  setLoading(true, 'Traitement...');
  try {
    var res = await fetch(API + '/admin-assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ADMIN_SESSION.token, course_id: courseId,
        transporteur_id: '', statut: 'refusee' })
    });
    var data = await res.json();
    if (!res.ok) { showToast(data.error || 'Erreur', 'error'); return; }
    showToast('Course refusee', 'warning');
    adminRefresh();
  } catch(e) { showToast('Erreur reseau', 'error'); }
  finally { setLoading(false); }
}

// ════════════════════════════════════════════════════════════
// BLOC 4 — Estimation temps réel + Commissions admin
// ════════════════════════════════════════════════════════════


// ── BLOC 4b — Calcul automatique de distance (Nominatim + OSRM) ──────────────
var _autoDistTimer = null;

async function geocode(adresse) {
  // OpenStreetMap Nominatim — gratuit, sans clé API
  var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(adresse + ', France');
  var res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
  var data = await res.json();
  if (!data || !data[0]) throw new Error('Adresse introuvable : ' + adresse);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function calcDistanceOSRM(depart, arrivee) {
  // OSRM — Open Source Routing Machine — gratuit, sans clé API
  var url = 'https://router.project-osrm.org/route/v1/driving/'
    + depart.lon + ',' + depart.lat + ';'
    + arrivee.lon + ',' + arrivee.lat
    + '?overview=false';
  var res = await fetch(url);
  var data = await res.json();
  if (data.code !== 'Ok' || !data.routes || !data.routes[0]) throw new Error('Itinéraire impossible');
  var km = Math.round(data.routes[0].distance / 1000);
  return Math.max(km, 1); // minimum 1 km
}

function onAdresseChange() {
  clearTimeout(_autoDistTimer);
  var depart = (document.getElementById('uDepart')?.value || '').trim();
  var dest   = (document.getElementById('uArrivee')?.value || '').trim();
  var kmField = document.getElementById('uKm');
  var box     = document.getElementById('uEstimation');
  if (!depart || !dest || depart.length < 5 || dest.length < 3) return;
  _autoDistTimer = setTimeout(async function() {
    if (box) { box.hidden = false; box.textContent = '📍 Calcul de la distance en cours…'; }
    try {
      var coordDepart  = await geocode(depart);
      var coordArrivee = await geocode(dest);
      var km = await calcDistanceOSRM(coordDepart, coordArrivee);
      if (kmField) {
        kmField.value = km;
        kmField.dispatchEvent(new Event('input')); // déclenche estimateOnChange
      }
    } catch(e) {
      if (box) { box.hidden = false; box.textContent = '⚠️ Distance auto indisponible — saisir manuellement'; }
    }
  }, 1200); // délai 1.2s après la dernière frappe
}

// Attacher les événements adresse/destination dès que le DOM est prêt
document.addEventListener('DOMContentLoaded', function() {
  var dep = document.getElementById('uDepart');
  var dst = document.getElementById('uArrivee');
  if (dep) dep.addEventListener('blur', onAdresseChange);
  if (dst) dst.addEventListener('blur', onAdresseChange);
});


// ── Détection automatique Tarif A/B selon date, heure, jour, férié ──────────
function calculerPaques(annee) {
  // Algorithme de Meeus/Jones/Butcher
  var a = annee % 19, b = Math.floor(annee/100), c = annee % 100;
  var d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  var g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  var i = Math.floor(c/4), k = c % 4, l = (32+2*e+2*i-h-k) % 7;
  var m = Math.floor((a+11*h+22*l)/451);
  var mois = Math.floor((h+l-7*m+114)/31);
  var jour = ((h+l-7*m+114) % 31) + 1;
  return new Date(annee, mois-1, jour);
}

function estFeriesFrance(date) {
  var MM = date.getMonth()+1, DD = date.getDate(), AA = date.getFullYear();
  // Fériés fixes
  var fixes = [[1,1],[5,1],[5,8],[7,14],[8,15],[11,1],[11,11],[12,25]];
  for (var f of fixes) { if (MM===f[0] && DD===f[1]) return true; }
  // Fériés mobiles (basés sur Pâques)
  var paques = calculerPaques(AA);
  var mobiles = [1, 39, 50]; // Lundi Pâques, Ascension, Lundi Pentecôte
  for (var j of mobiles) {
    var d2 = new Date(paques); d2.setDate(paques.getDate()+j);
    if (d2.getFullYear()===AA && d2.getMonth()+1===MM && d2.getDate()===DD) return true;
  }
  return false;
}

function detecterOptions(dateStr, heureStr) {
  // dateStr: "2026-07-12", heureStr: "17:00"
  var opts = {};
  if (!dateStr) return opts;
  var date = new Date(dateStr + 'T' + (heureStr || '12:00') + ':00');
  if (isNaN(date.getTime())) return opts;
  var heure = date.getHours();
  var jour  = date.getDay(); // 0=dimanche, 6=samedi
  // Nuit : avant 6h ou à partir de 20h (arrêté préfectoral 41)
  if (heure < 6 || heure >= 20) opts.nuit = true;
  // Dimanche ou samedi = Tarif B Loir-et-Cher
  if (jour === 0 || jour === 6) opts.dimanche = true;
  // Jour férié
  if (estFeriesFrance(date)) opts.ferie = true;
  return opts;
}

var _estimateTimer = null;
var _lastMontantEstime = 0;
function estimateOnChange() {
  clearTimeout(_estimateTimer);
  var km = parseFloat(document.getElementById('uKm')?.value) || 0;
  var box = document.getElementById('uEstimation');
  if (!box) return;
  if (km < 1) { box.hidden = true; return; }
  box.hidden = false;
  box.textContent = '⏳ Calcul en cours…';
  _estimateTimer = setTimeout(async function() {
    var typeRaw = document.getElementById('uTypeService')?.value || 'taxi_immediat';
    // Mapper type_service → type_transporteur attendu par estimate-course
    var typeMap = { taxi_immediat: 'taxi', taxi_planifie: 'taxi', ambulance: 'medical' };
    var type_transporteur = typeMap[typeRaw] || 'taxi';
    try {
      var dateStr  = document.getElementById('uDate')?.value || '';
      var heureStr = document.getElementById('uHeure')?.value || '';
      var options  = detecterOptions(dateStr, heureStr);
      var res = await fetch(API + '/estimate-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ km: km, type_transporteur: type_transporteur, options: options })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur estimation');
      var montant = data.montant_estime.toFixed(2);
      _lastMontantEstime = parseFloat(montant);
      var tarif = data.detail ? data.detail.tarif_applique || data.detail.tarif_km_cpam || '' : '';
      var detail_str = tarif ? ' — ' + tarif : '';
      box.innerHTML = '💶 <strong>Estimation : ' + montant + ' €</strong> (' + km + ' km, ' + type_transporteur + detail_str + ')';
    } catch(e) {
      box.textContent = '⚠️ Estimation indisponible';
    }
  }, 600);
}

// ── Admin Commissions ──
async function adminLoadCommissions() {
  if (!ADMIN_SESSION) return;
  var moisInput = document.getElementById('commissionsMois');
  var mois = moisInput ? moisInput.value : '';
  if (!mois) {
    // Par défaut : mois précédent
    var d = new Date();
    d = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    mois = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    if (moisInput) moisInput.value = mois;
  }
  var el = document.getElementById('adminCommissionsList');
  if (el) el.innerHTML = '<p class="msg-info">Chargement ' + mois + '…</p>';
  try {
    var res = await fetch(API + '/payout-report?mois=' + mois + '&token=' + encodeURIComponent(ADMIN_SESSION.token));
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    adminRenderCommissions(data.commissions || [], mois);
  } catch(e) {
    if (el) el.innerHTML = '<p class="msg-error">Erreur : ' + e.message + '</p>';
  }
}

async function adminGenerateCommissions() {
  if (!ADMIN_SESSION) return;
  if (!confirm('Générer le rapport de commissions pour ce mois ?')) return;
  var moisInput = document.getElementById('commissionsMois');
  var mois = moisInput ? moisInput.value : '';
  setLoading(true, 'Génération commissions…');
  try {
    var body = { token: ADMIN_SESSION.token };
    if (mois) body.mois = mois;
    var res = await fetch(API + '/payout-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    showToast('Rapport généré — ' + (data.inserted || 0) + ' ligne(s) ajoutées', 'success');
    adminLoadCommissions();
  } catch(e) { showToast(e.message, 'error'); }
  finally { setLoading(false); }
}

function adminRenderCommissions(rows, mois) {
  var el = document.getElementById('adminCommissionsList');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<p class="msg-empty">Aucune commission pour ' + mois + '.<br>Cliquez "Générer ce mois" pour calculer.</p>';
    return;
  }
  var totalCA = 0, totalComm = 0, totalRev = 0;
  rows.forEach(function(r) { totalCA += parseFloat(r.ca_total)||0; totalComm += parseFloat(r.commission_smd)||0; totalRev += parseFloat(r.reversement)||0; });
  var fmt = function(v) { return ((v||0)/100).toFixed(2) + ' €'; };
  el.innerHTML = '<div style="overflow-x:auto"><table class="commission-table">' +
    '<thead><tr><th>Transporteur</th><th>Courses</th><th>CA</th><th>Commission</th><th>Reversement</th><th>Statut</th></tr></thead>' +
    '<tbody>' +
    rows.map(function(r) {
      return '<tr>' +
        '<td><b>' + (r.transporteur_nom||r.transporteur_id) + '</b><br><small>' + r.transporteur_id + '</small></td>' +
        '<td style="text-align:center">' + (r.nb_courses||0) + '</td>' +
        '<td>' + fmt(r.ca_total) + '</td>' +
        '<td>' + fmt(r.commission_smd) + '</td>' +
        '<td>' + fmt(r.reversement) + '</td>' +
        '<td class="statut-' + (r.statut_virement||'en_attente') + '">' + (r.statut_virement||'en_attente') + '</td>' +
        '</tr>';
    }).join('') +
    '<tr style="background:#f5f5f5;font-weight:700"><td>TOTAL</td><td></td><td>' + fmt(totalCA) + '</td><td>' + fmt(totalComm) + '</td><td>' + fmt(totalRev) + '</td><td></td></tr>' +
    '</tbody></table></div>';
}
