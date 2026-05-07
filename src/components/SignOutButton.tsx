import React from 'react';
import { supabase } from '../services/supabaseClient';
import './SignOutButton.css';

const SignOutButton: React.FC = () => {
  const handleSignOut = async () => {
    console.log('[SignOutButton] Sign out initiated');
    
    // First, tell Supabase to revoke the current session (this signs out the Supabase user)
    try {
      console.log('[SignOutButton] Calling supabase.auth.signOut()...');
      await supabase.auth.signOut();
      console.log('[SignOutButton] Supabase session revoked');
    } catch (e) {
      console.warn('[SignOutButton] supabase.auth.signOut() failed', e);
    }
    
    // Clear in-memory access token
    if (typeof window !== 'undefined') {
      (window as any).fitbuddyai_access_token = null;
      (window as any).fitbuddyai_token_expires = null;
    }
    
    // Then, revoke our server-side refresh token with explicit credentials
    try {
      console.log('[SignOutButton] Calling clear_refresh endpoint...');
      const clearRes = await Promise.race([
        fetch('/api/auth?action=clear_refresh', { 
          method: 'POST', 
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]) as Response;
      
      console.log('[SignOutButton] clear_refresh responded:', clearRes.status);
      
      if (!clearRes.ok) {
        console.warn('[SignOutButton] clear_refresh returned non-ok status', clearRes.status);
      }
    } catch (e) {
      console.warn('[SignOutButton] clear_refresh failed (continuing anyway)', e);
    }

    // Small delay to ensure all revocation requests are processed
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('[SignOutButton] Clearing all storage...');
    // Clear all client storage
    try { sessionStorage.clear(); } catch {}
    try { localStorage.clear(); } catch {}
    
    console.log('[SignOutButton] Dispatching logout event...');
    // Dispatch logout event
    try { window.dispatchEvent(new Event('fitbuddyai-logout')); } catch {}
    
    console.log('[SignOutButton] Reloading page...');
    // Reload page
    try { window.location.reload(); } catch { window.location.href = '/'; }
  };
  
  return (
    <button className="btn signout-btn" onClick={handleSignOut}>
      Sign Out
    </button>
  );
};

export default SignOutButton;
