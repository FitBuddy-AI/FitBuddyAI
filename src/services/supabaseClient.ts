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

const sessionStorageAdapter = {
	getItem: (key: string) => {
		if (typeof window === 'undefined') return null;
		try {
			return window.sessionStorage.getItem(key);
		} catch {
			return null;
		}
	},
	setItem: (key: string, value: string) => {
		if (typeof window === 'undefined') return;
		try {
			window.sessionStorage.setItem(key, value);
		} catch {
			// no-op
		}
	},
	removeItem: (key: string) => {
		if (typeof window === 'undefined') return;
		try {
			window.sessionStorage.removeItem(key);
		} catch {
			// no-op
		}
	}
};

// Persist Supabase sessions only in sessionStorage (not localStorage) and
// use PKCE for OAuth to avoid returning raw access tokens in URL fragments.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
		flowType: 'pkce',
		storage: sessionStorageAdapter
	}
});
