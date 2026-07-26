/* Recommendations Page with What-If Simulator */
const RecommendationsPage = (() => {
  let simChart = null;
  const SIM_DEFAULTS = {
    machine_speed: 670, stock_flow: 348, headbox_pressure: 0.55,
    steam_pressure: 5.05, dryer_temperature: 128, moisture: 4.75,
    pulp_consistency: 0.76, grade: 80, basis_weight: 80,
  };
  const simState = { ...SIM_DEFAULTS };

  function render() {
    const lastRec = window.appState.lastRecommendation;
    const lastPred = window.appState.lastPrediction;

    document.getElementById('page-content').innerHTML = `
      <div class="fade-in" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

        <!-- Left: Recommendations -->
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">Hybrid Recommendation Engine</div>
            ${lastRec ? renderRecCards(lastRec) : `
              <div class="alert alert-info">
                <span>Run a prediction first to generate recommendations, or use the What-If Simulator to explore setpoints.</span>
              </div>
              <button class="btn btn-primary" onclick="App.navigate('prediction')">Go to Prediction →</button>
            `}
          </div>
          ${lastRec && lastRec.recommendations && lastRec.recommendations.length > 0 ? `
            <div class="card">
              <div class="card-title">Stabilisation Estimates</div>
              <div class="metric-row">
                <span class="metric-name">Estimated Time Saved</span>
                <span class="metric-val kpi-safe">${lastRec.estimated_stabilization_time_saved_min} min</span>
              </div>
              <div class="metric-row">
                <span class="metric-name">Material Waste Prevented</span>
                <span class="metric-val kpi-accent">${lastRec.estimated_material_waste_prevented_kg} kg</span>
              </div>
              <div class="metric-row">
                <span class="metric-name">Recommendation Confidence</span>
                <span class="metric-val">${lastRec.confidence}%</span>
              </div>
              <div class="metric-row">
                <span class="metric-name">Predicted BW After Action</span>
                <span class="metric-val">${lastRec.recommendations[0].expected_bw_after.toFixed(2)} g/m²</span>
              </div>
            </div>` : ''}
        </div>

        <!-- Right: What-If Simulator -->
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">What-If Simulator</div>
            <div style="margin-bottom:14px">
              <div class="form-group" style="margin-bottom:12px">
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

          <!-- Sim Result -->
          <div class="card" id="sim-result">
            <div class="card-title">Simulated Prediction</div>
            <div style="text-align:center;padding:20px;color:var(--text-muted)">Adjust sliders to simulate</div>
          </div>
        </div>
      </div>`;

    // Attach slider events
    attachSliders();
  }

  function renderRecCards(rec) {
    if (!rec.recommendations || rec.recommendations.length === 0) {
      return `<div class="alert alert-safe">✓ Basis Weight is within safe range. No corrective action required.</div>`;
    }
    const statusBadge = s => {
      const cls = s==='SAFE'?'badge-safe':s==='WARNING'?'badge-warning':'badge-critical';
      return `<span class="kpi-badge ${cls}">${s}</span>`;
    };
    return `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:10px">
        ${statusBadge(rec.status)}
        <span style="font-size:13px;color:var(--text-secondary)">Deviation: <strong style="color:${Math.abs(rec.deviation)>3?'var(--warning)':'var(--text-primary)'}">${rec.deviation>0?'+':''}${rec.deviation.toFixed(3)} g/m²</strong></span>
        <span style="font-size:13px;color:var(--text-secondary)">Confidence: <strong>${rec.confidence}%</strong></span>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${rec.recommendations.map((r, i) => `
          <div class="rec-card">
            <div class="rec-number">ACTION ${i+1}</div>
            <div class="rec-title">${r.label}</div>
            <div class="rec-change">
              <span style="color:var(--text-muted)">${r.current_value} ${r.unit}</span>
              <span style="color:var(--text-primary);margin:0 8px">→</span>
              <span style="color:var(--accent);font-weight:700">${r.recommended_value} ${r.unit}</span>
              <span style="color:${r.delta>0?'var(--critical)':'var(--safe)'}"> (${r.delta_pct > 0?'+':''}${r.delta_pct}%)</span>
            </div>
            <div class="rec-reason">${r.reason}</div>
            <div class="rec-expected-row">
              <div class="rec-expected-item">
                <span class="rec-expected-label">Expected BW After</span>
                <span class="rec-expected-val">${r.expected_bw_after.toFixed(2)} g/m²</span>
              </div>
              <div style="display:flex;gap:8px;align-items:flex-end">
                <button class="btn btn-success btn-sm" onclick="RecommendationsPage.submitFeedback('accept', ${JSON.stringify(r).replace(/"/g,'&quot;')})">✓ Accept</button>
                <button class="btn btn-danger btn-sm" onclick="RecommendationsPage.submitFeedback('reject', ${JSON.stringify(r).replace(/"/g,'&quot;')})">✗ Reject</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
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
      renderSimResult(r, body);
    } catch(e) { /* silent */ }
  }

  function renderSimResult(r, body) {
    const el = document.getElementById('sim-result');
    if (!el) return;
    const statusColor = r.status==='SAFE'?'var(--safe)':r.status==='WARNING'?'var(--warning)':'var(--critical)';
    const bgColor     = r.status==='SAFE'?'rgba(34,197,94,0.08)':r.status==='WARNING'?'rgba(245,158,11,0.08)':'rgba(239,68,68,0.08)';

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
