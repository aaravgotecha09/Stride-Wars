import { useState, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export function useCampaign(token) {
  const [error, setError] = useState(null);

  const authedFetch = useCallback(
    async (path, options = {}) => {
      setError(null);
      try {
        const res = await fetch(`${BACKEND_URL}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed.');
        return data;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [token]
  );

  const setRole = useCallback(
    (role) => authedFetch('/campaign/role', { method: 'POST', body: JSON.stringify({ role }) }),
    [authedFetch]
  );

  const fetchSectors = useCallback(() => authedFetch('/campaign/sectors'), [authedFetch]);

  const reinforceZone = useCallback(
    (x, y, amount) =>
      authedFetch('/campaign/garrison', { method: 'POST', body: JSON.stringify({ x, y, amount }) }),
    [authedFetch]
  );

  const sendSupply = useCallback(
    (toUsername, amount) =>
      authedFetch('/campaign/supply', { method: 'POST', body: JSON.stringify({ toUsername, amount }) }),
    [authedFetch]
  );

  const fetchScoutingReport = useCallback(() => authedFetch('/campaign/scouting'), [authedFetch]);

  const getOrders = useCallback(() => authedFetch('/campaign/orders'), [authedFetch]);

  const setOrders = useCallback(
    (sectorId, priority) =>
      authedFetch('/campaign/orders', { method: 'POST', body: JSON.stringify({ sectorId, priority }) }),
    [authedFetch]
  );

  return { error, setRole, fetchSectors, reinforceZone, sendSupply, fetchScoutingReport, getOrders, setOrders };
}
