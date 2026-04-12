/* ============================================
   Firestore — Database client initialisation
   Replaces supabase.js. Uses existing Firebase
   app initialised by firebase-auth.js.
   ============================================ */

const FirestoreDB = (() => {
  let _db = null;

  const getDB = () => {
    if (!_db) {
      // Firebase app is already initialised by firebase-auth.js
      // (initializeApp is idempotent — safe to call again if needed)
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      _db = firebase.firestore();
    }
    return _db;
  };

  // Expose db directly for use in sync.js
  return {
    get db() { return getDB(); }
  };
})();

// Also expose as window.FirestoreDB for convenience
window.FirestoreDB = FirestoreDB;
