import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
const SUPABASE_KEY = process.env.SUPABASE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[api/auth/index] Missing SUPABASE_URL or SUPABASE_KEY in environment; auth actions will fail');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

const ENC_ALGO = 'aes-256-gcm';

const parseEncKeys = () => {
  const out: { id: string; key: Buffer }[] = [];
  const multi = (process.env.REFRESH_TOKEN_ENC_KEYS || '').toString().trim();
  if (multi) {
    for (const part of multi.split(',').map(item => item.trim()).filter(Boolean)) {
      const [id, ...rest] = part.split('=');
      const raw = rest.join('=').trim();
      if (!id || !raw) continue;
      out.push({ id: id.trim(), key: crypto.createHash('sha256').update(raw).digest() });
    }
  } else {
    const single = (process.env.REFRESH_TOKEN_ENC_KEY || process.env.REFRESH_TOKEN_KEY || '').toString().trim();
    if (single) {
      const id = (process.env.REFRESH_TOKEN_ENC_KEY_ID || 'k1').toString().trim() || 'k1';
      out.push({ id, key: crypto.createHash('sha256').update(single).digest() });
    }
  }
  return out;
};

const ENC_KEYS = parseEncKeys();
if (!ENC_KEYS.length) {
  throw new Error('[api/auth/index] REFRESH_TOKEN_ENC_KEY(S) is not set. Set REFRESH_TOKEN_ENC_KEYS or REFRESH_TOKEN_ENC_KEY to enable secure refresh token encryption.');
}

const CURRENT_KEY_ID = ENC_KEYS[0].id;
const CURRENT_KEY = ENC_KEYS[0].key;
const COOKIE_NAME = 'fitbuddyai_sid';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type RefreshTokenRow = {
  session_id: string;
  user_id: string;
  refresh_token: string;
  created_at: string;
  last_used?: string | null;
  revoked?: boolean | null;
  expires_at?: string | null;
};

function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, CURRENT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CURRENT_KEY_ID}:${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
}

function decryptToken(blobWithOptionalPrefix: string): { value: string; keyId: string } {
  let keyId: string | null = null;
  let blobB64 = blobWithOptionalPrefix;
  const match = String(blobWithOptionalPrefix || '').match(/^([A-Za-z0-9_-]+):(.+)$/);
  if (match) {
    keyId = match[1];
    blobB64 = match[2];
  }

  const buf = Buffer.from(blobB64, 'base64');
  if (buf.length < 28) throw new Error('Invalid encrypted blob');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const ciphertext = buf.slice(28);

  const tryKeys = (keys: { id: string; key: Buffer }[]) => {
    for (const item of keys) {
      try {
        const decipher = crypto.createDecipheriv(ENC_ALGO, item.key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return { value: decrypted.toString('utf8'), keyId: item.id };
      } catch {
        // try next key
      }
    }
    return null;
  };

  if (keyId) {
    const found = ENC_KEYS.find(item => item.id === keyId);
    if (found) {
      const out = tryKeys([found]);
      if (out) return out;
      throw new Error('Failed to decrypt with specified key id');
    }
  }

  const out = tryKeys(ENC_KEYS);
  if (!out) throw new Error('Failed to decrypt refresh token with any known key');
  return out;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.split('=');
    const key = rawKey?.trim();
    if (!key) continue;
    const rawValue = (rest || []).join('=');
    if (!rawValue) {
      out[key] = '';
      continue;
    }
    try {
      out[key] = decodeURIComponent(rawValue.trim());
    } catch {
      out[key] = rawValue.trim();
    }
  }
  return out;
}

function makeSessionId() {
  return uuidv4();
}

function getBearerToken(req: any): string | null {
  const authHeader = String(req.headers['authorization'] || req.headers['Authorization'] || '');
  if (!authHeader) return null;
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

async function requireMatchingUser(req: any, expectedUserId: string): Promise<boolean> {
  const token = getBearerToken(req);
  if (!token) {
    console.debug('[api/auth/requireMatchingUser] no bearer token present on request');
    return false;
  }
  try {
    const { data: authData, error } = await supabase.auth.getUser(token);
    if (error || !authData?.user?.id) {
      console.debug('[api/auth/requireMatchingUser] supabase.getUser failed', { error });
      return false;
    }
    const matches = authData.user.id === expectedUserId;
    if (!matches) console.debug('[api/auth/requireMatchingUser] token user id mismatch', { tokenUserId: authData.user.id, expectedUserId });
    return matches;
  } catch {
    return false;
  }
}

interface AdminJwtPayload {
  role: string;
  [key: string]: unknown;
}

export async function requireAdmin(req: any): Promise<AdminJwtPayload | null> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('[api/auth/index] Missing JWT_SECRET in environment; admin actions are disabled');
    return null;
  }
  const authHeader = String(req.headers['authorization'] || req.headers['Authorization'] || '');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, jwtSecret) as string | AdminJwtPayload;
    if (typeof decoded === 'object' && decoded && (decoded.role === 'service' || decoded.role === 'admin')) {
      return decoded;
    }
  } catch {
    // ignore
  }
  return null;
}

const normalizeEmail = (value: string | undefined | null): string => {
  if (!value) return '';
  return String(value).trim().toLowerCase();
};

export default async function handler(req: any, res: any) {
  // Set CORS headers for Vercel / browser requests
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  const action = String(req.query?.action || '').toLowerCase();
  // Fail fast if Supabase server envs are not configured
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[api/auth/index] Supabase envs missing on request');
    return res.status(500).json({ message: 'Supabase not configured on server. Set SUPABASE_URL and SUPABASE_KEY.' });
  }
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    if (action === 'signin') {
      const { email, password } = req.body as { email: string; password: string };
      if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) return res.status(400).json({ message: 'Email is required.' });
      // Look up user in fitbuddyai_userdata by email (legacy API flow)
      const { data } = await supabase.from('fitbuddyai_userdata').select('*').ilike('email', normalizedEmail).limit(1).maybeSingle();
      const user = data as any;
      if (!user || user.password !== password) return res.status(401).json({ message: 'Invalid email or password.' });
      const safeUser = { id: user.user_id || user.id, email: user.email, username: user.username, energy: user.energy, streak: user.streak, role: user.role };
      // Issue a local JWT for server-side verification when Supabase token is not used
      const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';
      let token: string | null = null;
      try {
          token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
      } catch (_e) {
        console.warn('[api/auth/index] failed to sign jwt', _e);
        token = null;
      }
      return res.json({ user: safeUser, token });
    }

    if (action === 'store_refresh') {
      const { userId, refresh_token } = req.body as { userId?: string; refresh_token?: string };
      if (!userId || !refresh_token) return res.status(400).json({ message: 'userId and refresh_token required.' });

      console.debug('[api/auth/store_refresh] incoming Authorization:', !!req.headers?.authorization, 'cookiePresent:', !!req.headers?.cookie);
      const callerMatches = await requireMatchingUser(req, userId);
      if (!callerMatches) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
      }

      const enc = encryptToken(String(refresh_token));
      let sid: string | undefined;
      let inserted = false;
      let insertErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        sid = makeSessionId();
        const { error } = await supabase.from('fitbuddyai_refresh_tokens').insert([{ session_id: sid, user_id: userId, refresh_token: enc, created_at: new Date().toISOString(), last_used: new Date().toISOString(), revoked: false }]);
        if (!error) {
          inserted = true;
          break;
        }
        if (error.code === '23505' || (error.message && error.message.includes('duplicate key value'))) {
          continue;
        }
        insertErr = error;
        break;
      }

      if (insertErr || !inserted || !sid) {
        console.error('[api/auth/store_refresh] failed to persist refresh token', insertErr || 'insert retries exhausted');
        return res.status(500).json({ message: 'Failed to persist refresh token' });
      }

      const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secureFlag}`);
      return res.json({ ok: true, session_id: sid });
    }

    if (action === 'refresh') {
      try {
        console.debug('[api/auth/refresh] incoming request headers cookie:', req.headers?.cookie);
        const cookies = parseCookies(req.headers?.cookie as string | undefined);
        const sid = cookies[COOKIE_NAME];
        if (!sid) return res.status(401).json({ message: 'No session cookie present' });

        const { data: entry, error: selectErr } = await supabase.from('fitbuddyai_refresh_tokens').select('*').eq('session_id', sid).limit(1).maybeSingle();
        if (selectErr) {
          console.error('[api/auth/refresh] db select error', selectErr);
          return res.status(500).json({ message: 'Failed to lookup session' });
        }
        const session = entry as RefreshTokenRow | null;
        if (!session || session.revoked) return res.status(401).json({ message: 'Session not found or revoked' });
        if (session.expires_at && new Date(session.expires_at) < new Date()) {
          return res.status(401).json({ message: 'Session expired' });
        }

        let decryptedRefresh = '';
        try {
          const decrypted = decryptToken(String(session.refresh_token));
          decryptedRefresh = decrypted.value;
          if (decrypted.keyId !== CURRENT_KEY_ID) {
            try {
              await supabase.from('fitbuddyai_refresh_tokens').update({ refresh_token: encryptToken(decryptedRefresh), last_used: new Date().toISOString() }).eq('session_id', sid);
            } catch (e) {
              console.warn('[api/auth/refresh] failed to rotate refresh token to new key', e);
            }
          }
        } catch (e) {
          console.error('[api/auth/refresh] failed to decrypt refresh token', e);
          try { await supabase.from('fitbuddyai_refresh_tokens').update({ revoked: true }).eq('session_id', sid); } catch {}
          return res.status(401).json({ message: 'Invalid session' });
        }

        const tokenUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
        const resp = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY || '',
            Authorization: `Bearer ${SUPABASE_KEY || ''}`
          },
          body: JSON.stringify({ refresh_token: decryptedRefresh })
        });
        const body = await resp.json();
        if (!resp.ok) {
          console.warn('[api/auth/refresh] supabase token refresh failed', body);
          try { await supabase.from('fitbuddyai_refresh_tokens').update({ revoked: true }).eq('session_id', sid); } catch {}
          return res.status(401).json({ message: 'Failed to refresh token' });
        }

        try {
          const updates: { last_used: string; refresh_token?: string } = { last_used: new Date().toISOString() };
          if (body.refresh_token) updates.refresh_token = encryptToken(body.refresh_token);
          await supabase.from('fitbuddyai_refresh_tokens').update(updates).eq('session_id', sid);
        } catch (e) {
          console.warn('[api/auth/refresh] failed to update refresh token record', e);
        }

        let userId: string | null = null;
        try {
          const { data: userData, error: userErr } = await supabase.auth.getUser(body.access_token);
          if (!userErr && userData?.user?.id) userId = userData.user.id;
        } catch {
          // ignore
        }

        return res.json({ access_token: body.access_token, expires_at: body.expires_at ?? body.expires_in, user_id: userId });
      } catch (e) {
        console.error('[api/auth/refresh] error', e);
        return res.status(500).json({ message: 'Refresh failed' });
      }
    }

    if (action === 'clear_refresh') {
      try {
        const cookies = parseCookies(req.headers?.cookie as string | undefined);
        const sid = cookies[COOKIE_NAME];
        if (sid) {
          await supabase.from('fitbuddyai_refresh_tokens').update({ revoked: true }).eq('session_id', sid);
        }
        res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
        return res.json({ ok: true });
      } catch {
        return res.status(500).json({ message: 'Failed to clear refresh session' });
      }
    }

    if (action === 'revoke_session') {
      const admin = await requireAdmin(req);
      if (!admin) return res.status(403).json({ message: 'Forbidden' });
      const { session_id } = req.body as { session_id?: string };
      if (!session_id) return res.status(400).json({ message: 'session_id required' });
      const { error } = await supabase.from('fitbuddyai_refresh_tokens').update({ revoked: true }).eq('session_id', session_id);
      if (error) return res.status(500).json({ message: 'Failed to revoke session' });
      return res.json({ ok: true });
    }

    if (action === 'revoke_user_sessions') {
      const admin = await requireAdmin(req);
      if (!admin) return res.status(403).json({ message: 'Forbidden' });
      const { userId } = req.body as { userId?: string };
      if (!userId) return res.status(400).json({ message: 'userId required' });
      const { error } = await supabase.from('fitbuddyai_refresh_tokens').update({ revoked: true }).eq('user_id', userId);
      if (error) return res.status(500).json({ message: 'Failed to revoke sessions for user' });
      return res.json({ ok: true });
    }

    if (action === 'cleanup_refresh_tokens') {
      const admin = await requireAdmin(req);
      if (!admin) return res.status(403).json({ message: 'Forbidden' });
      const days = Number(req.body?.days || 30);
      const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('fitbuddyai_refresh_tokens').delete().lt('created_at', threshold);
      if (error) return res.status(500).json({ message: 'Cleanup failed' });
      return res.json({ ok: true });
    }

    if (action === 'signup') {
      const { email, username, password } = req.body as { email: string; username: string; password: string };
      if (!email || !username || !password) return res.status(400).json({ message: 'All fields are required.' });
      // Normalize email for equality checks (case-insensitive)
      const normalizedEmail = normalizeEmail(email);
      // Quick existence check to return a friendly message without attempting insert
      try {
          const { data: existing } = await supabase.from('fitbuddyai_userdata').select('user_id,email').ilike('email', normalizedEmail).limit(1).maybeSingle();
        if (existing) return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email already exists.' });
      } catch (e) {
        // ignore and proceed to insert; DB unique index will enforce constraint
      }

      const userId = uuidv4();
      // Insert into unified fitbuddyai_userdata table keyed by user_id
      const userRow = { user_id: userId, email: normalizedEmail, username, password, avatar: '', energy: 100, streak: 0, inventory: [] };
      const { error } = await supabase.from('fitbuddyai_userdata').insert(userRow);
      if (error) {
        // Supabase returns Postgres error details; detect unique violation (23505) or text mentioning 'unique'/'duplicate'
        const pgCode = (error as any)?.code || (error as any)?.details || null;
        const msg = (error as any)?.message || String(error);
        console.error('Supabase insert error:', error);
        if (String(msg).toLowerCase().includes('unique') || String(pgCode) === '23505') {
          return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email already exists.' });
        }
        return res.status(500).json({ message: 'Failed to create user.' });
      }
      const safeUser = { id: userId, email, username, avatar: '', energy: 100, streak: 0, inventory: [], role: 'basic_member' };
      return res.status(201).json({ user: safeUser });
    }

    // Create profile for an existing auth user (used after Supabase auth.signUp client flow)
    if (action === 'create_profile') {
      const { id, email, username } = req.body as { id: string; email: string; username: string };
      if (!id || !email || !username) return res.status(400).json({ message: 'id, email and username required.' });
      const normalizedEmail = normalizeEmail(email);
      try {
        // If a row already exists for this user_id, update any missing fields.
        const { data: byId } = await supabase
          .from('fitbuddyai_userdata')
          .select('*')
          .eq('user_id', id)
          .limit(1)
          .maybeSingle();
        if (byId && byId.user_id) {
          const updates: any = { email: normalizedEmail };
          if (username && (!byId.username || byId.username !== username)) updates.username = username;
          const { error: updateError } = await supabase.from('fitbuddyai_userdata').update(updates).eq('user_id', id);
          if (updateError) {
            console.warn('[api/auth/create_profile] failed to update existing profile', updateError);
            return res.status(500).json({ message: 'Failed to update profile.' });
          }
          return res.status(200).json({ ok: true, reused: true });
        }

        // Try to reuse existing profile for this email before creating a new one.
        const { data: existing } = await supabase
          .from('fitbuddyai_userdata')
          .select('*')
          .ilike('email', normalizedEmail)
          .limit(1)
          .maybeSingle();
        if (existing && existing.user_id) {
          const updates: any = { email: normalizedEmail };
          if (existing.username !== username && username) updates.username = username;
          if (existing.user_id !== id) updates.user_id = id;
          const matchId = existing.user_id;
          const { error: updateError } = await supabase.from('fitbuddyai_userdata').update(updates).eq('user_id', matchId);
          if (updateError) {
            console.warn('[api/auth/create_profile] failed to rebind existing profile', updateError);
            return res.status(500).json({ message: 'Failed to migrate existing profile.' });
          }
          return res.status(200).json({ ok: true, reused: true });
        }

        // No existing row: insert a new profile
        const userRow = {
          user_id: id,
          email: normalizedEmail,
          username,
          avatar: '',
          energy: 100,
          streak: 0,
          inventory: [],
          accepted_privacy: false,
          accepted_terms: false,
          chat_history: [],
          workout_plan: null,
          questionnaire_progress: null,
          banned: false,
          role: 'basic_member'
        };
        const { error: uErr } = await supabase.from('fitbuddyai_userdata').insert(userRow);
        if (uErr) {
          console.warn('[api/auth/create_profile] fitbuddyai_userdata insert error', uErr);
          return res.status(500).json({ message: 'Failed to create profile.' });
        }
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('[api/auth/create_profile] error', e);
        return res.status(500).json({ message: 'Failed to create profile.' });
      }
    }

    return res.status(404).json({ message: 'Not found' });
  } catch (err: any) {
    console.error('[api/auth/index] error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
