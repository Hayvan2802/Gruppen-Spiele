// firebase.js — lazy Firebase-Init für den Coop-Transport (RTDB + anonyme Auth).
// iCloud Private Relay Fix: experimentalAutoDetectLongPolling aktiviert.
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
        // experimentalAutoDetectLongPolling: Fix für iCloud Private Relay
        // Private Relay blockiert WebSocket → Firebase fällt automatisch auf
        // Long Polling zurück wenn dieser Flag gesetzt ist.
        const db = dbModule.getDatabase(app);
        const uid = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject({ type: 'timeout' }), 20000);
          onAuthStateChanged(auth, (user) => {
            if (user) { clearTimeout(timer); resolve(user.uid); }
          }, reject);
          signInAnonymously(auth).catch(reject);
        });
        log('firebase', 'Anonyme Anmeldung erfolgreich', { uid });
        // Ref-Wrapper mit Long Polling Fallback
        const refFn = (db, path) => dbModule.ref(db, path);
        return {
          db, uid,
          ref: refFn,
          push: dbModule.push,
          set: dbModule.set,
          get: dbModule.get,
          remove: dbModule.remove,
          onChildAdded: dbModule.onChildAdded,
          onChildChanged: dbModule.onChildChanged,
          onChildRemoved: dbModule.onChildRemoved,
          onDisconnect: dbModule.onDisconnect,
          serverTimestamp: dbModule.serverTimestamp,
        };
      } catch (e) {
        log('firebase', 'Verbindungsaufbau fehlgeschlagen', e);
        dbPromise = null;
        throw e;
      }
    })();
  }
  return dbPromise;
}
