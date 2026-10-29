// Thin fetch wrapper. All backend calls go through here so pages never build URLs themselves.
const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the NexusGraph API. Start the backend with "python run.py" in /backend.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join('; ') : data.detail;
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  scenarios: () => request('/scenarios'),
  loadScenario: (id) => request(`/scenarios/${id}/load`, { method: 'POST' }),
  reset: () => request('/reset', { method: 'POST' }),
  graph: () => request('/graph'),
  addNode: (body) => request('/nodes', { method: 'POST', body }),
  removeNode: (id) => request(`/nodes/${id}`, { method: 'DELETE' }),
  addEdge: (body) => request('/edges', { method: 'POST', body }),
  removeEdge: (id) => request(`/edges/${id}`, { method: 'DELETE' }),
  addDependency: (body) => request('/dependencies', { method: 'POST', body }),
  removeDependency: (id) => request(`/dependencies/${id}`, { method: 'DELETE' }),
  simulate: (body) => request('/simulations', { method: 'POST', body }),
  mitigate: (mitigations) => request('/simulations/mitigate', { method: 'POST', body: { mitigations } }),
  recommendations: () => request('/recommendations'),
  analytics: () => request('/analytics/summary'),
  vulnerability: () => request('/analytics/vulnerability'),
};
