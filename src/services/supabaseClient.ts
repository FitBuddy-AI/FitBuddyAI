import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
	import.meta.env.VITE_SUPABASE_URL ||
	process.env.SUPABASE_URL;
const supabaseAnonKey =
	import.meta.env.VITE_SUPABASE_ANON_KEY ||
	process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Supabase URL and Key are required.');
}

// Store only the PKCE verifier in sessionStorage. Ignore all other keys so
// access/refresh tokens are never persisted to web storage.
const pkceOnlyStorage = (() => {
	if (typeof window === 'undefined' || !window.sessionStorage) {
		return {
			getItem: () => null,
			setItem: () => {},
			removeItem: () => {}
		};
	}
	return {
		getItem: (key: string) => {
			if (key.endsWith('-code-verifier')) return window.sessionStorage.getItem(key);
			return null;
		},
		setItem: (key: string, value: string) => {
			if (key.endsWith('-code-verifier')) {
				window.sessionStorage.setItem(key, value);
			}
		},
		removeItem: (key: string) => {
			if (key.endsWith('-code-verifier')) {
				window.sessionStorage.removeItem(key);
			}
		}
	};
})();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		// Keep sessions in memory only, but allow PKCE verifier storage.
		// Do NOT persist sessions to storage (we rely on server-side refresh cookie).
		persistSession: false,
		autoRefreshToken: false,
		detectSessionInUrl: false,
		flowType: 'pkce',
		storage: pkceOnlyStorage
	}
});
