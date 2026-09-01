const DEFAULT_API = "http://localhost:8800/api";
const isProd = process.env.NODE_ENV === "production";

const trimSlash = (value) => String(value || "").replace(/\/+$/, "");

export const API_BASE = trimSlash(
  process.env.REACT_APP_API_URL || (isProd ? "/api" : DEFAULT_API)
);

export const API_ORIGIN = /^https?:\/\//i.test(API_BASE)
  ? API_BASE.replace(/\/api$/i, "") || "http://localhost:8800"
  : "";

export const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || API_ORIGIN || undefined;
