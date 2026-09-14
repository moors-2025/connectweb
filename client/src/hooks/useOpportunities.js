import { useAsync } from "./useAsync";
import { api } from "../lib/api";

// Fetches the opportunity catalogue for the given filters, re-fetching
// whenever the filters change. Keeps Opportunities.jsx focused on rendering.
export function useOpportunities(filters) {
  const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const key = JSON.stringify(cleanFilters);

  const { data, loading, error, refetch } = useAsync(
    () => api.listOpportunities(cleanFilters),
    [key]
  );

  return { opportunities: data || [], loading, error, refetch };
}
