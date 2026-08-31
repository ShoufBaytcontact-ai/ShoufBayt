export const SESSION_IDLE_MINUTES = Math.max(
  5,
  Number.parseInt(process.env.SESSION_IDLE_MINUTES || "60", 10) || 60
);

export const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * 60 * 1000;
export const SESSION_IDLE_JWT = `${SESSION_IDLE_MINUTES}m`;
