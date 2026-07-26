/* Prediction Page */
const PredictionPage = (() => {
  const GRADE_DEFAULTS = {
    45:  { machine_speed:900, stock_flow:225, headbox_pressure:0.35, steam_pressure:3.75, dryer_temperature:115, moisture:5.75, pulp_consistency:0.60, basis_weight:45 },
    60:  { machine_speed:800, stock_flow:280, headbox_pressure:0.44, steam_pressure:4.40, dryer_temperature:122, moisture:5.25, pulp_consistency:0.67, basis_weight:60 },
    80:  { machine_speed:670, stock_flow:348, headbox_pressure:0.55, steam_pressure:5.05, dryer_temperature:128, moisture:4.75, pulp_consistency:0.76, basis_weight:80 },
    120: { machine_speed:500, stock_flow:445, headbox_pressure:0.69, steam_pressure:5.70, dryer_temperature:137, moisture:4.25, pulp_consistency:0.88, basis_weight:120 },
  };

  function render() {
    document.getElementById('page-content').innerHTML = `
      <div class="fade-in" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <!-- Input Panel -->
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">Process Variables Input</div>
            <div class="form-group" style="margin-bottom:16px">
              <label class="form-label">Paper Grade</label>
              <select class="form-select" id="pred-grade" onchange="PredictionPage.applyGradeDefaults()">
                <option value="45">45 GSM — Newsprint</option>
                <option value="60">60 GSM — Book Paper</option>
                <option value="80" selected>80 GSM — Office Paper</option>
                <option value="120">120 GSM — Card Stock</option>
              </select>
            </div>
            <div class="form-grid form-grid-2">
              ${inputField('Machine Speed', 'pred-machine_speed', 670, 'm/min', 350, 1100)}
              ${inputField('Stock Flow', 'pred-stock_flow', 348, 'L/min', 150, 550)}
              ${inputField('Headbox Pressure', 'pred-headbox_pressure', 0.55, 'bar', 0.25, 0.90, 0.01)}
              ${inputField('Steam Pressure', 'pred-steam_pressure', 5.05, 'bar', 2.8, 7.5, 0.1)}
              ${inputField('Dryer Temp', 'pred-dryer_temperature', 128, '°C', 95, 165)}
              ${inputField('Moisture', 'pred-moisture', 4.75, '%', 2.0, 9.5, 0.1)}
              ${inputField('Pulp Consistency', 'pred-pulp_consistency', 0.76, 'frac', 0.35, 1.05, 0.01)}
              ${inputField('Current BW', 'pred-basis_weight', 80, 'g/m²', 30, 150)}
            </div>
            <div style="margin-top:16px;display:flex;gap:10px">
              <button class="btn btn-primary btn-full" onclick="PredictionPage.runPredict()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/></svg>
                Run Prediction
              </button>
              <button class="btn btn-secondary" onclick="PredictionPage.applyGradeDefaults()">Reset Defaults</button>
            </div>
          </div>

          <!-- Transition Context -->
          <div class="card">
            <div class="card-title">Grade Transition Context</div>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Previous Grade</label>
                <select class="form-select" id="pred-prev_grade">
                  <option value="45">45 GSM</option><option value="60" selected>60 GSM</option>
                  <option value="80">80 GSM</option><option value="120">120 GSM</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Next Grade</label>
                <select class="form-select" id="pred-next_grade">
                  <option value="45">45 GSM</option><option value="60">60 GSM</option>
                  <option value="80" selected>80 GSM</option><option value="120">120 GSM</option>
                </select>
              </div>
            </div>
            <div class="form-grid form-grid-2" style="margin-top:12px">
              ${inputField('Time Since Change', 'pred-time_since_grade_change', 120, 'min', 0, 600)}
              <div class="form-group">
                <label class="form-label">Transition Active</label>
                <select class="form-select" id="pred-is_transition">
                  <option value="0">No — Stable</option>
                  <option value="1">Yes — In Transition</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Results Panel -->
        <div id="pred-results">
          <div class="card" style="display:flex;align-items:center;justify-content:center;min-height:300px;color:var(--text-muted);flex-direction:column;gap:12px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="opacity:0.3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <span>Submit process variables to generate prediction</span>
          </div>
        </div>
      </div>`;
  }

  function inputField(label, id, def, unit, min, max, step=1) {
    return `
      <div class="form-group">
        <label class="form-label">${label} <span style="color:var(--text-muted)">[${unit}]</span></label>
        <input type="number" class="form-input" id="${id}" value="${def}" min="${min}" max="${max}" step="${step}" />
      </div>`;
  }

  function applyGradeDefaults() {
    const grade = parseInt(document.getElementById('pred-grade').value);
    const d = GRADE_DEFAULTS[grade];
    if (!d) return;
    Object.entries(d).forEach(([k, v]) => {
      const el = document.getElementById(`pred-${k}`);
      if (el) el.value = v;
    });
    document.getElementById('pred-next_grade').value = grade;
  }

  function getVal(id, fallback=0) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value)||fallback : fallback;
  }
  function getIntVal(id, fallback=80) {
    const el = document.getElementById(id);
    return el ? parseInt(el.value)||fallback : fallback;
  }

  async function runPredict() {
    const body = {
      grade:               getIntVal('pred-grade'),
      machine_speed:       getVal('pred-machine_speed'),
      stock_flow:          getVal('pred-stock_flow'),
      headbox_pressure:    getVal('pred-headbox_pressure'),
      steam_pressure:      getVal('pred-steam_pressure'),
      dryer_temperature:   getVal('pred-dryer_temperature'),
      moisture:            getVal('pred-moisture'),
      pulp_consistency:    getVal('pred-pulp_consistency'),
      basis_weight:        getVal('pred-basis_weight'),
      prev_grade:          getIntVal('pred-prev_grade'),
      next_grade:          getIntVal('pred-next_grade'),
      time_since_grade_change: getVal('pred-time_since_grade_change', 120),
      is_transition:       getIntVal('pred-is_transition', 0),
    };

    document.getElementById('pred-results').innerHTML = `<div class="loading-state"><div class="spinner"></div> Running prediction...</div>`;
    try {
      const r = await api.post('/predict', body);
      window.appState.lastPrediction    = r;
      window.appState.lastFeatures      = body;
      window.appState.lastRecommendation= r.recommendation;
      renderResults(r, body);
    } catch(e) {
      document.getElementById('pred-results').innerHTML =
        `<div class="alert alert-critical">Prediction failed: ${e.message}</div>`;
    }
  }

  function renderResults(r, body) {
    const statusBadge = s => {
      const cls = s==='SAFE'?'status-SAFE':s==='WARNING'?'status-WARNING':'status-CRITICAL';
      return `<span class="status-pill ${cls}">${s}</span>`;
    };

    const shap = r.shap_values || [];
    const maxAbs = Math.max(...shap.map(s => Math.abs(s.shap_value)), 0.001);
    const labelMap = {
      machine_speed:'Machine Speed', stock_flow:'Stock Flow', headbox_pressure:'HB Pressure',
      steam_pressure:'Steam Pressure', dryer_temperature:'Dryer Temp', moisture:'Moisture',
      pulp_consistency:'Pulp Consistency', bw_lag1:'BW Lag-1', bw_roll_mean5:'BW Roll Mean',
      ms_delta:'Machine Speed Δ', sp_delta:'Steam Pressure Δ',
    };

    document.getElementById('pred-results').innerHTML = `
      <div class="fade-in" style="display:flex;flex-direction:column;gap:16px">
        <!-- Main prediction card -->
        <div class="card" style="border-color:${r.status==='SAFE'?'rgba(65,215,150,0.35)':r.status==='WARNING'?'rgba(255,182,92,0.35)':'rgba(255,111,111,0.35)'}">
          <div class="card-title">Prediction Result</div>
          <div style="display:flex;align-items:flex-end;gap:16px;margin-bottom:16px">
            <div>
              <div style="font-size:48px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--text-primary);line-height:1">${r.predicted_bw.toFixed(2)}</div>
              <div style="font-size:16px;color:var(--text-secondary)">g/m²  predicted</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${statusBadge(r.status)}
              <span class="kpi-badge badge-accent">Confidence: ${r.confidence}%</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;padding-top:14px;border-top:1px solid var(--border)">
            <div><div class="kpi-label">Safe Range</div><div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--safe)">${r.safe_range.low}–${r.safe_range.high} g/m²</div></div>
            <div><div class="kpi-label">Deviation</div><div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:${Math.abs(r.deviation)>2?'var(--warning)':'var(--text-primary)'}">${r.deviation>0?'+':''}${r.deviation.toFixed(3)} g/m²</div></div>
            <div><div class="kpi-label">Anomaly Prob</div><div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:${r.anomaly_prob>0.5?'var(--critical)':'var(--text-primary)'}">${(r.anomaly_prob*100).toFixed(1)}%</div></div>
          </div>
        </div>

        <!-- SHAP Explanation -->
        <div class="card">
          <div class="card-title">SHAP Explainability — Feature Contributions</div>
          <div class="shap-bar-container">
            ${shap.map(s => `
              <div class="shap-item">
                <span class="shap-label">${labelMap[s.feature]||s.feature}</span>
                <div class="shap-bar-track">
                  <div class="shap-bar-fill ${s.shap_value>0?'shap-positive':'shap-negative'}"
                    style="width:${Math.round(Math.abs(s.shap_value)/maxAbs*100)}%"></div>
                </div>
                <span class="shap-pct">${s.shap_value>0?'+':''}${s.contribution_pct}%</span>
              </div>`).join('')}
          </div>
          <div style="margin-top:12px;font-size:11px;color:var(--text-muted)">
            🔴 Red bars push BW higher · 🟢 Green bars pull BW lower
          </div>
        </div>

        <!-- Anomaly Card -->
        <div class="card" style="border-color:${r.anomaly_prob>0.5?'rgba(239,68,68,0.3)':'var(--border)'}">
          <div class="card-title">Anomaly Detection</div>
          <div style="display:flex;align-items:center;gap:16px">
            <div style="position:relative;width:70px;height:70px">
              <svg viewBox="0 0 36 36" style="transform:rotate(-90deg);width:70px;height:70px">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" stroke-width="3"/>
                <circle cx="18" cy="18" r="15" fill="none"
                  stroke="${r.anomaly_prob>0.6?'var(--critical)':r.anomaly_prob>0.3?'var(--warning)':'var(--safe)'}"
                  stroke-width="3" stroke-dasharray="94 94"
                  stroke-dashoffset="${94-(r.anomaly_prob*94)}" stroke-linecap="round"/>
              </svg>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--text-primary)">${Math.round(r.anomaly_prob*100)}%</div>
            </div>
            <div>
              <div style="font-size:14px;font-weight:600;color:${r.anomaly_prob>0.5?'var(--critical)':r.anomaly_prob>0.3?'var(--warning)':'var(--safe)'}">
                ${r.anomaly_prob>0.6?'⚠ HIGH ANOMALY RISK':r.anomaly_prob>0.3?'⚡ MODERATE ANOMALY':'✓ Normal Process Behaviour'}
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Isolation Forest anomaly probability</div>
              <div style="font-size:12px;color:var(--text-muted)">Score: ${r.anomaly_score.toFixed(4)}</div>
            </div>
          </div>
        </div>

        <!-- Feedback button -->
        <button class="btn btn-secondary btn-full" onclick="App.navigate('feedback')">Submit Operator Feedback →</button>
      </div>`;
  }

  function load() { render(); }

  return { load, runPredict, applyGradeDefaults };
})();
