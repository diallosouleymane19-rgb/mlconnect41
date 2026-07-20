import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const googleSheetId = process.env.GOOGLE_SHEET_ID!;
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!;

const slackWebhook = process.env.SLACK_WEBHOOK_URL || process.env.MAKE_WEBHOOK_SCENARIO_B;

// Email configuration (SendGrid or SMTP)
const mailTransporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// SMS via Twilio or Make.com webhook
const twilioAccount = process.env.TWILIO_ACCOUNT_SID;
const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
const smsMakeWebhook = process.env.MAKE_WEBHOOK_SMS; // Alternative: Make.com SMS scenario

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function findMaxTransporterId(): Promise<number> {
  const sheets = google.sheets({
    version: 'v4',
    auth: new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: serviceAccountEmail.split('@')[0],
        private_key_id: '',
        private_key: serviceAccountPrivateKey?.replace(/\\n/g, '\n'),
        client_email: serviceAccountEmail,
        client_id: '',
      } as any,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }),
  });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetId,
      range: 'Transporteurs!A:A',
    });

    const values = response.data.values || [];
    let maxNum = 0;

    values.forEach((row) => {
      if (row[0] && row[0].startsWith('T')) {
        const num = parseInt(row[0].substring(1));
        if (!isNaN(num)) maxNum = Math.max(maxNum, num);
      }
    });

    return maxNum;
  } catch (err) {
    console.error('Error reading Google Sheet:', err);
    return 0;
  }
}

async function addToGoogleSheet(
  id: string,
  nom: string,
  telephone: string,
  email: string,
  siren: string,
  type: string,
  pin: string,
  dateExpiration: string,
  consentRGPD: boolean,
  consentNotifications: boolean,
  consentMarketing: boolean
): Promise<boolean> {
  const sheets = google.sheets({
    version: 'v4',
    auth: new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: serviceAccountEmail.split('@')[0],
        private_key_id: '',
        private_key: serviceAccountPrivateKey?.replace(/\\n/g, '\n'),
        client_email: serviceAccountEmail,
        client_id: '',
      } as any,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }),
  });

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: googleSheetId,
      range: 'Transporteurs!A:R',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            id, // A: ID
            nom, // B: Nom
            type, // C: Type
            '', // D: Commune
            telephone, // E: Telephone
            email, // F: Email
            '', // G: Zone_couverte
            'Non', // H: Disponible (Non tant que licence non validée)
            '', // I: Photo_URL
            '', // J: Tarif_base_€
            '', // K: onesignal_player_id
            pin, // L: Code_PIN
            '', // M: stripe_account_id
            dateExpiration, // N: Date expiration licence
            consentRGPD ? 'oui' : 'non', // O: Consent RGPD
            consentNotifications ? 'oui' : 'non', // P: Consent Notifications
            consentMarketing ? 'oui' : 'non', // Q: Consent Marketing
            siren, // R: SIREN/SIRET
          ],
        ],
      },
    });
    return true;
  } catch (err) {
    console.error('Error adding to Google Sheet:', err);
    return false;
  }
}

async function sendSlackAlert(
  id: string,
  nom: string,
  type: string,
  email: string,
  dateExpiration: string
): Promise<void> {
  if (!slackWebhook) {
    console.warn('SLACK_WEBHOOK_URL not configured');
    return;
  }

  const message = {
    text: `🚕 *Nouveau transporteur en attente de validation*\n*${nom}* (${type})\n*ID:* ${id}\n*Email:* ${email}\n*Licence expire:* ${dateExpiration}\n*Action:* Vérifier la licence et changer le Statut en "approuvé" dans la Google Sheet`,
  };

  try {
    await fetch(slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.error('Error sending Slack alert:', err);
  }
}

async function sendEmailNotification(
  email: string,
  nom: string,
  id: string,
  pin: string
): Promise<boolean> {
  try {
    await mailTransporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@mobiloireconnect41.fr',
      to: email,
      subject: `✓ Bienvenue ${nom} — MobiLoireConnect41`,
      html: `
        <h2>Bienvenue ${nom}!</h2>
        <p>Votre inscription a été reçue. Voici vos identifiants:</p>
        <div style="background: #f0f4ff; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p><strong>ID Transporteur:</strong> <code style="font-size: 18px; letter-spacing: 2px;">${id}</code></p>
          <p><strong>Code PIN:</strong> <code style="font-size: 18px; letter-spacing: 2px;">${pin}</code></p>
        </div>
        <h3>Prochaines étapes:</h3>
        <ol>
          <li>Accédez à <a href="https://mlconnect41.vercel.app/transporteur">MobiLoireConnect41</a></li>
          <li>Connectez-vous avec votre ID et Code PIN</li>
          <li>Activez les notifications push</li>
          <li>Acceptez les courses disponibles!</li>
        </ol>
        <h3>⚠️ Statut actuel: EN ATTENTE</h3>
        <p>Un administrateur vérifiera votre licence dans les 24h. Vous recevrez une confirmation par email une fois approuvé.</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          Questions? Contactez <a href="mailto:contact@smdconsulting.pro">contact@smdconsulting.pro</a><br>
          <a href="https://mlconnect41.vercel.app/politique-confidentialite">Politique de confidentialité</a>
        </p>
      `,
    });
    return true;
  } catch (err) {
    console.error('Error sending email:', err);
    return false;
  }
}

async function sendSmsNotification(telephone: string, id: string, pin: string): Promise<boolean> {
  // Option 1: Twilio
  if (twilioAccount && twilioAuth && twilioFrom) {
    try {
      const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + twilioAccount + '/Messages.json', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${twilioAccount}:${twilioAuth}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: twilioFrom,
          To: telephone,
          Body: `MobiLoireConnect41: Bienvenue! ID: ${id} | PIN: ${pin}. Accédez à https://mlconnect41.vercel.app/transporteur`,
        }).toString(),
      });

      if (response.ok) {
        return true;
      }
    } catch (err) {
      console.error('Twilio SMS error:', err);
    }
  }

  // Option 2: Make.com SMS scenario webhook
  if (smsMakeWebhook) {
    try {
      await fetch(smsMakeWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telephone,
          message: `MobiLoireConnect41: Bienvenue! ID: ${id} | PIN: ${pin}. Accédez à https://mlconnect41.vercel.app/transporteur`,
        }),
      });
      return true;
    } catch (err) {
      console.error('Make.com SMS error:', err);
    }
  }

  console.warn('SMS gateway not configured (Twilio or Make.com webhook)');
  return false;
}

async function uploadLicence(file: File, transporteurId: string): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const fileName = `${transporteurId}_${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from('licences')
      .upload(`transporteurs/${fileName}`, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Storage error:', error);
      return null;
    }

    return `${supabaseUrl}/storage/v1/object/public/licences/${data.path}`;
  } catch (err) {
    console.error('Error uploading licence:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const nom = formData.get('nom') as string;
    const telephone = formData.get('telephone') as string;
    const email = formData.get('email') as string;
    const siren = formData.get('siren') as string;
    const type = formData.get('type') as string;
    const dateExpiration = formData.get('dateExpiration') as string;
    const licenceFile = formData.get('licence') as File;
    const consentRGPD = formData.get('consentRGPD') === 'true';
    const consentNotifications = formData.get('consentNotifications') === 'true';
    const consentMarketing = formData.get('consentMarketing') === 'true';

    // Validation
    if (!nom || !telephone || !email || !siren || !type || !dateExpiration || !licenceFile) {
      return NextResponse.json(
        { error: 'Tous les champs sont obligatoires' },
        { status: 400 }
      );
    }

    if (!consentRGPD) {
      return NextResponse.json(
        { error: 'Vous devez accepter la politique de confidentialité' },
        { status: 400 }
      );
    }

    if (siren.length !== 10 && siren.length !== 14) {
      return NextResponse.json(
        { error: 'SIREN/SIRET doit faire 10 ou 14 chiffres' },
        { status: 400 }
      );
    }

    if (!['Taxi', 'VTC', 'Ambulance'].includes(type)) {
      return NextResponse.json(
        { error: 'Type véhicule invalide' },
        { status: 400 }
      );
    }

    const validMimes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!validMimes.includes(licenceFile.type)) {
      return NextResponse.json(
        { error: 'Format licence invalide (PDF, JPG ou PNG)' },
        { status: 400 }
      );
    }

    // Check for duplicates
    const sheets = google.sheets({
      version: 'v4',
      auth: new google.auth.GoogleAuth({
        credentials: {
          type: 'service_account',
          project_id: serviceAccountEmail.split('@')[0],
          private_key_id: '',
          private_key: serviceAccountPrivateKey?.replace(/\\n/g, '\n'),
          client_email: serviceAccountEmail,
          client_id: '',
        } as any,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      }),
    });

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetId,
      range: 'Transporteurs!A:R',
    });

    const rows = sheetData.data.values || [];
    const normPhone = (t: string) => (t || '').replace(/\D/g, '');
    for (const row of rows) {
      // E (index 4) = Telephone, F (index 5) = Email, R (index 17) = SIREN
      if (
        (row[5] && row[5].toLowerCase() === email.toLowerCase()) ||
        (row[4] && normPhone(row[4]) === normPhone(telephone)) ||
        (row[17] && row[17] === siren)
      ) {
        return NextResponse.json(
          { error: 'Email, téléphone ou SIREN déjà enregistré' },
          { status: 400 }
        );
      }
    }

    // Generate ID
    const maxNum = await findMaxTransporterId();
    const newNum = maxNum + 1;
    if (newNum > 999) {
      return NextResponse.json(
        { error: 'Limite de transporteurs atteinte (999)' },
        { status: 500 }
      );
    }
    const transporteurId = `T${newNum.toString().padStart(3, '0')}`;

    // Generate PIN
    const pin = generatePin();

    // Upload licence
    const licenceUrl = await uploadLicence(licenceFile, transporteurId);

    // Add to Google Sheet
    const sheetSuccess = await addToGoogleSheet(
      transporteurId,
      nom,
      telephone,
      email,
      siren,
      type,
      pin,
      dateExpiration,
      consentRGPD,
      consentNotifications,
      consentMarketing
    );

    if (!sheetSuccess) {
      return NextResponse.json(
        { error: 'Erreur lors de l\'enregistrement' },
        { status: 500 }
      );
    }

    // Create in Supabase with RGPD consent logging
    const { error: dbError } = await supabase.from('transporteurs_pending').insert({
      id: transporteurId,
      nom,
      email,
      telephone,
      siren_siret: siren,
      type_vehicule: type,
      licence_url: licenceUrl,
      date_expiration_licence: dateExpiration,
      consent_rgpd: consentRGPD,
      consent_notifications: consentNotifications,
      consent_marketing: consentMarketing,
      consent_date: new Date().toISOString(),
      statut: 'pending',
    });

    if (dbError) {
      console.error('Database error:', dbError);
    }

    // Send notifications (email + SMS)
    const emailSent = await sendEmailNotification(email, nom, transporteurId, pin);
    const smsSent = await sendSmsNotification(telephone, transporteurId, pin);

    // Send Slack alert
    await sendSlackAlert(transporteurId, nom, type, email, dateExpiration);

    return NextResponse.json({
      success: true,
      id: transporteurId,
      message: `Bienvenue ${nom}! Vérifiez vos emails et SMS pour votre PIN. Validation sous 24h.`,
      notifications: {
        email: emailSent,
        sms: smsSent,
      },
    });
  } catch (err) {
    console.error('Error in transporteur-onboarding:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'inscription', detail },
      { status: 500 }
    );
  }
}
