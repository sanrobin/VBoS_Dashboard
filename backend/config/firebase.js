const admin = require('firebase-admin');

const getFirebaseApp = () => {
  if (admin.apps.length) {
    return admin.apps[0];
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!clientEmail || !privateKey || !projectId || !databaseURL) {
    throw new Error('Firebase service account environment variables are required');
  }

  const serviceAccount = {
    type: 'service_account',
    project_id: projectId,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
    private_key: privateKey.replace(/\\n/g, '\n'),
    client_email: clientEmail,
    client_id: process.env.FIREBASE_CLIENT_ID || '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL || ''
  };

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL
  });
};

const getFirebaseDatabase = () => {
  const app = getFirebaseApp();
  return app.database();
};

module.exports = getFirebaseDatabase;
