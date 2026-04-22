export function ensureUserId<T extends Record<string, any> | null | undefined>(user: T): T {
  if (!user || typeof user !== 'object') return user;
  const fallbackId = user.user_id || user.userId || user.uid || user.sub;
  const normalized: Record<string, any> = { ...user };
  if (!normalized.id && fallbackId) normalized.id = fallbackId;
  if (!normalized.avatar && normalized.avatar_url) normalized.avatar = normalized.avatar_url;
  return normalized as T;
}
