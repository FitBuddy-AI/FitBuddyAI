// Buy a shop item and update user on server and localStorage
import attachAuthHeaders from './apiAuth';
import { supabase } from './supabaseClient';
import { saveUserData, clearAuthToken, loadUserData, clearUserData } from './localStorage';
import { ensureUserId } from '../utils/userHelpers';

const DEFAULT_ENERGY = 10000;
const PASSWORD_SPECIAL_CHARACTERS = "!@#$%^&*()_+-=[]{};':\"|<>?,./`~";
const PASSWORD_POLICY_ERROR = 'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};\':"|<>?,./`~.';

export function getPasswordPolicyError(password: string): string | null {
  const value = String(password || '');
  if (!/[a-z]/.test(value)) return PASSWORD_POLICY_ERROR;
  if (!/[A-Z]/.test(value)) return PASSWORD_POLICY_ERROR;
  if (!/[0-9]/.test(value)) return PASSWORD_POLICY_ERROR;
  if (!Array.from(value).some((char) => PASSWORD_SPECIAL_CHARACTERS.includes(char))) return PASSWORD_POLICY_ERROR;
  return null;
}

export async function buyShopItem(id: string, item: any): Promise<User | null> {
  try {
    // Send a minimal, safe payload (avoid sending React elements or functions)
    const safeItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      type: item.type,
      quantity: item.quantity ?? null,
      image: item.image || null,
      description: item.description || ''
    };

    const reqInit = await attachAuthHeaders({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, item: safeItem })
    });
    const purchaseUrlCandidates = ['/api/user/buy', `/api/user/${encodeURIComponent(id)}?action=buy`];
    let lastError: any = null;

    for (const purchaseUrl of purchaseUrlCandidates) {
      const res = await fetch(purchaseUrl, reqInit);
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          try { saveUserData({ data: data.user }); } catch {}
          return data.user;
        }
        return null;
      }

      // Attempt to read structured error code from server
      try {
        const err = await res.json();
        lastError = err;
        console.warn('[buyShopItem] server error', err.code || err.message || res.status, 'via', purchaseUrl);
        if (res.status !== 404) break;
      } catch {
        lastError = { status: res.status };
        console.warn('[buyShopItem] server error status', res.status, 'via', purchaseUrl);
        if (res.status !== 404) break;
      }
    }

    if (lastError) return null;
    return null;
  } catch {
    return null;
  }
}
// Fetch user from server by ID and update localStorage
export async function fetchUserById(id: string): Promise<User | null> {
  try {
    const res = await fetch(`/api/user/${id}`);
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        const normalized = ensureUserId(data.user);
        try { saveUserData({ data: normalized }); } catch {}
        return normalized as User;
      }
    }
    const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('fitbuddyai_userdata').select('*').eq('user_id', id).limit(1).maybeSingle();
        if (error || !data) return null;
        const normalized = ensureUserId(data);
        try { saveUserData({ data: normalized }); } catch {}
        return normalized as User;
      } catch {
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}
// src/services/authService.ts
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  streak?: number;
  points?: number;
  energy?: number;
  inventory?: any[];
  workouts?: any[];
}

// imports moved to top

export async function signIn(email: string, password: string): Promise<User> {
  const normalizedEmail = String(email).trim().toLowerCase();
  const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
  if (useSupabase) {
    const result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    // Supabase may return error with status 400 and message indicating "User is not confirmed" or similar.
    if (result.error || !result.data?.session) {
      const msg = result.error?.message || 'Sign in failed';
      // Detect common unconfirmed email message and throw a specific code
      if (/confirm|verify|not.*confirmed|email.*confirm/i.test(msg || '')) {
        const e: any = new Error('Email not confirmed');
        e.code = 'ERR_EMAIL_UNCONFIRMED';
        throw e;
      }
      throw new Error(msg);
    }
    // Session data (token is kept in memory only, not in storage)
    const session = result.data.session;
    const user = result.data.user as any;
    // Determine username: prefer user_metadata.username, else fallback to email temporarily
    let usernameVal = (user.user_metadata && user.user_metadata.username) || null;
    let avatarVal = (user.user_metadata && (user.user_metadata.avatar || user.user_metadata.avatar_url)) || null;
    let energyVal = (user.user_metadata && user.user_metadata.energy) ?? DEFAULT_ENERGY;
    try {
      // Rehydrate the persisted profile row so avatar/energy survive logout and login.
      const profile = await fetchUserById(user.id);
      if (profile && profile.username) usernameVal = profile.username;
      if (profile && (profile.avatar || (profile as any).avatar_url)) avatarVal = profile.avatar || (profile as any).avatar_url;
      if (profile && typeof profile.energy === 'number') energyVal = profile.energy;
    } catch (e) {
      // ignore; we'll fallback to auth metadata
    }
    try {
      await fetch('/api/auth?action=store_refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user.id, refresh_token: session?.refresh_token })
      });
    } catch (e) {
      console.warn('[authService] failed to store refresh token server-side', e);
    }
    const toSave = { data: { id: user.id, email: user.email, username: usernameVal || user.email, avatar: avatarVal || '/images/fitbuddy_head.png', energy: energyVal } };
  // Clear any cross-tab 'no auto restore' guard set during sign-out so sign-in can persist data
  try { sessionStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
  try { localStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
  // Save user profile data only (not the token) to localStorage
  // The access token is kept in memory in App.tsx state or via server-side refresh
  try { saveUserData({ data: toSave.data }, { skipBackup: true }); } catch { /* ignore */ }
  // DO NOT store the access token in sessionStorage — it's a security risk

    // Ensure Supabase user metadata includes a display name / username for this user.
    try {
      const displayName = toSave.data.username;
      if (displayName) {
        // Update the authenticated user's metadata with display name and username
        // supabase.auth.updateUser sets user metadata for the current session
        await supabase.auth.updateUser({ data: { display_name: displayName, username: displayName, avatar: toSave.data.avatar } });
      }
    } catch (e: any) {
      // Non-fatal: just log and continue
      console.warn('[authService] failed to update supabase user metadata', (e && (e as any).message) || String(e));
    }
    return toSave.data as User;
  }
  const res = await fetch('/api/auth?action=signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, password })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Sign in failed');
  }
  const data = await res.json();
  if (data.user) {
    // Persist unified user_data with optional token so attachAuthHeaders can find it
    const nextEnergy = data.user.energy ?? DEFAULT_ENERGY;
    const nextUser = { ...data.user, energy: nextEnergy };
    const toSave = { data: nextUser, token: data.token ?? null };
    try { saveUserData(toSave, { skipBackup: true }); } catch { /* ignore */ }
  }
  return { ...data.user, energy: data.user.energy ?? DEFAULT_ENERGY };
}

export async function signUp(email: string, username: string, password: string): Promise<User> {
  const normalizedEmail = String(email).trim().toLowerCase();
  const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
  if (useSupabase) {
    const passwordPolicyError = getPasswordPolicyError(password);
    if (passwordPolicyError) {
      throw new Error(passwordPolicyError);
    }
    const result = await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { username, energy: DEFAULT_ENERGY } } });
    if (result.error) throw new Error(result.error.message || 'Sign up failed');
    // Supabase may not return a session depending on config; if a session exists save token
    const session = result.data?.session ?? null;
    const token = session?.access_token ?? null;
    const user = result.data?.user ?? null;
  const toSave = user ? { id: user.id, email: user.email, username, energy: DEFAULT_ENERGY } : null;
  // Only persist client-side if we actually received a session/token. For email-verify flows
  // Supabase may require the user to confirm via email before signing in; do not mark them
  // as signed-in (or persist their profile) until a token exists.
    try {
      if (user && session?.refresh_token) {
        await fetch('/api/auth?action=store_refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId: user.id, refresh_token: session.refresh_token })
        });
      }
    } catch (e) {
      console.warn('[authService] failed to store refresh token server-side', e);
    }
  if (token && toSave) {
    try { sessionStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
    try { localStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
    try { saveUserData({ data: toSave, token }, { skipBackup: true }); } catch { /* ignore */ }
  }
    // Ensure server-side app_users and user_data rows exist for this new Supabase user (best-effort).
    try {
      if (user && user.id) {
        await fetch('/api/auth?action=create_profile', await attachAuthHeaders({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            username
          })
        }));
      }
    } catch (e) {
      console.warn('[authService] create_profile call failed', e);
    }

    return toSave as unknown as User;
  }
  const res = await fetch('/api/auth?action=signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, username, password })
  });
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch {}
    const err = new Error((data && data.message) || 'Sign up failed');
    // Attach structured code if present
    if (data && data.code) (err as any).code = data.code;
    throw err;
  }
  const data = await res.json();
  if (data.user) {
  // Persist signup user data only (not the token)
  // Access tokens are kept in memory or via server-side refresh
  const toSave = { data: data.user };
  try { saveUserData(toSave, { skipBackup: true }); } catch { /* ignore */ }
  }
  return data.user;
}

// Initiate Google OAuth sign-in (client-side). When running against Supabase this will
// redirect the browser to Google's OAuth consent screen and back to the app. For
// non-Supabase local server mode this function currently throws to indicate it's
// unsupported.
export async function signInWithGoogle(): Promise<void> {
  const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
  if (useSupabase) {
    try {
      // Always redirect to /signin so callback handling is deterministic on every route.
      const envPublic = (import.meta.env.VITE_PUBLIC_APP_URL && String(import.meta.env.VITE_PUBLIC_APP_URL).trim()) || '';
      const baseUrl = (envPublic && envPublic !== 'PUT_YOUR_PUBLIC_APP_URL_HERE')
        ? envPublic.replace(/\/$/, '')
        : window.location.origin;
      const redirectTo = `${baseUrl}/signin`;
      console.log('[authService] initiating Google sign-in, redirectTo=', redirectTo);

      // Generate PKCE code_verifier and code_challenge and store verifier in sessionStorage
      const generateVerifier = (len = 128) => {
        const array = new Uint8Array(len);
        crypto.getRandomValues(array);
        // Base64-url encode
        const str = Array.from(array).map(b => String.fromCharCode(b)).join('');
        const base64 = btoa(str);
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };

      const sha256 = async (s: string) => {
        const enc = new TextEncoder();
        const data = enc.encode(s);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const bytes = new Uint8Array(hash);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };

      const codeVerifier = generateVerifier(64);
      const codeChallenge = await sha256(codeVerifier);

      // Store the verifier under the same key the Supabase client uses.
      // storageKey default is: sb-${projectRef}-auth-token
      const supabaseBase = (import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
      if (!supabaseBase) throw new Error('Supabase URL not configured');
      let storageKey = '';
      try {
        const host = new URL(supabaseBase).hostname;
        const projectRef = host.split('.')[0];
        storageKey = `sb-${projectRef}-auth-token`;
      } catch (_e) {
        storageKey = 'sb-unknown-auth-token';
      }
      const verifierKey = `${storageKey}-code-verifier`;
      try { sessionStorage.setItem(verifierKey, codeVerifier); } catch (_e) { console.warn('Failed to set PKCE code_verifier in sessionStorage', _e); }

      // Build Supabase authorize URL with PKCE
      const authUrl = `${supabaseBase}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}&response_type=code&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
      window.location.href = authUrl;
      return;
    } catch (e) {
      console.warn('[authService] Google sign-in failed', e);
      throw e;
    }
  }
  // If Supabase isn't available in this environment, surface an error so UI can
  // show a helpful message. Implement server-side OAuth flow if needed.
  throw new Error('Google sign-in is not available in this environment.');
}

// Send a Google ID token (credential) to the server for verification and session creation.
// The server should verify the token with Google's tokeninfo endpoint or using
// Google's public keys, then create or link a user and return a session payload.
export async function signInWithGoogleCredential(idToken: string): Promise<any> {
  try {
    const res = await fetch('/api/auth?action=google_id_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken })
    });
    if (!res.ok) {
      let data = null;
      try { data = await res.json(); } catch {}
      throw new Error((data && data.message) || `Google ID token sign-in failed (${res.status})`);
    }
    const data = await res.json();
    // If the server returned a consolidated user payload, persist it locally
    if (data && data.user) {
      try { saveUserData({ data: data.user, token: data.token ?? null }, { skipBackup: true } as any); } catch {}
    }
    return data;
  } catch (e) {
    console.warn('[authService] signInWithGoogleCredential error', e);
    throw e;
  }
}

export function getCurrentUser(): User | null {
  try {
    const ud = loadUserData();
    return ud;
  } catch {
    return null;
  }
}

export async function signOutAndRevoke(timeoutMs = 2000): Promise<void> {
  try {
    // Mark that a user-initiated sign-out is in progress so other listeners
    // (e.g., onAuthStateChange) don't treat the auth null session as an
    // unexpected sign-out and clear the server-side refresh cookie again.
    try {
      if (typeof window !== 'undefined') (window as any).__fitbuddyai_user_signout_initiated = true;
    } catch {}
    const revokeUrl = '/api/auth?action=clear_refresh';
    // Always attempt a credentials-included fetch to clear server-side refresh cookie
    // and revoke the stored refresh token. sendBeacon does not include credentials
    // and therefore cannot be relied upon to clear authenticated cookies.
    try {
      await Promise.race([
        fetch(revokeUrl, { method: 'POST', credentials: 'include' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('revoke_timeout')), timeoutMs))
      ]);
    } catch (e) {
      console.warn('[authService] signOut: clear_refresh request failed or timed out', e);
    }

    // Also fire a best-effort sendBeacon so other tabs receive the notification
    // even if the fetch above completes; do not treat sendBeacon as authoritative.
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try { navigator.sendBeacon(revokeUrl, new Blob([JSON.stringify({})], { type: 'application/json' })); } catch {}
      }
    } catch {}
  } catch (e) {
    console.warn('[authService] signOut: revoke attempt failed', e);
  }

  try { clearAuthToken(); } catch {}
  try { sessionStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
  try { localStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
  try { clearUserData(); } catch {}
  try { sessionStorage.removeItem('fitbuddyaiUsername'); } catch {}
  try {
    if (supabase && typeof supabase.auth?.signOut === 'function') {
      await supabase.auth.signOut().catch(() => {});
    }
  } catch {
    // ignore
  }
  // Clear the user-initiated sign-out flag after signOut completes
  try {
    if (typeof window !== 'undefined') delete (window as any).__fitbuddyai_user_signout_initiated;
  } catch {}
}

export function signOut(): void {
  void signOutAndRevoke().catch((e) => console.warn('[authService] signOut error', e));
}
