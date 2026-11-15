"use client";

// app/AuthProvider.js
//
// Virtual identity on the frontend side: once identity-service hands us a
// token, this is the one place that remembers it. Every other component
// reads `user`/`token` from context — nobody else touches localStorage,
// nobody else re-derives "am I logged in?" their own way.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { identityApi } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, try to pick up a session saved from last time, so a
  // page refresh doesn't boot the player back to the welcome screen.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("deepdive_token") : null;
    if (!saved) {
      setLoading(false);
      return;
    }
    identityApi
      .me(saved)
      .then(({ user }) => {
        setToken(saved);
        setUser(user);
      })
      .catch(() => window.localStorage.removeItem("deepdive_token"))
      .finally(() => setLoading(false));
  }, []);

  const applySession = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    window.localStorage.setItem("deepdive_token", nextToken);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { token, user } = await identityApi.login(email, password);
      applySession(token, user);
      return user;
    },
    [applySession]
  );

  const register = useCallback(
    async (username, email, password) => {
      const { token, user } = await identityApi.register(username, email, password);
      applySession(token, user);
      return user;
    },
    [applySession]
  );

  const continueAsGuest = useCallback(async () => {
    const { token, user } = await identityApi.guest();
    applySession(token, user);
    return user;
  }, [applySession]);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    const { user } = await identityApi.me(token);
    setUser(user);
  }, [token]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem("deepdive_token");
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, register, continueAsGuest, logout, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
