import React, { useEffect, useState } from 'react';
import { saveAssessmentData, saveWorkoutPlan, saveUserData, clearUserData } from '../services/localStorage';
import { signIn, fetchUserById } from '../services/authService';
import GoogleIdentityButton from './GoogleIdentityButton';
import { restoreUserDataFromServer } from '../services/cloudBackupService';
import { useNavigate } from 'react-router-dom';
import './SignInPage.css';
import './EmailVerifyPage.css';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendModalOpen, setResendModalOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState('');

  useEffect(() => {
    document.body.classList.add('signin-page-screen');
    return () => {
      document.body.classList.remove('signin-page-screen');
    };
  }, []);

  useEffect(() => {
    const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
    if (!useSupabase || typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (!code) return;
    const handledKey = `fitbuddyai_oauth_handled_${code}`;
    try {
      if (sessionStorage.getItem(handledKey)) return;
      sessionStorage.setItem(handledKey, '1');
    } catch (_e) {}

    const handleOAuthCallback = async () => {
      setLoading(true);
      setError('');
      try {
        // Prevent stale local user data from masking a newly authenticated account.
        try { clearUserData(); } catch {}
        // Diagnostic: list sessionStorage keys to confirm PKCE artifacts exist.
        try {
          const keys = Object.keys(sessionStorage || {}).slice(0, 50);
          console.log('[SignInPage] sessionStorage keys (partial):', keys);
          const pkceLikely = keys.some(k => /code_verifier|pkce|supabase|sb-/.test(k));
          console.log('[SignInPage] PKCE-like key present in sessionStorage?', pkceLikely);
        } catch (_e) {}

        let data: any = null;

        // Always perform manual PKCE exchange first so the verifier isn't cleared
        // by the SDK before we can read it.
        const supabaseBase = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        if (!supabaseBase || !anonKey) throw new Error('Supabase URL or anon key missing');

        let projectRef = '';
        try { projectRef = new URL(supabaseBase).hostname.split('.')[0]; } catch {}
        const verifierKey = projectRef ? `sb-${projectRef}-auth-token-code-verifier` : 'code_verifier';
        const cachedVerifier = sessionStorage.getItem(verifierKey) || sessionStorage.getItem('code_verifier') || '';
        console.log('[SignInPage] PKCE verifier present?', Boolean(cachedVerifier));
        if (!cachedVerifier) throw new Error('PKCE verifier missing in sessionStorage');

        const tokenRes = await fetch(`${supabaseBase}/auth/v1/token?grant_type=pkce`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json;charset=UTF-8'
          },
          body: JSON.stringify({ auth_code: code, code_verifier: cachedVerifier })
        });
        if (!tokenRes.ok) {
          const text = await tokenRes.text();
          throw new Error(text || `PKCE token exchange failed (${tokenRes.status})`);
        }
        const tokenData = await tokenRes.json();
        data = { session: tokenData, user: tokenData?.user };

        // Clear verifier after successful exchange
        try { sessionStorage.removeItem(verifierKey); } catch {}
        try { sessionStorage.removeItem('code_verifier'); } catch {}

        // Store access token in memory only
        if (tokenData?.access_token) {
          try {
            (window as any).fitbuddyai_access_token = tokenData.access_token;
            const expiresIn = Number(tokenData.expires_in || 3600) * 1000;
            (window as any).fitbuddyai_token_expires = Date.now() + expiresIn;
          } catch {}
        }

        const session = data?.session as any;
        const sessionUser = (session && session.user) || data?.user || null;
        if (!sessionUser?.id) {
          throw new Error('Google sign-in did not return a valid session.');
        }

        const baseProfile = {
          id: sessionUser.id,
          email: sessionUser.email || '',
          username: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || sessionUser.email || 'User',
          avatar: sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture || '/images/fitbuddy_head.png'
        };

        // DO NOT store the access token in sessionStorage/localStorage.
        // Access tokens are kept in memory only (in React state in App.tsx).
        // The refresh token is already stored server-side via /api/auth?action=store_refresh.

        const accessToken = session?.access_token || (data as any)?.access_token || (window as any)?.fitbuddyai_access_token || '';
        try {
          await fetch('/api/auth?action=store_refresh', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
            },
            body: JSON.stringify({ userId: sessionUser.id, refresh_token: session?.refresh_token || (data as any)?.refresh_token })
          });
        } catch (refreshStoreErr) {
          console.warn('[SignInPage] Failed to persist refresh token after OAuth callback', refreshStoreErr);
        }

        // Ensure a usable profile exists in fitbuddyai_userdata for this auth user.
        try {
          if (baseProfile.email && baseProfile.username) {
            await fetch('/api/auth?action=create_profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
              },
              body: JSON.stringify({ id: baseProfile.id, email: baseProfile.email, username: baseProfile.username })
            });
          }
        } catch (profileErr) {
          console.warn('[SignInPage] create_profile failed', profileErr);
        }

        const freshUser = await fetchUserById(sessionUser.id);
        const resolvedUser = {
          ...baseProfile,
          ...(freshUser || {})
        };
        if (!resolvedUser.email) resolvedUser.email = baseProfile.email;
        if (!resolvedUser.username) resolvedUser.username = baseProfile.username;
        if (!resolvedUser.avatar) resolvedUser.avatar = baseProfile.avatar;
        // Save user profile data (not the token) — user data is non-sensitive and needed for UI
        saveUserData({ data: resolvedUser }, { skipBackup: true });
        try { window.dispatchEvent(new Event('fitbuddyai-login')); } catch {}

        navigate('/profile', { replace: true });
      } catch (err: any) {
        console.warn('[SignInPage] OAuth callback handling failed', err);
        // Provide a clearer message for PKCE/code_verifier failures
        const msg = String(err?.message || err || 'Google sign-in failed. Please try again.');
        if (/both auth code and code verifier should be non-empty|code_verifier/i.test(msg)) {
          const friendly = 'OAuth exchange failed: PKCE verifier missing. Ensure your OAuth redirect URI is set to http://localhost:5173/signin (not the root), clear site data (sessionStorage) and retry. If using multiple tabs, start sign-in in the same tab.';
          setError(friendly);
        } else {
          setError(msg);
        }
      } finally {
        // Remove one-time auth code from URL after processing.
        url.searchParams.delete('code');
        const search = url.searchParams.toString();
        const nextUrl = `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
        window.history.replaceState({}, document.title, nextUrl);
        setLoading(false);
      }
    };

    handleOAuthCallback();
    return () => {};
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
      const dataUser = await signIn(normalizedEmail, password);
      // The signIn helper will handle refresh token storage server-side.
      // We store the user profile data only (not the token).
      const data = dataUser ? { user: dataUser, token: null } : null;
      if (data && data.user) {
      // Use central saveUserData but skip auto-backup for now so we don't overwrite server data
      // before a restore completes. After restore completes, existing scheduleBackup calls
      // (from saving assessment/plan) will run as needed.
        // Save user data (profile only, no token) into the unified user_data object
  const toSave = { data: data.user };
  try { saveUserData(toSave, { skipBackup: true }); } catch {}
        // Attempt to restore any server-stored questionnaire/workout/assessment data
        try {
          await restoreUserDataFromServer(data.user.id);
        } catch (err) {
          console.warn('Failed to restore user data from server:', err);
        }
  // Notify other app parts (same-tab) that a login occurred so they can sync state
  try { window.dispatchEvent(new Event('fitbuddyai-login')); } catch (err) {}
        // Fetch consolidated user-data payload (questionnaire, plan, assessment) via POST so we don't rely on GET routing
        try {
          const postUrl = '/api/userdata/load';
          console.log('[SignInPage] POSTing to userdata save endpoint to retrieve stored payload', postUrl);
          const init = await import('../services/apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: data.user.id }) }));

          // Helper: attempt the POST multiple times to allow auth token propagation to localStorage
          const doPostWithRetries = async (url: string, initObj: RequestInit, maxAttempts = 3, delayMs = 500) => {
            let lastRes: Response | null = null;
            let lastText: string | null = null;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              try {
                const r = await fetch(url, initObj);
                const t = await r.text();
                lastRes = r;
                lastText = t;
                if (r.ok) return { res: r, text: t };
                // If 401/403 (auth issue), retry; otherwise only retry for transient 5xx
                if (attempt < maxAttempts && (r.status === 401 || r.status === 403 || (r.status >= 500 && r.status < 600))) {
                  console.warn(`[SignInPage] userdata POST attempt ${attempt} failed status ${r.status}. Retrying after ${delayMs}ms`);
                  await new Promise(r => setTimeout(r, delayMs));
                  continue;
                }
                return { res: r, text: t };
              } catch (_e) {
                lastRes = null;
                lastText = null;
                if (attempt < maxAttempts) {
                  console.warn(`[SignInPage] userdata POST attempt ${attempt} threw, retrying after ${delayMs}ms`, _e);
                  await new Promise(r => setTimeout(r, delayMs));
                  continue;
                }
                throw _e;
              }
            }
            return { res: lastRes, text: lastText };
          };

          const { res: postRes, text } = await doPostWithRetries(postUrl, init, 3, 500);
          if (!postRes) throw new Error('Failed to receive a response from userdata endpoint');
          console.log('[SignInPage] userdata POST response status:', postRes.status, 'ok:', postRes.ok);
          if (text && text.length) console.log('[SignInPage] userdata POST response snippet:', text.slice(0,500));
          const sourceHeader = postRes.headers.get('x-userdata-source');
          if (sourceHeader) console.log('[SignInPage] userdata source header:', sourceHeader);
          if (!postRes.ok) {
            console.warn('[SignInPage] userdata POST returned non-ok status');
            // fallback: try explicit restore via restoreUserDataFromServer which uses attachAuthHeaders internally
            try { await restoreUserDataFromServer(data.user.id); } catch (re) { console.warn('[SignInPage] fallback restore failed:', re); }
          } else {
            let body: any = null;
            try {
              body = text ? JSON.parse(text) : null;
            } catch (_e) {
              console.warn('[SignInPage] userdata POST returned invalid JSON; invoking restoreUserDataFromServer fallback', _e);
              try { await restoreUserDataFromServer(data.user.id); } catch (re) { console.warn('[SignInPage] fallback restore failed:', re); }
            }

            const payload = body?.stored ?? body?.payload ?? body;
            if (payload) {
              try {
                const assessRaw = payload.assessment_data ?? payload.fitbuddyai_assessment_data;
                const planRaw = payload.workout_plan ?? payload.fitbuddyai_workout_plan;
                // Unwrap if the server returned a wrapper { data, timestamp }
                const assessmentVal = assessRaw?.data ?? assessRaw ?? null;
                const planVal = planRaw?.data ?? planRaw ?? null;
                if (assessmentVal) saveAssessmentData(assessmentVal);
                if (planVal) saveWorkoutPlan(planVal);
              } catch (_e) {
                console.warn('Failed to save restored payload values:', _e);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to fetch userdata payload via POST:', err);
        }
        navigate('/profile');
      } else {
        throw new Error('Invalid server response.');
      }
    } catch (err: any) {
      // Handle unconfirmed email specially
      if (err && (err.code === 'ERR_EMAIL_UNCONFIRMED' || /Email not confirmed/i.test(err.message || ''))) {
        setError('Your email address is not confirmed. Please check your inbox for the confirmation link.');
        // Open an inline modal to ask user if they'd like to resend
        setResendEmail(normalizedEmail);
        setResendModalOpen(true);
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-page">
      <form className="signin-form" onSubmit={handleSubmit}>
        <h1>Sign In</h1>
        <label>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label>Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
        <div className="oauth-divider">or</div>
        <GoogleIdentityButton />
        <div className="signup-link">Don't have an account? <span onClick={() => navigate('/signup')}>Sign Up</span></div>
      </form>
      {resendModalOpen && (
        <ResendConfirmModal
          email={resendEmail}
          onClose={() => setResendModalOpen(false)}
          onSent={() => { setResendModalOpen(false); navigate('/verify-email?email=' + encodeURIComponent(resendEmail)); }}
        />
      )}
    </div>
  );
};

function ResendConfirmModal({ email, onClose, onSent }: { email: string; onClose: () => void; onSent: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const handleResend = async () => {
    setLoading(true);
    setMsg('');
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/auth/v1/recover`;
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(url, { method: 'POST', headers: { apikey: anon || '', 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (res.ok) {
        setMsg('Verification email resent — check your inbox (and spam).');
        onSent();
      } else {
        setMsg('Failed to resend verification email. Please contact support.');
      }
    } catch (_e) {
      setMsg('Failed to resend verification email. Please contact support.');
    }
    setLoading(false);
  };
  return (
    <div className="hc-modal-backdrop" role="dialog" aria-modal="true">
      <div className="hc-modal">
        <header className="hc-modal-header">
          <h3>Resend confirmation</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </header>
        <div className="hc-modal-body">
          <p>We can resend the verification email to <strong>{email}</strong>. Would you like to resend it now?</p>
          {msg && <div className="info">{msg}</div>}
          <div className="hc-modal-actions">
            <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="btn btn-primary" onClick={handleResend} disabled={loading}>{loading ? 'Sending...' : 'Resend'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignInPage;
