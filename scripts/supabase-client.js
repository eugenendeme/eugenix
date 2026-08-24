let browserClient;

function isAllowedSupabaseUrl(value) {
  try {
    const url = new URL(value);
    const localHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    return (url.protocol === "https:" && url.hostname.endsWith(".supabase.co")) || (url.protocol === "http:" && localHost);
  } catch {
    return false;
  }
}

export function isSupabaseConfigured() {
  const config = window.EUGENIX_PUBLIC_CONFIG || {};
  return (
    isAllowedSupabaseUrl(config.supabaseUrl) &&
    typeof config.supabasePublishableKey === "string" &&
    config.supabasePublishableKey.length > 20 &&
    !config.supabasePublishableKey.includes("placeholder")
  );
}

export function getSupabaseClient() {
  if (browserClient) return browserClient;
  if (!isSupabaseConfigured()) return null;
  if (!window.supabase || typeof window.supabase.createClient !== "function") return null;

  const { supabaseUrl, supabasePublishableKey } = window.EUGENIX_PUBLIC_CONFIG;
  browserClient = window.supabase.createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true,
    },
  });
  return browserClient;
}
