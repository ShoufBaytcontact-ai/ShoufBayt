import { createContext, useCallback, useEffect, useRef, useState } from "react";
import apiRequest from "../lib/apiRequest";
import {
  SESSION_ENDED_EVENT,
  SESSION_IDLE_MS,
  SESSION_REFRESH_EVERY_MS,
  clearSessionActivity,
  getLastSessionActivity,
  isSessionIdle,
  markSessionActivity,
} from "../lib/session";

export const AuthContext = createContext(null);

const sessionFieldsFromUser = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    phone: user.phone || user.agentProfile?.phone || "",
    phoneVerified: Boolean(user.phoneVerified),
    pendingPhone: user.pendingPhone || "",
    role: user.role,
    status: user.status,
    premiumTrialClaimed: user.premiumTrialClaimed,
    agentProfile: user.agentProfile || null,
  };
};

const endingSession = { current: false };

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const storedUser = sessionStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser);
    } catch (error) {
      sessionStorage.removeItem("user");
      localStorage.removeItem("user");
      return null;
    }
  });

  const lastRefreshRef = useRef(0);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const updateUser = (user) => {
    setCurrentUser(user);

    localStorage.removeItem("user");

    if (user) {
      sessionStorage.setItem("user", JSON.stringify(user));
      markSessionActivity();
      lastRefreshRef.current = Date.now();
    } else {
      sessionStorage.removeItem("user");
      clearSessionActivity();
    }
  };

  const endSession = useCallback((reason = "expired") => {
    if (endingSession.current || !currentUserRef.current) {
      return;
    }

    endingSession.current = true;
    currentUserRef.current = null;
    setCurrentUser(null);
    sessionStorage.removeItem("user");
    localStorage.removeItem("user");
    clearSessionActivity();

    apiRequest.post("/auth/logout").catch(() => {});

    const path = window.location.pathname || "";
    if (!path.startsWith("/login")) {
      const search = reason === "idle" ? "?reason=idle" : "?reason=expired";
      window.location.assign(`/login${search}`);
    }

    window.setTimeout(() => {
      endingSession.current = false;
    }, 1500);
  }, []);

  useEffect(() => {
    localStorage.removeItem("user");

    if (currentUser) {
      sessionStorage.setItem("user", JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem("user");
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    let cancelled = false;

    apiRequest
      .get(`/users/${currentUser.id}`)
      .then((res) => {
        if (cancelled || !res.data?.id) return;
        const next = sessionFieldsFromUser(res.data);
        setCurrentUser((prev) => {
          if (!prev) return prev;
          if (
            prev.role === next.role &&
            prev.username === next.username &&
            prev.avatar === next.avatar &&
            prev.phone === next.phone &&
            prev.phoneVerified === next.phoneVerified &&
            prev.status === next.status &&
            Boolean(prev.agentProfile) === Boolean(next.agentProfile)
          ) {
            return prev;
          }
          const merged = { ...prev, ...next };
          sessionStorage.setItem("user", JSON.stringify(merged));
          return merged;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const last = getLastSessionActivity();
    if (!last) {
      markSessionActivity();
    } else if (Date.now() - last >= SESSION_IDLE_MS) {
      endSession("idle");
      return undefined;
    }

    const refreshIfNeeded = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < SESSION_REFRESH_EVERY_MS) {
        return;
      }

      lastRefreshRef.current = now;
      apiRequest.post("/auth/refresh").catch(() => {});
    };

    let activityTick = 0;
    const onActivity = () => {
      if (isSessionIdle()) {
        endSession("idle");
        return;
      }

      markSessionActivity();

      const now = Date.now();
      if (now - activityTick < 1000) {
        return;
      }
      activityTick = now;
      refreshIfNeeded();
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (isSessionIdle()) {
        endSession("idle");
        return;
      }

      markSessionActivity();
      refreshIfNeeded();
    };

    const checkIdle = () => {
      if (isSessionIdle()) {
        endSession("idle");
      }
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", onVisibility);

    const timer = window.setInterval(checkIdle, 15000);

    const onSessionEnded = () => {
      endSession("expired");
    };
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
      window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    };
  }, [currentUser?.id, endSession]);

  return (
    <AuthContext.Provider value={{ currentUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const AuthContextProvider = AuthProvider;
