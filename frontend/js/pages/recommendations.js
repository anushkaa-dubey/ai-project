/* Recommendations Page with What-If Simulator */
const RecommendationsPage = (() => {
  let simChart = null;
  const SIM_DEFAULTS = {
    machine_speed: 670, stock_flow: 348, headbox_pressure: 0.55,
    steam_pressure: 5.05, dryer_temperature: 128, moisture: 4.75,
    pulp_consistency: 0.76, grade: 80, basis_weight: 80,
  };
  const simState = { ...SIM_DEFAULTS };

  function getStatusClass(status) {
    if (status === 'CRITICAL') return 'status-critical';
    if (status === 'WARNING') return 'status-warning';
    return 'status-safe';
  }

  function formatBw(value) {
    return typeof value === 'number' ? `${value.toFixed(2)} g/m²` : '—';
  }

  function formatConfidence(rec, pred) {
    const value = typeof rec?.confidence === 'number' ? rec.confidence : typeof pred?.confidence === 'number' ? pred.confidence : null;
    return value === null ? '—' : `${value}%`;
  }

  function buildEngineReasoning(rec, pred) {
    if (!rec) {
      return 'The recommendation engine is awaiting the latest simulation result.';
    }
    if (rec.message) return rec.message;
    if (rec.recommendations && rec.recommendations.length > 0) {
      return rec.recommendations[0].reason;
    }
    return rec.status === 'SAFE'
      ? 'The current setpoints remain inside the target operating band, so no corrective action is required.'
      : 'The current operating point is outside the target band. Review the actions below.';
  }

  function getLatestSimulation() {
    return window.appState.latestSimulation || window.appState.lastPrediction || null;
  }

  function render() {
    const latestSimulation = getLatestSimulation();
    const latestRecommendation = latestSimulation?.recommendation || null;

    document.getElementById('page-content').innerHTML = `
      <div class="fade-in recommendations-shell">
        <div class="card simulator-panel">
          <div class="card-title">What-If Simulator</div>
          <div class="simulator-form-stack">
            <div class="form-group">
              <label class="form-label">Paper Grade</label>
              <select class="form-select" id="sim-grade" onchange="RecommendationsPage.simGradeChange()">
                <option value="45">45 GSM</option><option value="60">60 GSM</option>
                <option value="80" selected>80 GSM</option><option value="120">120 GSM</option>
              </select>
            </div>
            ${simSlider('Machine Speed', 'sim-ms', SIM_DEFAULTS.machine_speed, 350, 1100, 'm/min')}
            ${simSlider('Steam Pressure', 'sim-sp', SIM_DEFAULTS.steam_pressure, 2.8, 7.5, 'bar', 0.1)}
            ${simSlider('Moisture', 'sim-mo', SIM_DEFAULTS.moisture, 2.0, 9.5, '%', 0.1)}
            ${simSlider('Stock Flow', 'sim-sf', SIM_DEFAULTS.stock_flow, 150, 550, 'L/min')}
            ${simSlider('Headbox Pressure', 'sim-hp', SIM_DEFAULTS.headbox_pressure, 0.25, 0.90, 'bar', 0.01)}
          </div>
        </div>
        <div class="card action-panel" id="actions-panel"></div>
        <div class="card recommendations-panel" id="recommendations-card"></div>
        <div class="card simulator-result-panel" id="sim-result">
          <div class="card-title">Simulation Result</div>
          <div class="sim-result-placeholder">Adjust the sliders to simulate a live control scenario.</div>
        </div>
      </div>`;

    renderRecommendationPanel(latestRecommendation, latestSimulation);
    renderActionPanel(latestRecommendation);
    attachSliders();
  }

  function renderRecommendationPanel(rec, prediction) {
    const card = document.getElementById('recommendations-card');
    if (!card) return;

    const status = rec?.status || 'AWAITING INPUT';
    card.innerHTML = `
      <div class="card-title">Recommendation Engine</div>
      <div class="engine-summary">
        <div class="engine-status-pill ${getStatusClass(status)}">${status}</div>
        <div class="engine-metric-grid">
          <div class="engine-metric-card">
            <span>Predicted BW</span>
            <strong>${formatBw(prediction?.predicted_bw ?? rec?.predicted_bw)}</strong>
          </div>
          <div class="engine-metric-card">
            <span>Confidence</span>
            <strong>${formatConfidence(rec, prediction)}</strong>
          </div>
        </div>
        <div class="engine-reasoning">${buildEngineReasoning(rec, prediction)}</div>
      </div>`;
  }

  function renderActionPanel(rec) {
    const panel = document.getElementById('actions-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="card-title">Recommended Actions</div>
      <div class="recommendations-grid">
        ${renderRecCards(rec)}
      </div>`;
  }

  function getInferenceSources() {
    return [
      'Historical Production Data',
      'Correlation Analysis',
      'Process Parameters',
      'Recipe Limits',
    ];
  }

  function renderInferenceSources() {
    return `
      <div class="inference-source-block">
        <div class="inference-source-title">Inference Source</div>
        <ul class="inference-source-list">
          ${getInferenceSources().map(source => `<li>${source}</li>`).join('')}
        </ul>
      </div>`;
  }

  function renderRecCards(rec) {
    if (!rec || !rec.recommendations || rec.recommendations.length === 0) {
      return `<div class="rec-empty-card">
        <div class="rec-empty-icon">✓</div>
        <div class="rec-empty-title">No corrective action required</div>
        <div class="rec-empty-copy">The current setpoints remain within the target operating band.</div>
        ${renderInferenceSources()}
      </div>`;
    }

    return rec.recommendations.map((r, i) => `
      <div class="recommendation-card">
        <div class="rec-top">
          <div>
            <div class="rec-number">ACTION ${i + 1}</div>
            <div class="rec-param-label">${r.label}</div>
          </div>
          <span class="rec-chip">${r.unit}</span>
        </div>
        <div class="recommendation-values">
          <div class="value-pill">
            <span class="value-label">Current Value</span>
            <strong>${r.current_value} ${r.unit}</strong>
          </div>
          <div class="value-pill value-pill-accent">
            <span class="value-label">Suggested Value</span>
            <strong>${r.recommended_value} ${r.unit}</strong>
          </div>
        </div>
        <div class="recommendation-reason">${r.reason}</div>
        ${renderInferenceSources()}
        <div class="recommendation-foot">
          <div class="foot-item">
            <span>Expected Impact</span>
            <strong>${r.expected_bw_after.toFixed(2)} g/m²</strong>
          </div>
          <div class="foot-item">
            <span>Change</span>
            <strong>${r.delta > 0 ? '+' : ''}${r.delta.toFixed(2)} ${r.unit}</strong>
          </div>
        </div>
      </div>`).join('');
  }

  function simSlider(label, id, def, min, max, unit, step=1) {
    return `
      <div class="slider-group" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          <span class="form-label">${label}</span>
          <span class="slider-val" id="${id}-val">${def} ${unit}</span>
        </div>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${def}"
          oninput="RecommendationsPage.simUpdate('${id}','${unit}',${step})" />
      </div>`;
  }

  function attachSliders() {
    // already via inline oninput
  }

  function simGradeChange() {
    const g = parseInt(document.getElementById('sim-grade')?.value || '80');
    simState.grade = g;
    debouncedSimulate();
  }

  let simTimeout = null;
  function simUpdate(id, unit, step) {
    const el = document.getElementById(id);
    if (!el) return;
    const v = parseFloat(el.value);
    const displayV = step < 1 ? v.toFixed(step === 0.01 ? 2 : 1) : Math.round(v);
    document.getElementById(`${id}-val`).textContent = `${displayV} ${unit}`;

    const keyMap = { 'sim-ms': 'machine_speed', 'sim-sp': 'steam_pressure', 'sim-mo': 'moisture', 'sim-sf': 'stock_flow', 'sim-hp': 'headbox_pressure' };
    const key = keyMap[id];
    if (key) simState[key] = v;

    clearTimeout(simTimeout);
    simTimeout = setTimeout(debouncedSimulate, 300);
  }

  async function debouncedSimulate() {
    const body = {
      grade: simState.grade || 80,
      machine_speed: simState.machine_speed || 670,
      stock_flow: simState.stock_flow || 348,
      headbox_pressure: simState.headbox_pressure || 0.55,
      steam_pressure: simState.steam_pressure || 5.05,
      dryer_temperature: simState.dryer_temperature || 128,
      moisture: simState.moisture || 4.75,
      pulp_consistency: simState.pulp_consistency || 0.76,
      basis_weight: simState.basis_weight || 80,
    };
    try {
      const r = await api.post('/simulate', body);
      const simulation = {
        ...r,
        recommendation: r.recommendation || null,
        predicted_bw: r.predicted_bw,
        status: r.status,
        confidence: r.confidence,
        anomaly_prob: r.anomaly_prob,
        anomaly_score: r.anomaly_score,
      };
      window.appState.lastFeatures = body;
      window.appState.latestSimulation = simulation;
      window.appState.lastPrediction = simulation;
      window.appState.lastRecommendation = simulation.recommendation;
      renderSimResult(simulation, body);
    } catch(e) { /* silent */ }
  }

  function renderSimResult(r, body) {
    const el = document.getElementById('sim-result');
    if (!el) return;
    const statusColor = r.status==='SAFE'?'var(--safe)':r.status==='WARNING'?'var(--warning)':'var(--critical)';
    const bgColor     = r.status==='SAFE'?'rgba(65,215,150,0.10)':r.status==='WARNING'?'rgba(255,182,92,0.10)':'rgba(255,111,111,0.10)';

    el.innerHTML = `
      <div class="card-title">Simulated Prediction</div>
      <div style="background:${bgColor};border:1px solid ${statusColor}33;border-radius:8px;padding:20px;text-align:center;margin-bottom:16px">
        <div style="font-size:46px;font-weight:800;font-family:'JetBrains Mono',monospace;color:${statusColor};line-height:1">${r.predicted_bw.toFixed(2)}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">g/m² · ${r.status}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Safe range: ${r.safe_range.low}–${r.safe_range.high} g/m²</div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted)">
        <span>Deviation: <strong style="color:${Math.abs(r.deviation)>2?'var(--warning)':'var(--text-primary)'}">${r.deviation>0?'+':''}${r.deviation.toFixed(3)}</strong></span>
        <span>Grade: <strong>${body.grade} GSM</strong></span>
      </div>`;

    const latestSimulation = window.appState.latestSimulation || r;
    const latestRecommendation = latestSimulation?.recommendation || null;
    renderRecommendationPanel(latestRecommendation, latestSimulation);
    renderActionPanel(latestRecommendation);
  }

  async function submitFeedback(action, rec) {
    const pred = window.appState.lastPrediction;
    if (!pred) { alert('Please run a prediction first'); return; }

    const comment = action === 'reject' ? prompt('Reason for rejection (optional):') : null;

    try {
      await api.post('/feedback', {
        grade: window.appState.lastFeatures?.grade || 80,
        predicted_bw: pred.predicted_bw,
        recommendation: `${rec.label}: ${rec.current_value} → ${rec.recommended_value} ${rec.unit}`,
        action,
        comment: comment || '',
        confidence: pred.confidence,
        status: pred.status,
      });
      alert(`✓ Feedback "${action}" recorded successfully`);
    } catch(e) {
      alert('Failed to submit feedback: ' + e.message);
    }
  }

  function load() { render(); }
  return { load, simUpdate, simGradeChange, submitFeedback };
})();
window.RecommendationsPage = RecommendationsPage;
