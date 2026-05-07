// LocalStorage utilities for saving and restoring questionnaire progress

export interface QuestionnaireProgress {
  currentQuestion: number;
  answers: Record<string, any>;
  customInputs?: Record<string, string>;
  completed?: boolean;
  timestamp: number;
  userData?: any; // Add userData to the interface
  questionsList?: any[]; // Persist full question list including AI-generated
}

const STORAGE_KEYS = {
  QUESTIONNAIRE_PROGRESS: 'fitbuddyai_questionnaire_progress',
  USER_DATA: 'fitbuddyai_user_data',
  USER_DATA_PERSISTED: 'fitbuddyai_user_data_persisted',
  ASSESSMENT_DATA: 'fitbuddyai_assessment_data',
  WORKOUT_PLAN: 'fitbuddyai_workout_plan',
  HOME_INTRO_ENABLED: 'fitbuddyai_home_intro_enabled',
  SUPABASE_SESSION: 'fitbuddyai_supabase_session'
};
// Auto-backup: import cloud backup helper and provide a debounced scheduler
import { backupUserDataToServer } from './cloudBackupService';
import { ensureUserId } from '../utils/userHelpers';

let userDataCache: { data: any; timestamp: number } | null = null;

const purgeLegacyUserStorage = () => {
  try { sessionStorage.removeItem(STORAGE_KEYS.USER_DATA); } catch {}
  try { localStorage.removeItem(STORAGE_KEYS.USER_DATA); } catch {}
  try { localStorage.removeItem(STORAGE_KEYS.USER_DATA_PERSISTED); } catch {}
};

export const getUserDataTimestamp = (): number => {
  try {
    return userDataCache?.timestamp || 0;
  } catch {
    return 0;
  }
};

// Helper: parse a value that may be a JSON string, a double-encoded JSON string, or an object
function safeParseStored<T = any>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    // First attempt: parse once
    let parsed: any = JSON.parse(raw);
    // If the result is a string (double-encoded), try parsing again
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
        console.log('[localStorage] safeParseStored -> double-encoded JSON parsed');
      } catch (e) {
        // leave as string
      }
    }
    return parsed as T;
  } catch (err) {
    // If raw is not JSON, return null
    console.warn('[localStorage] safeParseStored -> parse failed:', err);
    return null;
  }
}

let backupTimeout: number | null = null;
const BACKUP_DEBOUNCE_MS = 800; // wait briefly to batch rapid updates

function scheduleBackup() {
  try {
    const userId = userDataCache?.data?.id || null;
    if (!userId) return; // no signed-in user yet
    if (backupTimeout) {
      clearTimeout(backupTimeout);
    }
    backupTimeout = window.setTimeout(async () => {
      backupTimeout = null;
      try {
        await backupUserDataToServer(userId);
      } catch (err) {
        console.warn('Auto backup failed:', err);
      }
    }, BACKUP_DEBOUNCE_MS);
  } catch (err) {
    console.warn('Failed to schedule backup:', err);
  }
}
// Assessment Data (for questionnaire user data, separate from account)
export const saveAssessmentData = (assessmentData: any): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ASSESSMENT_DATA, JSON.stringify({
      data: assessmentData,
      timestamp: Date.now()
    }));
  // schedule cloud backup (if user signed in)
  scheduleBackup();
  } catch (error) {
    console.warn('Failed to save assessment data:', error);
  }
};

export const loadAssessmentData = (): any | null => {
  try {
  const saved = localStorage.getItem(STORAGE_KEYS.ASSESSMENT_DATA);
  if (!saved) return null;
  const parsed = safeParseStored<{ data: any; timestamp: number }>(saved);
  if (!parsed) return null;
  const { data, timestamp } = parsed;
  console.log('[localStorage] loadAssessmentData -> found data, timestamp:', timestamp);
    // Check if data is older than 7 days
    const isExpired = Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000;
    if (isExpired) {
      clearAssessmentData();
      return null;
    }
    return data;
  } catch (error) {
    console.warn('Failed to load assessment data:', error);
    return null;
  }
};

export const clearAssessmentData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.ASSESSMENT_DATA);
  scheduleBackup();
  } catch (error) {
    console.warn('Failed to clear assessment data:', error);
  }
};

// Questionnaire Progress
export const saveQuestionnaireProgress = (progress: QuestionnaireProgress): void => {
  try {
    // Also save userData if available
    localStorage.setItem(STORAGE_KEYS.QUESTIONNAIRE_PROGRESS, JSON.stringify(progress));
  // schedule cloud backup (if user signed in)
  scheduleBackup();
  } catch (error) {
    console.warn('Failed to save questionnaire progress:', error);
  }
};

export const loadQuestionnaireProgress = (): QuestionnaireProgress | null => {
  try {
  const saved = localStorage.getItem(STORAGE_KEYS.QUESTIONNAIRE_PROGRESS);
  if (!saved) return null;

  const progress = safeParseStored<QuestionnaireProgress>(saved) as QuestionnaireProgress | null;
  if (!progress) return null;

    // Check if progress is older than 24 hours
    const isExpired = Date.now() - progress.timestamp > 24 * 60 * 60 * 1000;
    if (isExpired) {
      clearQuestionnaireProgress();
      return null;
    }

    return progress;
  } catch (error) {
    console.warn('Failed to load questionnaire progress:', error);
    return null;
  }
};

export const clearQuestionnaireProgress = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.QUESTIONNAIRE_PROGRESS);
  scheduleBackup();
  } catch (error) {
    console.warn('Failed to clear questionnaire progress:', error);
  }
};

// User Data
export const saveUserData = (userData: any, opts?: { skipBackup?: boolean }): void => {
  try {
    // Accept either a raw user object or a wrapper { data, token }
    const toStore: any = {};
    if (userData && typeof userData === 'object' && ('data' in userData || 'token' in userData)) {
      // Already wrapped: only persist the non-sensitive user profile
      toStore.data = userData.data || null;
      // NOTE: Do NOT store tokens in sessionStorage/localStorage — tokens are kept in memory and refreshed from server.
    } else {
      toStore.data = userData || null;
    }
    toStore.data = ensureUserId(toStore.data);
    const payload = { ...toStore, timestamp: Date.now() };
    userDataCache = payload;
    try { (window as any).fitbuddyai_user_data = payload; } catch {}
    purgeLegacyUserStorage();
    // Broadcast to other tabs so they can sync via BroadcastChannel
    try {
      const bc = new BroadcastChannel('fitbuddyai');
      bc.postMessage({ type: 'user-update', timestamp: Date.now() });
      bc.close();
    } catch (_e) {}
    // When user signs in / user data changes, trigger backup of any existing keys
    if (!opts || !opts.skipBackup) scheduleBackup();
  } catch (error) {
    console.warn('Failed to save user data:', error);
  }
};

export const loadUserData = (): any | null => {
  try {
    const cached = userDataCache || ((window as any)?.fitbuddyai_user_data || null);
    if (!cached || !cached.data) return null;
    return ensureUserId(cached.data);
  } catch (error) {
    console.warn('Failed to load user data:', error);
    return null;
  }
};

export const clearUserData = (): void => {
  try {
    userDataCache = null;
    try { (window as any).fitbuddyai_user_data = null; } catch {}
    // Remove canonical user payloads and session data
    purgeLegacyUserStorage();
    try { sessionStorage.removeItem(STORAGE_KEYS.WORKOUT_PLAN); } catch {}
    try { localStorage.removeItem(STORAGE_KEYS.USER_DATA); } catch {}
    try { localStorage.removeItem(STORAGE_KEYS.WORKOUT_PLAN); } catch {}
    try { localStorage.removeItem(STORAGE_KEYS.USER_DATA_PERSISTED); } catch {}  // deprecated, but clear if exists
    // Remove persisted supabase session helper and auth token
    try { localStorage.removeItem(STORAGE_KEYS.SUPABASE_SESSION); } catch {}
    try { clearAuthToken(); } catch {}
    try { sessionStorage.removeItem('fitbuddyai_chat_anon'); } catch {}
    try { localStorage.removeItem('fitbuddyai_chat_anon'); } catch {}

    // Remove known FitBuddyAI keys that may be left behind by various components
    const removeIfExists = (key: string) => {
      try { sessionStorage.removeItem(key); } catch {}
      try { localStorage.removeItem(key); } catch {}
    };
    const knownPrefixes = ['fitbuddyai_chat_', 'fitbuddyai_last_plan_id', 'fitbuddyai_calendar_last_date', 'fitbuddyaiUsername', 'fitbuddyai_supabase_session'];
    for (const prefix of knownPrefixes) removeIfExists(prefix);
    // Sweep keys for chat entries (fitbuddyai_chat_<id>)
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('fitbuddyai_chat_')) {
          try { sessionStorage.removeItem(k); } catch {}
        }
      }
    } catch {}
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('fitbuddyai_chat_')) {
          try { localStorage.removeItem(k); } catch {}
        }
      }
    } catch {}
    // No user -> nothing to back up, but clear any pending timer
    if (backupTimeout) {
      clearTimeout(backupTimeout);
      backupTimeout = null;
    }
    // Clear auth token helper
    try { clearAuthToken(); } catch {}

    // Broadcast clear event
    try { const bc = new BroadcastChannel('fitbuddyai'); bc.postMessage({ type: 'user-clear', timestamp: Date.now() }); bc.close(); } catch {}
  } catch (error) {
    console.warn('Failed to clear user data:', error);
  }
};

export const loadHomeIntroEnabled = (): boolean => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.HOME_INTRO_ENABLED);
    if (saved === null) return false;
    return saved !== '0';
  } catch (_error) {
    return false;
  }
};

export const saveHomeIntroEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.HOME_INTRO_ENABLED, enabled ? '1' : '0');
    window.dispatchEvent(new CustomEvent('fitbuddyai-home-intro-changed', { detail: { enabled } }));
  } catch (_error) {
    console.warn('Failed to save home intro preference');
  }
};

// Auth token helpers (sessionStorage first, with a time-limited persisted fallback)
export const saveAuthToken = (token: string | null) => {
  try {
    if (!token) return;
    // Do NOT persist access tokens to storage in cleartext. Keep tokens in-memory only.
    try { (window as any).fitbuddyai_access_token = String(token); } catch {}
  } catch (e) {
    // ignore
  }
};

export const getAuthToken = (): string | null => {
  try {
    // Prefer in-memory token; do not read tokens from persistent storage.
    const t = (window as any).fitbuddyai_access_token;
    return t || null;
  } catch (e) {
    return null;
  }
};

export const clearAuthToken = () => {
  try { (window as any).fitbuddyai_access_token = null; } catch {}
};

export const saveSupabaseSession = (session: any | null) => {
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_KEYS.SUPABASE_SESSION);
      return;
    }
    const payload: any = {
      expires_at: session.expires_at ?? (session.expires_in ? Math.round(Date.now() / 1000) + Number(session.expires_in || 0) : undefined)
    };
    localStorage.setItem(STORAGE_KEYS.SUPABASE_SESSION, JSON.stringify(payload));
  } catch (error) {
    console.warn('[localStorage] saveSupabaseSession failed:', error);
  }
};

export const loadSupabaseSession = (): { expires_at?: number } | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPABASE_SESSION);
    if (!raw) return null;
    return safeParseStored(raw);
  } catch (error) {
    return null;
  }
};

export const clearSupabaseSession = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.SUPABASE_SESSION);
  } catch (error) {
    // ignore
  }
};

// Workout Plan
export const saveWorkoutPlan = (workoutPlan: any): void => {
  try {
    // Normalize plan: ensure dates are strings and strip functions/circular refs
    const normalizePlanForStorage = (plan: any) => {
      if (!plan) return plan;
      const clone: any = {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        startDate: typeof plan.startDate === 'string' ? plan.startDate : (plan.startDate ? new Date(plan.startDate).toISOString().split('T')[0] : undefined),
        endDate: typeof plan.endDate === 'string' ? plan.endDate : (plan.endDate ? new Date(plan.endDate).toISOString().split('T')[0] : undefined),
  // prefer an explicit totalDays, otherwise derive from filtered dailyWorkouts length
        totalDays: typeof plan.totalDays === 'number' ? plan.totalDays : (Array.isArray(plan.dailyWorkouts) ? plan.dailyWorkouts.filter(Boolean).length : undefined),
        totalTime: plan.totalTime,
        weeklyStructure: Array.isArray(plan.weeklyStructure) ? plan.weeklyStructure.slice() : [],
        // filter out null/undefined entries (handles sparse arrays created by index assignments)
          dailyWorkouts: Array.isArray(plan.dailyWorkouts) ? plan.dailyWorkouts.filter(Boolean).map((d: any) => ({
            date: typeof d?.date === 'string' ? d.date : (d?.date ? new Date(d.date).toISOString().split('T')[0] : ''),
            type: d?.type,
            types: Array.isArray(d?.types) ? d.types.filter(Boolean).slice(0, 4) : (d?.type ? [d.type] : []),
            completed: !!d?.completed,
            completedTypes: Array.isArray(d?.completedTypes) ? d.completedTypes.filter(Boolean) : [],
            energyRewarded: d?.energyRewarded ? true : undefined,
            totalTime: d?.totalTime || '',
            streakSaverBridge: d?.streakSaverBridge ? true : undefined,
            workouts: Array.isArray(d?.workouts) ? d.workouts.filter(Boolean).map((w: any) => ({
              name: w?.name ?? '',
              description: w?.description ?? '',
            difficulty: w?.difficulty ?? 'beginner',
            duration: w?.duration ?? '',
            reps: w?.reps ?? '',
            muscleGroups: Array.isArray(w?.muscleGroups) ? w.muscleGroups : (w?.muscleGroups ? [w.muscleGroups] : []),
            equipment: Array.isArray(w?.equipment) ? w.equipment : (w?.equipment ? [w.equipment] : []),
            sets: typeof w?.sets === 'number' ? w.sets : undefined,
            rest: w?.rest || undefined
          })) : [],
          alternativeWorkouts: Array.isArray(d?.alternativeWorkouts) ? d.alternativeWorkouts.filter(Boolean).map((w: any) => ({
            name: w?.name ?? '',
            description: w?.description ?? '',
            difficulty: w?.difficulty ?? 'beginner',
            duration: w?.duration ?? '',
            reps: w?.reps ?? '',
            muscleGroups: Array.isArray(w?.muscleGroups) ? w.muscleGroups : (w?.muscleGroups ? [w.muscleGroups] : []),
            equipment: Array.isArray(w?.equipment) ? w.equipment : (w?.equipment ? [w.equipment] : []),
            sets: typeof w?.sets === 'number' ? w.sets : undefined,
            rest: w?.rest || undefined
          })) : []
        })) : []
      };
      return clone;
    };

    const normalized = normalizePlanForStorage(workoutPlan);
    const payload = { data: normalized, timestamp: Date.now() };
    const serialized = JSON.stringify(payload);
    // Write to sessionStorage (cleared on sign-out)
    sessionStorage.setItem(STORAGE_KEYS.WORKOUT_PLAN, serialized);
    try { localStorage.removeItem(STORAGE_KEYS.WORKOUT_PLAN); } catch {}

    // Verify round-trip parse to detect any truncation or invalid JSON
    try {
      const round = sessionStorage.getItem(STORAGE_KEYS.WORKOUT_PLAN);
      if (!round) throw new Error('Written value missing');
      JSON.parse(round);
    } catch (e) {
      // If verification fails, remove the bad entry and warn
      console.warn('Workout plan verification failed after save; removing corrupted key.', e);
      try { sessionStorage.removeItem(STORAGE_KEYS.WORKOUT_PLAN); } catch {}
      return;
    }

    // schedule cloud backup (if user signed in)
    scheduleBackup();
    try {
      if (typeof window !== 'undefined' && window?.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('fitbuddyai-workout-plan-updated', { detail: { plan: normalized } }));
      }
    } catch {}
  } catch (error) {
    console.warn('Failed to save workout plan:', error);
  }
};

export const loadWorkoutPlan = (): any | null => {
  try {
  const saved = sessionStorage.getItem(STORAGE_KEYS.WORKOUT_PLAN);
  if (!saved) return null;
  console.log('[localStorage] loadWorkoutPlan -> raw length:', saved.length);

  const parsed = safeParseStored<{ data: any; timestamp: number }>(saved);
  if (!parsed) return null;
  const { data, timestamp } = parsed;
    
    // Check if data is older than 30 days
    const isExpired = Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000;
    if (isExpired) {
      clearWorkoutPlan();
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Failed to load workout plan:', error);
    return null;
  }
};

export const clearWorkoutPlan = (): void => {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.WORKOUT_PLAN);
    try { localStorage.removeItem(STORAGE_KEYS.WORKOUT_PLAN); } catch {}
    scheduleBackup();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fitbuddyai-workout-plan-updated', { detail: { plan: null } }));
      }
    } catch {}
  } catch (error) {
    console.warn('Failed to clear workout plan:', error);
  }
};

// Clear all data
export const clearAllData = (): void => {
  clearQuestionnaireProgress();
  clearUserData();
  clearWorkoutPlan();
};

// Chat helpers: append a message to the per-user chat key and also ensure the unified payload
export const appendChatMessage = (message: { role: string; text: string; ts?: number }, opts?: { userId?: string }) => {
  try {
    const uid = opts?.userId || (() => {
      try { const raw = sessionStorage.getItem(STORAGE_KEYS.USER_DATA); return raw ? (JSON.parse(raw).data?.id || null) : null; } catch { return null; }
    })();
    const key = `fitbuddyai_chat_${uid || 'anon'}`;
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    let arr: any[] = [];
    if (raw) {
      try { arr = JSON.parse(raw); if (!Array.isArray(arr)) arr = []; } catch { arr = []; }
    }
    const toPush = { role: message.role, text: message.text, ts: message.ts || Date.now() };
    arr.push(toPush);
      try { sessionStorage.setItem(key, JSON.stringify(arr)); } catch { /* noop if sessionStorage fails */ }

    // Also persist in the unified user payload under payload.chat_history so cloudBackup saves it
    try {
      const rawUd = sessionStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (rawUd) {
        try {
          const parsed = JSON.parse(rawUd);
          parsed.chat_history = parsed.chat_history || [];
          parsed.chat_history.push(toPush);
          try { sessionStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(parsed)); } catch {}
        } catch {}
      }
    } catch (e) { /* ignore */ }

    // schedule cloud backup so server receives the new chat history
    scheduleBackup();
  } catch (e) {
    console.warn('appendChatMessage failed', e);
  }
};

// Save acceptance flags into unified payload and schedule backup
export const setAcceptanceFlags = (accepted: { accepted_terms?: boolean; accepted_privacy?: boolean }) => {
  try {
    const rawUd = sessionStorage.getItem(STORAGE_KEYS.USER_DATA);
    const parsed: any = rawUd ? JSON.parse(rawUd) : { data: null, timestamp: Date.now() };
    parsed.accepted_terms = accepted.accepted_terms ?? parsed.accepted_terms ?? null;
    parsed.accepted_privacy = accepted.accepted_privacy ?? parsed.accepted_privacy ?? null;
    try { sessionStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(parsed)); } catch {}
    scheduleBackup();
  } catch (e) {
    console.warn('setAcceptanceFlags failed', e);
  }
};
