import { createContext, useContext, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // The actual JWT never lives here: the server sets it as an httpOnly cookie,
  // which this page's JavaScript cannot read, so an XSS payload can't steal it
  // the way it could when the token sat in sessionStorage. `user` is not
  // sensitive (no password/token in it) and is kept in sessionStorage purely so
  // a page refresh doesn't lose "who's logged in" state; the browser resends
  // the real cookie automatically on every request regardless.
  const [user, setUser] = useState(() => {
    const raw = sessionStorage.getItem("pvc_user");
    return raw ? JSON.parse(raw) : null;
  });

  const persist = (u) => {
    setUser(u);
    sessionStorage.setItem("pvc_user", JSON.stringify(u));
  };

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    persist(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.register(payload);
    persist(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem("pvc_user");
    api.logout().catch(() => {
      // Best-effort: even if this fails (e.g. offline), local state is already
      // cleared, and the cookie will simply expire on its own in 7 days.
    });
  }, []);

  // Kept as a boolean, non-secret marker (never the real token) so existing
  // consumers that read `token` as a "does a session exist?" signal, or use it
  // in a dependency array to refetch after login, keep working unchanged.
  const token = user ? "session" : null;

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
