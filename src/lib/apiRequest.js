import axios from "axios";
import { API_BASE } from "./apiConfig";
import { SESSION_ENDED_EVENT } from "./session";

const apiRequest = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

const AUTH_ATTEMPT_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/verify-login-code",
  "/auth/resend-login-code",
  "/auth/google",
  "/auth/forgot-password",
  "/auth/resend-reset-code",
  "/auth/verify-reset-code",
  "/auth/reset-password",
  "/auth/logout",
];

const isAuthAttempt = (url = "") =>
  AUTH_ATTEMPT_PATHS.some((path) => String(url).includes(path));

apiRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const url = error.config?.url || "";

    if (
      status === 401 &&
      !isAuthAttempt(url) &&
      (code === "SESSION_EXPIRED" ||
        code === "INVALID_TOKEN" ||
        code === "NOT_LOGGED_IN")
    ) {
      window.dispatchEvent(
        new CustomEvent(SESSION_ENDED_EVENT, {
          detail: { code: code || "SESSION_EXPIRED" },
        })
      );
    }

    return Promise.reject(error);
  }
);

export default apiRequest;
