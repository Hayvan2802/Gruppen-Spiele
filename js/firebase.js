// firebase.js — lazy Firebase-Init für den Coop-Transport (RTDB + anonyme Auth).
// _app wird module-weit gespeichert, damit initializeApp() bei Retry nicht erneut
// aufgerufen wird ("app already exists"-Fehler verhindert).
//
// HINWEIS ZUM API-KEY: Firebase Web-API-Keys sind kein Secret und dürfen im
// Client-Code stehen — das ist von Firebase/Google so vorgesehen und dokumentiert.
// Sicherheit wird durch RTDB-Security-Rules (auth != null erforderlich) +
// anonyme Auth + Domain-Einschränkung des Keys in der Google Cloud Console
// gewährleistet, nicht durch Geheimhaltung des Keys. Daher kein .env nötig.
// Siehe: https://firebase.google.com/docs/projects/api-keys
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
let _app = null;

export function ensureFirebase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const [appModule, { getAuth, signInAnonymously, onAuthStateChanged }, dbModule] = await Promise.all([
          import('./vendor/firebase/firebase-app.js'),
          import('./vendor/firebase/firebase-auth.js'),
          import('./vendor/firebase/firebase-database.js'),
        ]);
        if (!_app) {
          _app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
        }
        const auth = getAuth(_app);
        const db = dbModule.getDatabase(_app);
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
