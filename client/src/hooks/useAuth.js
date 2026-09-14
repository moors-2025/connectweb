// Re-exported here so all custom hooks live under src/hooks/ for discoverability,
// while the AuthProvider itself stays in context/ since it also renders a provider.
export { useAuth } from "../context/AuthContext";
