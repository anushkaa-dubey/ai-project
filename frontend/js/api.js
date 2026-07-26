/* API Client */
const API_BASE = (() => {
  const host = window.location.hostname || '127.0.0.1';
  return `http://${host}:8010`;
})();

const api = {
  async get(path) {
    const r = await fetch(`${API_BASE}${path}`);
    if (!r.ok) throw new Error(`API ${path} → ${r.status}`);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`API ${path} → ${r.status}`);
    return r.json();
  },
};

// Global state shared between pages and the decision support panel
window.appState = {
  lastPrediction:     null,
  lastFeatures:       null,
  lastRecommendation: null,
  dashboardData:      null,
};
