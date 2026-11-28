/* LOVE RECORD Firebase public web config.
 * This is the public client configuration for the LOVE RECORD Web App.
 * Protect user data with Firebase Authentication + Firestore Security Rules.
 * Never put service-account private keys or AI API keys in this file.
 */
self.LR_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAEVciNtzl2hEN_7fTaBVBpW0_jUqrCu3o',
  authDomain: 'love-record-0928.firebaseapp.com',
  projectId: 'love-record-0928',
  storageBucket: 'love-record-0928.firebasestorage.app',
  messagingSenderId: '300840565833',
  appId: '1:300840565833:web:3fff7df6cc4cf6fc10d398'
};

// Generate a Web Push public VAPID key in Firebase Console → Project settings
// → Cloud Messaging → Web Push certificates. Leave blank until configured.
self.LR_FIREBASE_VAPID_KEY = '';
self.LR_FIREBASE_FUNCTIONS_REGION = 'asia-southeast1';
