import React from 'react';

export default function InscriptionTransporteur() {
  return (
    <>
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          width: 100%;
          max-width: 550px;
          padding: 40px;
        }
        .logo {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo h1 {
          font-size: 24px;
          color: #667eea;
          margin-bottom: 8px;
        }
        .logo p {
          color: #666;
          font-size: 14px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
          font-size: 14px;
        }
        input, select, textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.3s;
        }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .file-input-label {
          display: block;
          padding: 12px;
          border: 2px dashed #ddd;
          border-radius: 6px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.3s;
        }
        .file-input-label:hover {
          border-color: #667eea;
          background: rgba(102, 126, 234, 0.05);
        }
        input[type="file"] {
          display: none;
        }
        .file-name {
          margin-top: 8px;
          font-size: 12px;
          color: #666;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .checkbox-group {
          display: flex;
          align-items: flex-start;
          margin-bottom: 15px;
        }
        input[type="checkbox"] {
          width: auto;
          margin-right: 10px;
          margin-top: 4px;
          cursor: pointer;
        }
        .checkbox-group label {
          margin-bottom: 0;
          font-size: 13px;
          line-height: 1.4;
          cursor: pointer;
        }
        .checkbox-group a {
          color: #667eea;
          text-decoration: none;
        }
        .checkbox-group a:hover {
          text-decoration: underline;
        }
        .rgpd-section {
          background: #f0f4ff;
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
          border-left: 4px solid #667eea;
        }
        .rgpd-section h4 {
          color: #667eea;
          font-size: 14px;
          margin-bottom: 12px;
        }
        button {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .alert {
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
          font-size: 14px;
        }
        .alert-error {
          background: #fee;
          color: #c33;
          border: 1px solid #fcc;
        }
        .alert-success {
          background: #efe;
          color: #3c3;
          border: 1px solid #cfc;
        }
        .alert-warning {
          background: #fef3cd;
          color: #664d03;
          border: 1px solid #ffecb5;
        }
        .loading {
          display: none;
          text-align: center;
          color: #667eea;
          font-size: 14px;
        }
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid #667eea;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-right: 8px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .help-text {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }
        .required {
          color: #c33;
        }
      `}</style>

      <div className="container">
        <div className="logo">
          <h1>MobiLoireConnect41</h1>
          <p>Inscription Transporteur</p>
        </div>

        <div id="alerts"></div>

        <form id="inscriptionForm">
          <div className="form-group">
            <label htmlFor="nom">Nom complet <span className="required">*</span></label>
            <input type="text" id="nom" name="nom" required placeholder="Dupont Jean" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="telephone">Téléphone <span className="required">*</span></label>
              <input type="tel" id="telephone" name="telephone" required placeholder="07 83 62 76 51" />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email <span className="required">*</span></label>
              <input type="email" id="email" name="email" required placeholder="vous@example.com" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="siren">SIREN/SIRET <span className="required">*</span></label>
              <input type="text" id="siren" name="siren" required placeholder="12345678901234" maxLength={14} />
              <div className="help-text">10 (SIREN) ou 14 (SIRET) chiffres</div>
            </div>
            <div className="form-group">
              <label htmlFor="type">Type véhicule <span className="required">*</span></label>
              <select id="type" name="type" required>
                <option value="">Choisir...</option>
                <option value="Taxi">Taxi</option>
                <option value="VTC">VTC</option>
                <option value="Ambulance">Ambulance/VSL</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="licence">Licence de circulation (PDF/JPG/PNG) <span className="required">*</span></label>
            <label htmlFor="licence" className="file-input-label">
              📄 Cliquez pour uploader votre licence
            </label>
            <input type="file" id="licence" name="licence" accept=".pdf,.jpg,.jpeg,.png" required />
            <div className="file-name" id="fileName"></div>
            <div className="help-text">Max 5 MB · La licence délivrée par la préfecture suffit</div>
          </div>

          <div className="form-group">
            <label htmlFor="dateExpiration">Date d'expiration de la licence <span className="required">*</span></label>
            <input type="date" id="dateExpiration" name="dateExpiration" required />
            <div className="help-text">Vos données seront conservées jusqu'à cette date</div>
          </div>

          <div className="rgpd-section">
            <h4>🔒 Consentement et Protection des Données (RGPD)</h4>

            <div className="checkbox-group">
              <input type="checkbox" id="consentRGPD" name="consentRGPD" required />
              <label htmlFor="consentRGPD">
                J'accepte le traitement de mes données personnelles conformément à la
                <a href="/politique-confidentialite" target="_blank"> politique de confidentialité</a>
                <span className="required">*</span>
              </label>
            </div>

            <div className="checkbox-group">
              <input type="checkbox" id="consentNotifications" name="consentNotifications" defaultChecked />
              <label htmlFor="consentNotifications">
                J'accepte de recevoir un email et/ou SMS avec mon identifiant et code PIN
              </label>
            </div>

            <div className="checkbox-group">
              <input type="checkbox" id="consentMarketing" name="consentMarketing" />
              <label htmlFor="consentMarketing">
                J'accepte de recevoir des communications marketing et mises à jour (optionnel)
              </label>
            </div>

            <div className="checkbox-group">
              <input type="checkbox" id="licenceValide" name="licenceValide" required />
              <label htmlFor="licenceValide">
                Je confirme que ma licence est valide et accordée par la préfecture
                <span className="required">*</span>
              </label>
            </div>
          </div>

          <div className="loading" id="loading">
            <span className="spinner"></span> Envoi en cours...
          </div>

          <button type="submit" id="submitBtn">S'inscrire</button>
        </form>

        <p style={{ textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '20px' }}>
          ✓ Vous serez contacté sous 24h avec votre identifiant et code PIN.<br />
          ✓ Vos données sont protégées conformément au RGPD.
        </p>
      </div>

      <script dangerouslySetInnerHTML={{__html: `
        const form = document.getElementById('inscriptionForm');
        const fileInput = document.getElementById('licence');
        const fileNameDiv = document.getElementById('fileName');
        const submitBtn = document.getElementById('submitBtn');
        const loading = document.getElementById('loading');
        const alerts = document.getElementById('alerts');

        fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) {
            if (file.size > 5 * 1024 * 1024) {
              showAlert('Erreur: fichier trop gros (max 5 MB)', 'error');
              fileInput.value = '';
              fileNameDiv.textContent = '';
              return;
            }
            const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
            if (!validTypes.includes(file.type)) {
              showAlert('Erreur: format invalide (PDF, JPG ou PNG uniquement)', 'error');
              fileInput.value = '';
              fileNameDiv.textContent = '';
              return;
            }
            fileNameDiv.textContent = \`✓ \${file.name}\`;
          }
        });

        document.getElementById('siren').addEventListener('blur', (e) => {
          const siren = e.target.value.replace(/\\D/g, '');
          if (siren && (siren.length !== 10 && siren.length !== 14)) {
            showAlert('SIREN/SIRET invalide (10 ou 14 chiffres)', 'error');
          }
        });

        document.getElementById('dateExpiration').addEventListener('change', (e) => {
          const selected = new Date(e.target.value);
          const today = new Date();
          if (selected < today) {
            showAlert('⚠️ Date d\\'expiration passée: votre licence doit être valide', 'warning');
          }
        });

        form.addEventListener('submit', async (e) => {
          e.preventDefault();

          const file = fileInput.files[0];
          if (!file) {
            showAlert('Veuillez uploader une licence', 'error');
            return;
          }

          if (!document.getElementById('consentRGPD').checked) {
            showAlert('Vous devez accepter la politique de confidentialité pour continuer', 'error');
            return;
          }

          const formData = new FormData();
          formData.append('nom', document.getElementById('nom').value);
          formData.append('telephone', document.getElementById('telephone').value);
          formData.append('email', document.getElementById('email').value);
          formData.append('siren', document.getElementById('siren').value.replace(/\\D/g, ''));
          formData.append('type', document.getElementById('type').value);
          formData.append('dateExpiration', document.getElementById('dateExpiration').value);
          formData.append('licence', file);
          formData.append('consentRGPD', document.getElementById('consentRGPD').checked);
          formData.append('consentNotifications', document.getElementById('consentNotifications').checked);
          formData.append('consentMarketing', document.getElementById('consentMarketing').checked);

          submitBtn.disabled = true;
          loading.style.display = 'block';
          alerts.innerHTML = '';

          try {
            const response = await fetch('/.netlify/functions/transporteur-onboarding', {
              method: 'POST',
              body: formData
            });

            const data = await response.json();

            if (response.ok) {
              showAlert(\`✓ Inscrit avec succès! ID: \${data.id} · Vérifiez vos emails/SMS pour votre PIN.\`, 'success');
              form.reset();
              fileNameDiv.textContent = '';
              setTimeout(() => window.location.href = '/transporteur', 3000);
            } else {
              showAlert(data.error || 'Erreur lors de l\\'inscription', 'error');
            }
          } catch (err) {
            showAlert('Erreur réseau: ' + err.message, 'error');
          } finally {
            submitBtn.disabled = false;
            loading.style.display = 'none';
          }
        });

        function showAlert(message, type) {
          const alert = document.createElement('div');
          alert.className = \`alert alert-\${type}\`;
          alert.textContent = message;
          alerts.innerHTML = '';
          alerts.appendChild(alert);
        }
      `}} />
    </>
  );
}
