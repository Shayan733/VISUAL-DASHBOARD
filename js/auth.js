/* ============================================
   Auth — Google OAuth + magic link authentication
   ============================================ */

const Auth = (() => {
  const hideAuthModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
  };

  const showAuthModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
  };

  const googleLogin = async () => {
    if (!window.SupabaseClient) {
      showToast('Supabase not ready yet. Try again in a moment.', 'error');
      return;
    }
    try {
      const { data, error } = await SupabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) {
        showToast('Login failed: ' + error.message, 'error');
      }
    } catch (e) {
      showToast('Login error: ' + e.message, 'error');
    }
  };

  const magicLinkLogin = async (email) => {
    if (!window.SupabaseClient) {
      showToast('Supabase not ready yet. Try again in a moment.', 'error');
      return;
    }
    if (!email || !email.includes('@')) {
      showToast('Please enter a valid email', 'error');
      return;
    }
    try {
      const { error } = await SupabaseClient.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) {
        showToast('Failed to send link: ' + error.message, 'error');
      } else {
        showToast('Check your email for login link', 'success');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const logout = async () => {
    if (!window.SupabaseClient) return;
    try {
      await SupabaseClient.auth.signOut();
      window.location.reload();
    } catch (e) {
      console.error('Logout error:', e);
      window.location.reload();
    }
  };

  const getUser = async () => {
    if (!window.SupabaseClient) return null;
    try {
      const { data: { user } } = await SupabaseClient.auth.getUser();
      return user;
    } catch (e) {
      console.error('Get user error:', e);
      return null;
    }
  };

  const init = async () => {
    // Wait for Supabase to load
    let retries = 0;
    while (!window.SupabaseClient && retries < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!window.SupabaseClient) {
      showToast('Failed to initialize Supabase', 'error');
      return;
    }

    try {
      // Handle email confirmation redirect from Supabase
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        // Extract tokens from hash
        const params = new URLSearchParams(hash.replace('#', ''));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          // Set the session with tokens from email link
          await SupabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          // Clear the hash to clean up URL
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      // Check for error in URL (otp_expired, etc)
      if (hash && hash.includes('error=')) {
        const errorParams = new URLSearchParams(hash.replace('#', ''));
        const error = errorParams.get('error_description');
        if (error) {
          showToast('Login error: ' + error, 'error');
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      const { data: { session } } = await SupabaseClient.auth.getSession();
      if (!session) {
        showAuthModal();
      } else {
        State.user = session.user;
        await Sync.loadMostRecentCanvas();
        hideAuthModal();
      }
    } catch (e) {
      console.error('Auth init error:', e);
      showAuthModal();
    }
  };

  return { init, googleLogin, magicLinkLogin, logout, getUser, showAuthModal, hideAuthModal };
})();
