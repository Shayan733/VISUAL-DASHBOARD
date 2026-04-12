/* ============================================
   FirebaseAuth — Authentication via Firebase
   Replaces Supabase auth. Supabase is DB only.
   ============================================ */

const FirebaseAuth = (() => {
  let _auth = null;

  // Initialize Firebase app + auth (idempotent)
  const getAuth = () => {
    if (!_auth) {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      _auth = firebase.auth();
    }
    return _auth;
  };

  // Normalize Firebase user → shape sync.js expects (State.user.id)
  const normalizeUser = (firebaseUser) => ({
    id: firebaseUser.uid,       // sync.js uses State.user.id
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL
  });

  const showAuthModal = () => {
    const el = document.getElementById('auth-modal');
    if (el) el.style.display = 'flex';
  };

  const hideAuthModal = () => {
    const el = document.getElementById('auth-modal');
    if (el) el.style.display = 'none';
  };

  // Google Sign-In via popup
  const googleLogin = async () => {
    try {
      const auth = getAuth();
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      // Reload so app.init() runs with authenticated user
      window.location.reload();
    } catch (err) {
      console.error('Google sign-in failed:', err);
      if (window.showToast) showToast('Google sign-in failed: ' + err.message, 'error');
    }
  };

  // Magic link (email link sign-in)
  const magicLinkLogin = async (email) => {
    if (!email || !email.includes('@')) {
      if (window.showToast) showToast('Enter a valid email address', 'error');
      return;
    }
    try {
      const auth = getAuth();
      const actionCodeSettings = {
        url: window.location.origin + window.location.pathname,
        handleCodeInApp: true
      };
      await auth.sendSignInLinkToEmail(email, actionCodeSettings);
      // Save email so we can complete sign-in when user clicks the link
      localStorage.setItem('vd_emailForSignIn', email);
      if (window.showToast) showToast('Check your email for the sign-in link', 'success');
    } catch (err) {
      console.error('Magic link failed:', err);
      if (window.showToast) showToast('Failed to send link: ' + err.message, 'error');
    }
  };

  const logout = async () => {
    try {
      await getAuth().signOut();
      window.location.reload();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const getUser = () => getAuth().currentUser;

  // Called by app.js on startup. Returns the Firebase user or null.
  const init = async () => {
    const auth = getAuth();

    // Complete email link sign-in if URL contains Firebase link params
    if (auth.isSignInWithEmailLink(window.location.href)) {
      let email = localStorage.getItem('vd_emailForSignIn') ||
        window.prompt('Enter your email to complete sign-in:');
      if (email) {
        try {
          await auth.signInWithEmailLink(email, window.location.href);
          localStorage.removeItem('vd_emailForSignIn');
          // Clean up Firebase params from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          console.error('Email link sign-in error:', err);
          if (window.showToast) showToast('Sign-in link is invalid or expired', 'error');
        }
      }
    }

    // Resolve current auth state (fires once immediately)
    const firebaseUser = await new Promise((resolve) => {
      const unsub = auth.onAuthStateChanged((user) => {
        unsub();
        resolve(user);
      });
    });

    if (firebaseUser) {
      State.user = normalizeUser(firebaseUser);
      hideAuthModal();
      // Canvas loading is handled by app.js after all modules are initialised
    } else {
      showAuthModal();
    }

    return firebaseUser;
  };

  return { init, googleLogin, magicLinkLogin, logout, getUser, showAuthModal, hideAuthModal };
})();
