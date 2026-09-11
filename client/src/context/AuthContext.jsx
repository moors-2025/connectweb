import { createContext, useContext, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem("pvc_token"));
  const [user, setUser] = useState(() => {
    const raw = sessionStorage.getItem("pvc_user");
    return raw ? JSON.parse(raw) : null;
  });

  const persist = (t, u) => {
    setToken(t);
    setUser(u);
    sessionStorage.setItem("pvc_token", t);
    sessionStorage.setItem("pvc_user", JSON.stringify(u));
  };

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    persist(data.token, data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.register(payload);
    persist(data.token, data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem("pvc_token");
    sessionStorage.removeItem("pvc_user");
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
