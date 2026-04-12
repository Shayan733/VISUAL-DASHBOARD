/* ============================================
   Supabase — Initialize Supabase client
   ============================================ */

const SupabaseModule = (() => {
  // Load Supabase from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = () => {
    if (window.supabase && CONFIG) {
      const { createClient } = window.supabase;
      window.SupabaseClient = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
      console.log('✓ Supabase client initialized');
    }
  };
  script.onerror = () => {
    console.error('Failed to load Supabase');
  };
  document.head.appendChild(script);

  return {};
})();
