// Supabase client is not needed here; we manage auth tokens in memory and via server endpoints

export async function attachAuthHeaders(init?: RequestInit) {
  const headers: any = init && init.headers ? { ...(init.headers as any) } : {};
  
  try {
    // First, try to get the access token from the in-memory cache (window.fitbuddyai_access_token)
    // set by App.tsx during startup hydration or after sign-in
    if (typeof window !== 'undefined') {
      const token = (window as any).fitbuddyai_access_token;
      const expiresAt = (window as any).fitbuddyai_token_expires;
      
      if (token && expiresAt && Date.now() < expiresAt) {
        headers['Authorization'] = `Bearer ${token}`;
        return { ...(init || {}), headers } as RequestInit;
      }
      
      // Token is expired or missing. Try to refresh it from the server.
      if (typeof window !== 'undefined') {
        try {
          const refreshRes = await fetch('/api/auth?action=refresh', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (refreshRes.ok) {
            const { access_token } = await refreshRes.json();
            if (access_token) {
              (window as any).fitbuddyai_access_token = access_token;
              (window as any).fitbuddyai_token_expires = Date.now() + 3600000; // 1 hour
              headers['Authorization'] = `Bearer ${access_token}`;
              return { ...(init || {}), headers } as RequestInit;
            }
          }
        } catch (e) {
          console.warn('[attachAuthHeaders] Failed to refresh token from server', e);
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // Fallback: if no token available, return headers without auth
  // The API will return 401 if auth is required
  return { ...(init || {}), headers } as RequestInit;
}

export default attachAuthHeaders;
