export const SESSION_IDLE_MS = 60 * 60 * 1000;
export const SESSION_REFRESH_EVERY_MS = 5 * 60 * 1000;
export const SESSION_ACTIVITY_KEY = "se_last_activity";
export const SESSION_ENDED_EVENT = "shoufbayt:session-ended";

export const markSessionActivity = () => {
  try {
    sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
};

export const getLastSessionActivity = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_ACTIVITY_KEY);
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

export const clearSessionActivity = () => {
  try {
    sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
  } catch {
    // Ignore storage errors
  }
};

export const isSessionIdle = () => {
  const last = getLastSessionActivity();
  if (!last) return true;
  return Date.now() - last >= SESSION_IDLE_MS;
};
