const admin = require('firebase-admin');
const serviceAccount = require('./firebaseServiceAccount.json'); // Path to your key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = { db };
