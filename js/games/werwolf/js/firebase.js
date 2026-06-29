// firebase.js — lazy Firebase-Init für den Coop-Transport (RTDB + anonyme Auth).
// Wird nie statisch importiert (siehe coop.js) — Solo-Spieler laden Firebase nie.
//
// Diese Werte sind öffentlich/committbar (kein Secret): die Absicherung läuft
// über die RTDB-Security-Rules + Anonymous Auth.
import { log } from './debuglog.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC-ke51RMgKFsxrHojetq3Cz2QK7O6UAkc',
  authDomain: 'gruppen-spiele.firebaseapp.com',
  databaseURL: 'https://gruppen-spiele-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'gruppen-spiele',
  storageBucket: 'gruppen-spiele.firebasestorage.app',
  messagingSenderId: '92280391521',
  appId: '1:92280391521:web:58ba3606053bafcf7d6720',
};

let dbPromise = null;

export function ensureFirebase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const [{ initializeApp }, { getAuth, signInAnonymously, onAuthStateChanged }, dbModule] = await Promise.all([
          import('./vendor/firebase/firebase-app.js'),
          import('./vendor/firebase/firebase-auth.js'),
          import('./vendor/firebase/firebase-database.js'),
        ]);
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = dbModule.getDatabase(app);
        const uid = await new Promise((resolve, reject) => {
          onAuthStateChanged(auth, (user) => { if (user) resolve(user.uid); }, reject);
          signInAnonymously(auth).catch(reject);
        });
        log('firebase', 'Anonyme Anmeldung erfolgreich', { uid });
        return { db, uid, ...dbModule };
      } catch (e) {
        log('firebase', 'Verbindungsaufbau fehlgeschlagen', e);
        dbPromise = null;
        throw e;
      }
    })();
  }
  return dbPromise;
}
