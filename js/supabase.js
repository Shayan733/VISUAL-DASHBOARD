/* ============================================
   Supabase — Initialize Supabase client
   ============================================ */

const SupabaseModule = (() => {
  // Get config from CONFIG object (from config.js) or environment variables
  const getConfig = () => {
    // Check if CONFIG is defined (from config.js)
    if (typeof CONFIG !== 'undefined' && CONFIG.supabaseUrl && CONFIG.supabaseKey) {
      return CONFIG;
    }

    // Check window environment variables (Netlify sets these)
    if (window.__ENV && window.__ENV.SUPABASE_URL && window.__ENV.SUPABASE_KEY) {
      return {
        supabaseUrl: window.__ENV.SUPABASE_URL,
        supabaseKey: window.__ENV.SUPABASE_KEY
      };
    }

    // Fallback for development
    console.warn('⚠ Supabase credentials not found. Set CONFIG in config.js or environment variables.');
    return null;
  };

  // Load Supabase from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = () => {
    const config = getConfig();
    if (window.supabase && config) {
      const { createClient } = window.supabase;
      window.SupabaseClient = createClient(config.supabaseUrl, config.supabaseKey);
      console.log('✓ Supabase client initialized');
    } else if (!config) {
      console.error('❌ Supabase configuration missing');
    }
  };
  script.onerror = () => {
    console.error('Failed to load Supabase library');
  };
  document.head.appendChild(script);

  return {};
})();
