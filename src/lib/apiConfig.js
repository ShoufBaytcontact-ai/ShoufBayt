const DEFAULT_API = "http://localhost:8800/api";

const trimSlash = (value) => String(value || "").replace(/\/+$/, "");

export const API_BASE = trimSlash(
  process.env.REACT_APP_API_URL || DEFAULT_API
);

export const API_ORIGIN = API_BASE.replace(/\/api$/i, "") || "http://localhost:8800";

export const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || API_ORIGIN;
