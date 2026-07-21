'use client';

import React, { useEffect, CSSProperties } from 'react';

const styles = {
  globalBody: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    margin: 0,
  } as CSSProperties,
  container: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    width: '100%',
    maxWidth: '550px',
    padding: '40px',
    margin: '0 auto',
  } as CSSProperties,
  logo: {
    textAlign: 'center' as const,
    marginBottom: '30px',
  } as CSSProperties,
  logoH1: {
    fontSize: '24px',
    color: '#667eea',
    marginBottom: '8px',
    margin: 0,
  } as CSSProperties,
  logoP: {
    color: '#666',
    fontSize: '14px',
    margin: 0,
  } as CSSProperties,
  formGroup: {
    marginBottom: '20px',
  } as CSSProperties,
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 500,
    color: '#333',
    fontSize: '14px',
  } as CSSProperties,
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  } as CSSProperties,
  fileInputLabel: {
    display: 'block',
    padding: '12px',
    border: '2px dashed #ddd',
    borderRadius: '6px',
    textAlign: 'center' as const,
    cursor: 'pointer',
  } as CSSProperties,
  fileName: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#666',
  } as CSSProperties,
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  } as CSSProperties,
  checkboxGroup: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '15px',
  } as CSSProperties,
  checkbox: {
    width: 'auto',
    marginRight: '10px',
    marginTop: '4px',
    cursor: 'pointer',
  } as CSSProperties,
  checkboxLabel: {
    marginBottom: 0,
    fontSize: '13px',
    lineHeight: '1.4',
    cursor: 'pointer',
  } as CSSProperties,
  rgpdSection: {
    background: '#f0f4ff',
    padding: '15px',
    borderRadius: '6px',
    margin: '20px 0',
    borderLeft: '4px solid #667eea',
  } as CSSProperties,
  rgpdH4: {
    color: '#667eea',
    fontSize: '14px',
    marginBottom: '12px',
    margin: 0,
  } as CSSProperties,
  button: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
  } as CSSProperties,
  alert: {
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '14px',
  } as CSSProperties,
  alertError: {
    background: '#fee',
    color: '#c33',
    border: '1px solid #fcc',
  } as CSSProperties,
  alertSuccess: {
    background: '#efe',
    color: '#3c3',
    border: '1px solid #cfc',
  } as CSSProperties,
  alertWarning: {
    background: '#fef3cd',
    color: '#664d03',
    border: '1px solid #ffecb5',
  } as CSSProperties,
  loading: {
    display: 'none' as const,
    textAlign: 'center' as const,
    color: '#667eea',
    fontSize: '14px',
  } as CSSProperties,
  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid #667eea',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginRight: '8px',
  } as CSSProperties,
  helpText: {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
  } as CSSProperties,
  required: {
    color: '#c33',
  } as CSSProperties,
} as const;

export default function InscriptionTransporteur() {
  useEffect(() => {
    const form = document.getElementById('inscriptionForm') as HTMLFormElement;
    const fileInput = document.getElementById('licence') as HTMLInputElement;
    const fileNameDiv = document.getElementById('fileName') as HTMLDivElement;
    const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
    const loading = document.getElementById('loading') as HTMLDivElement;
    const alerts = document.getElementById('alerts') as HTMLDivElement;

    const showAlert = (message: string, type: string) => {
      const alert = document.createElement('div');
      alert.className = `alert alert-${type}`;
      alert.textContent = message;
      alerts.innerHTML = '';
      alerts.appendChild(alert);
    };

    fileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
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
        fileNameDiv.textContent = `✓ ${file.name}`;
      }
    });

    document.getElementById('siren')?.addEventListener('blur', (e) => {
      const siren = (e.target as HTMLInputElement).value.replace(/\D/g, '');
      if (siren && (siren.length !== 10 && siren.length !== 14)) {
        showAlert('SIREN/SIRET invalide (10 ou 14 chiffres)', 'error');
      }
    });

    document.getElementById('dateExpiration')?.addEventListener('change', (e) => {
      const selected = new Date((e.target as HTMLInputElement).value);
      const today = new Date();
      if (selected < today) {
        showAlert('Date d\'expiration passée: votre licence doit être valide', 'warning');
      }
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const file = fileInput.files?.[0];
      if (!file) {
        showAlert('Veuillez uploader une licence', 'error');
        return;
      }

      const consentRGPD = (document.getElementById('consentRGPD') as HTMLInputElement).checked;
      if (!consentRGPD) {
        showAlert('Vous devez accepter la politique de confidentialité pour continuer', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('nom', (document.getElementById('nom') as HTMLInputElement).value);
      formData.append('telephone', (document.getElementById('telephone') as HTMLInputElement).value);
      formData.append('email', (document.getElementById('email') as HTMLInputElement).value);
      formData.append('siren', (document.getElementById('siren') as HTMLInputElement).value.replace(/\D/g, ''));
      formData.append('type', (document.getElementById('type') as HTMLSelectElement).value);
      formData.append('dateExpiration', (document.getElementById('dateExpiration') as HTMLInputElement).value);
      formData.append('licence', file);
      formData.append('consentRGPD', consentRGPD.toString());
      formData.append('consentNotifications', ((document.getElementById('consentNotifications') as HTMLInputElement).checked).toString());
      formData.append('consentMarketing', ((document.getElementById('consentMarketing') as HTMLInputElement).checked).toString());

      submitBtn.disabled = true;
      loading.style.display = 'block';
      alerts.innerHTML = '';

      try {
        const response = await fetch('/api/fn/transporteur-onboarding', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (response.ok) {
          showAlert(`✓ Inscrit avec succès! ID: ${data.id} · Vérifiez vos emails/SMS pour votre PIN.`, 'success');
          form.reset();
          fileNameDiv.textContent = '';
          setTimeout(() => window.location.href = '/', 3000);
        } else {
          showAlert(data.error || 'Erreur lors de l\'inscription', 'error');
        }
      } catch (err) {
        showAlert(`Erreur réseau: ${(err as Error).message}`, 'error');
      } finally {
        submitBtn.disabled = false;
        loading.style.display = 'none';
      }
    });
  }, []);

  return (
    <>
      <style>{`
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
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .file-input-label:hover {
          border-color: #667eea;
          background: rgba(102, 126, 234, 0.05);
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
        .checkbox-group a {
          color: #667eea;
          text-decoration: none;
        }
        .checkbox-group a:hover {
          text-decoration: underline;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.logo}>
          <h1 style={styles.logoH1}>MobiLoireConnect41</h1>
          <p style={styles.logoP}>Inscription Transporteur</p>
        </div>

        <div id="alerts"></div>

        <form id="inscriptionForm">
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="nom">Nom complet <span style={styles.required}>*</span></label>
            <input style={styles.input} type="text" id="nom" name="nom" required placeholder="Dupont Jean" />
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="telephone">Téléphone <span style={styles.required}>*</span></label>
              <input style={styles.input} type="tel" id="telephone" name="telephone" required placeholder="07 83 62 76 51" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="email">Email <span style={styles.required}>*</span></label>
              <input style={styles.input} type="email" id="email" name="email" required placeholder="vous@example.com" />
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="siren">SIREN/SIRET <span style={styles.required}>*</span></label>
              <input style={styles.input} type="text" id="siren" name="siren" required placeholder="12345678901234" maxLength={14} />
              <div style={styles.helpText}>10 (SIREN) ou 14 (SIRET) chiffres</div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="type">Type véhicule <span style={styles.required}>*</span></label>
              <select style={styles.input} id="type" name="type" required>
                <option value="">Choisir...</option>
                <option value="Taxi">Taxi</option>
                <option value="VTC">VTC</option>
                <option value="Ambulance">Ambulance/VSL</option>
              </select>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="licence">Licence de circulation (PDF/JPG/PNG) <span style={styles.required}>*</span></label>
            <label htmlFor="licence" style={styles.fileInputLabel} className="file-input-label">
              📄 Cliquez pour uploader votre licence
            </label>
            <input type="file" id="licence" name="licence" accept=".pdf,.jpg,.jpeg,.png" required />
            <div style={styles.fileName} id="fileName"></div>
            <div style={styles.helpText}>Max 5 MB · La licence délivrée par la préfecture suffit</div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="dateExpiration">Date d'expiration de la licence <span style={styles.required}>*</span></label>
            <input style={styles.input} type="date" id="dateExpiration" name="dateExpiration" required />
            <div style={styles.helpText}>Vos données seront conservées jusqu'à cette date</div>
          </div>

          <div style={styles.rgpdSection}>
            <h4 style={styles.rgpdH4}>🔒 Consentement et Protection des Données (RGPD)</h4>

            <div style={styles.checkboxGroup} className="checkbox-group">
              <input style={styles.checkbox} type="checkbox" id="consentRGPD" name="consentRGPD" required />
              <label style={styles.checkboxLabel} htmlFor="consentRGPD">
                J'accepte le traitement de mes données personnelles conformément à la
                <a href="/politique-confidentialite" target="_blank"> politique de confidentialité</a>
                <span style={styles.required}>*</span>
              </label>
            </div>

            <div style={styles.checkboxGroup} className="checkbox-group">
              <input style={styles.checkbox} type="checkbox" id="consentNotifications" name="consentNotifications" defaultChecked />
              <label style={styles.checkboxLabel} htmlFor="consentNotifications">
                J'accepte de recevoir un email et/ou SMS avec mon identifiant et code PIN
              </label>
            </div>

            <div style={styles.checkboxGroup} className="checkbox-group">
              <input style={styles.checkbox} type="checkbox" id="consentMarketing" name="consentMarketing" />
              <label style={styles.checkboxLabel} htmlFor="consentMarketing">
                J'accepte de recevoir des communications marketing et mises à jour (optionnel)
              </label>
            </div>

            <div style={styles.checkboxGroup} className="checkbox-group">
              <input style={styles.checkbox} type="checkbox" id="licenceValide" name="licenceValide" required />
              <label style={styles.checkboxLabel} htmlFor="licenceValide">
                Je confirme que ma licence est valide et accordée par la préfecture
                <span style={styles.required}>*</span>
              </label>
            </div>
          </div>

          <div style={{ ...styles.loading, display: 'none' }} id="loading" className="loading">
            <span style={styles.spinner} className="spinner"></span> Envoi en cours...
          </div>

          <button style={styles.button} type="submit" id="submitBtn">S'inscrire</button>
        </form>

        <p style={{ textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '20px' }}>
          ✓ Vous serez contacté sous 24h avec votre identifiant et code PIN.<br />
          ✓ Vos données sont protégés conformément au RGPD.
        </p>
      </div>
    </>
  );
}
