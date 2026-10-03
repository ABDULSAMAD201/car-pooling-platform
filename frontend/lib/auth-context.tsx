"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  ApiError,
  fetchMe,
  login as loginRequest,
  register as registerRequest,
  setAuthToken,
  updateProfile as updateProfileRequest,
  type AuthResponse,
  type User,
  type UserRole,
} from "@/lib/api";

const TOKEN_STORAGE_KEY = "carpool.token";

interface StoredSession {
  token: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** True until the stored session has been checked against the backend. */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    email: string;
    password: string;
    full_name?: string;
    phone?: string;
    role?: UserRole;
  }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateProfile: (changes: Partial<User>) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on mount and validate the token against the backend.
  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      setLoading(false);
      return;
    }

    setAuthToken(stored.token);
    let cancelled = false;

    fetchMe()
      .then((user) => {
        if (cancelled) return;
        const next = { token: stored.token, user };
        setSession(next);
        window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(next));
      })
      .catch((error) => {
        if (cancelled) return;
        // Only drop the session when the token is genuinely rejected; a
        // network blip should not sign the user out.
        if (error instanceof ApiError && error.status === 401) {
          setAuthToken(null);
          setSession(null);
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((result: AuthResponse) => {
    const next: StoredSession = { token: result.access_token, user: result.user };
    setAuthToken(result.access_token);
    setSession(next);
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(next));
    return result.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginRequest({ email, password });
      return persist(result);
    },
    [persist]
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      full_name?: string;
      phone?: string;
      role?: UserRole;
    }) => {
      const result = await registerRequest(input);
      return persist(result);
    },
    [persist]
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setSession(null);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, []);

  const refresh = useCallback(async () => {
    const user = await fetchMe();
    setSession((current) => {
      if (!current) return current;
      const next = { token: current.token, user };
      window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateProfile = useCallback(async (changes: Partial<User>) => {
    const user = await updateProfileRequest(changes);
    setSession((current) => {
      if (!current) return current;
      const next = { token: current.token, user };
      window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      loading,
      login,
      register,
      logout,
      refresh,
      updateProfile,
    }),
    [session, loading, login, register, logout, refresh, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}