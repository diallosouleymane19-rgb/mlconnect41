/* Autocomplete adresses 41 + calcul distance auto — MobiLoireConnect41
 * v2 — corrections :
 *  - Desactive le calcul de distance "legacy" de app.js (blur -> Nominatim/OSRM)
 *    qui ecrasait uKm avec une distance geocodee sur une mauvaise commune (bug 750 km).
 *  - Ecrase TOUJOURS uKm a chaque nouvelle paire d'adresses selectionnees.
 *  - Indicateur visuel "Distance calculee automatiquement : X km" sous le champ.
 *  - Champ uKm en lecture seule pendant le calcul, puis re-modifiable.
 *  - Anti-course : seule la derniere requete /api/distance est prise en compte.
 *  - En cas d'echec OSRM : message clair + saisie manuelle laissee possible.
 */
(function () {
  var coords = { depart: null, arrivee: null };
  var requestSeq = 0; // jeton anti-course : seule la reponse la plus recente est appliquee

  /* ── Neutralisation du calcul legacy de app.js (BLOC 4b) ──────────────────
   * app.js attache onAdresseChange sur le blur de #uDepart/#uArrivee :
   * il geocode le TEXTE LIBRE via Nominatim (limit=1) puis ecrase uKm 1,2 s
   * plus tard. "1 Rue de la Mairie" peut matcher n'importe quelle rue de la
   * Mairie en France -> distances aberrantes (ex. 750 km) qui ecrasent la
   * valeur correcte calculee ici. On retire ces listeners au demarrage. */
  function disableLegacyAutoDistance() {
    try {
      if (typeof window.onAdresseChange === 'function') {
        var dep = document.getElementById('uDepart');
        var dst = document.getElementById('uArrivee');
        if (dep) dep.removeEventListener('blur', window.onAdresseChange);
        if (dst) dst.removeEventListener('blur', window.onAdresseChange);
        // Ceinture + bretelles : toute invocation residuelle devient inoffensive
        window.onAdresseChange = function () {};
        if (window._autoDistTimer) clearTimeout(window._autoDistTimer);
      }
    } catch (e) { /* non bloquant */ }
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /* ── Indicateur visuel sous le champ Distance ─────────────────────────── */
  function getDistInfo() {
    var el = document.getElementById('acDistInfo');
    if (el) return el;
    var km = document.getElementById('uKm');
    if (!km || !km.parentElement) return null;
    el = document.createElement('div');
    el.id = 'acDistInfo';
    el.style.cssText = 'margin-top:6px;font-size:13px;line-height:1.4;color:#9fd3ff;';
    // Insere juste apres le champ uKm (avant uEstimation s'il existe)
    km.insertAdjacentElement('afterend', el);
    return el;
  }

  function setDistInfo(text, kind) {
    var el = getDistInfo();
    if (!el) return;
    if (!text) { el.textContent = ''; el.style.display = 'none'; return; }
    el.textContent = text;
    el.style.display = 'block';
    el.style.color = kind === 'error' ? '#ffb3b3'
                   : kind === 'busy'  ? '#ffe9a8'
                   : '#9fd3ff';
  }

  function setKmLocked(locked) {
    var km = document.getElementById('uKm');
    if (!km) return;
    km.readOnly = !!locked;
    km.style.opacity = locked ? '0.6' : '';
  }

  function makeDropdown(input) {
    var list = document.createElement('ul');
    list.className = 'ac-list';
    list.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:#1d3a5f;border:1px solid rgba(255,255,255,.25);border-radius:12px;margin:6px 0 0;padding:4px;list-style:none;z-index:999;max-height:220px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.4);display:none;';
    var parent = input.parentElement;
    parent.style.position = 'relative';
    parent.appendChild(list);
    return list;
  }

  function attach(inputId, type) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var list = makeDropdown(input);

    var search = debounce(function () {
      var q = input.value.trim();
      // L'adresse a change : les coordonnees memorisees ne sont plus valides.
      coords[type] = null;
      // Invalide toute reponse distance en vol et retire l'indicateur "auto"
      requestSeq++;
      setKmLocked(false);
      setDistInfo('');
      if (q.length < 2) { list.style.display = 'none'; return; }
      fetch('/api/adresses/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var results = data.results || [];
          list.innerHTML = '';
          if (!results.length) { list.style.display = 'none'; return; }
          results.forEach(function (a) {
            var li = document.createElement('li');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = (a.numero ? a.numero + ' ' : '') + a.rue + ' — ' + a.code_postal + ' ' + a.commune;
            btn.style.cssText = 'width:100%;text-align:left;padding:10px 12px;background:transparent;border:none;color:#fff;font-size:14px;cursor:pointer;border-radius:8px;';
            btn.onmouseover = function () { btn.style.background = 'rgba(255,255,255,.1)'; };
            btn.onmouseout = function () { btn.style.background = 'transparent'; };
            btn.onclick = function () {
              input.value = (a.numero ? a.numero + ' ' : '') + a.rue + ', ' + a.code_postal + ' ' + a.commune;
              coords[type] = { lat: a.latitude, lng: a.longitude };
              list.style.display = 'none';
              maybeDistance();
            };
            li.appendChild(btn);
            list.appendChild(li);
          });
          list.style.display = 'block';
        })
        .catch(function () { list.style.display = 'none'; });
    }, 300);

    input.addEventListener('input', search);
    document.addEventListener('click', function (e) {
      if (!list.contains(e.target) && e.target !== input) list.style.display = 'none';
    });
  }

  function maybeDistance() {
    if (!coords.depart || !coords.arrivee) return;
    var mySeq = ++requestSeq; // toute reponse plus ancienne sera ignoree
    var kmField = document.getElementById('uKm');

    // Verrouille le champ pendant le calcul + indicateur
    setKmLocked(true);
    setDistInfo('Calcul de la distance en cours…', 'busy');

    fetch('/api/distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat1: coords.depart.lat, lng1: coords.depart.lng,
        lat2: coords.arrivee.lat, lng2: coords.arrivee.lng
      })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (mySeq !== requestSeq) return; // reponse obsolete (adresse changee entre-temps)
        setKmLocked(false);
        if (data == null || data.distance == null || isNaN(data.distance)) {
          throw new Error('Reponse distance invalide');
        }
        var km = Math.max(1, Math.round(data.distance));
        if (kmField) {
          // ECRASE TOUJOURS la valeur (manuelle ou ancienne) : la paire
          // d'adresses selectionnee fait foi.
          kmField.value = km;
          setDistInfo('Distance calculee automatiquement : ' + km + ' km (modifiable)', 'ok');
          if (typeof window.estimateOnChange === 'function') window.estimateOnChange();
        }
      })
      .catch(function (e) {
        if (mySeq !== requestSeq) return;
        console.error('Distance error', e);
        // Echec OSRM/API : on laisse la saisie manuelle possible
        setKmLocked(false);
        setDistInfo('Calcul automatique indisponible — saisissez la distance manuellement.', 'error');
      });
  }

  function init() {
    disableLegacyAutoDistance();
    attach('uDepart', 'depart');
    attach('uArrivee', 'arrivee');
    // Si l'usager modifie uKm a la main, on retire le label "automatique"
    var kmField = document.getElementById('uKm');
    if (kmField) {
      kmField.addEventListener('input', function () {
        if (!kmField.readOnly) setDistInfo('');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
