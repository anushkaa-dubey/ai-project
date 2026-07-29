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
      <div class="prediction-layout fade-in">
        <!-- Input Panel (Left) -->
        <div style="display: flex; flex-direction: column; gap: 24px; padding-bottom: 24px;">
          <div class="premium-card">
            <div class="premium-section-title">Process Variables</div>
            
            <!-- Full-width Grade Selector -->
            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label" style="font-size: 12px;">Target Paper Grade</label>
              <select class="form-select" id="pred-grade" onchange="PredictionPage.applyGradeDefaults()" style="font-size: 14px; padding: 10px 12px; background: rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.1);">
                <option value="45">45 GSM — Newsprint</option>
                <option value="60">60 GSM — Book Paper</option>
                <option value="80" selected>80 GSM — Office Paper</option>
                <option value="120">120 GSM — Card Stock</option>
              </select>
            </div>

            <!-- Machine Section -->
            <div style="margin-bottom: 24px;">
              <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Machine</div>
              <div class="form-grid form-grid-2" style="gap: 12px;">
                ${inputField('Machine Speed', 'pred-machine_speed', 670, 'm/min', 350, 1100)}
                ${inputField('Stock Flow', 'pred-stock_flow', 348, 'L/min', 150, 550)}
              </div>
            </div>

            <!-- Process Section -->
            <div style="margin-bottom: 24px;">
              <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Process</div>
              <div class="form-grid form-grid-2" style="gap: 12px;">
                ${inputField('Headbox Pressure', 'pred-headbox_pressure', 0.55, 'bar', 0.25, 0.90, 0.01)}
                ${inputField('Steam Pressure', 'pred-steam_pressure', 5.05, 'bar', 2.8, 7.5, 0.1)}
                ${inputField('Dryer Temp', 'pred-dryer_temperature', 128, '°C', 95, 165)}
              </div>
            </div>

            <!-- Material Section -->
            <div style="margin-bottom: 16px;">
              <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Material</div>
              <div class="form-grid form-grid-2" style="gap: 12px;">
                ${inputField('Moisture', 'pred-moisture', 4.75, '%', 2.0, 9.5, 0.1)}
                ${inputField('Pulp Consistency', 'pred-pulp_consistency', 0.76, 'frac', 0.35, 1.05, 0.01)}
                ${inputField('Current BW', 'pred-basis_weight', 80, 'g/m²', 30, 150)}
              </div>
            </div>
            
            <!-- Hidden context fields for backward compatibility -->
            <input type="hidden" id="pred-prev_grade" value="80" />
            <input type="hidden" id="pred-next_grade" value="80" />
            <input type="hidden" id="pred-time_since_grade_change" value="120" />
            <input type="hidden" id="pred-is_transition" value="0" />

            <!-- Sticky Bottom Actions -->
            <div class="sticky-bottom-bar">
              <button class="btn btn-primary btn-full" onclick="PredictionPage.runPredict()" style="padding: 12px; font-size: 14px; border-radius: 8px;">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style="margin-right:4px;"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/></svg>
                Run Prediction
              </button>
              <button class="btn btn-secondary btn-full" onclick="PredictionPage.applyGradeDefaults()" style="padding: 12px; font-size: 13px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">Reset Defaults</button>
            </div>
          </div>
        </div>

        <!-- Results Panel (Right) -->
        <div id="pred-results" style="display:flex; flex-direction:column;">
          <div class="premium-card" style="display:flex;flex:1;align-items:center;justify-content:center;color:var(--text-muted);flex-direction:column;gap:16px;min-height:500px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="64" height="64" style="opacity:0.3; color:var(--accent);">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div style="font-size:15px; font-weight:500; color:var(--text-secondary);">Enter process variables and run the model.</div>
            <div style="font-size:13px;">The AI will predict the outcome based on current parameters.</div>
          </div>
        </div>
      </div>`;
  }

  function inputField(label, id, def, unit, min, max, step=1) {
    return `
      <div class="form-group">
        <label class="form-label" style="font-size:12px;">${label} <span style="color:var(--text-muted);font-weight:400;text-transform:none;">[${unit}]</span></label>
        <input type="number" class="form-input" id="${id}" value="${def}" min="${min}" max="${max}" step="${step}" style="font-size:14px;padding:8px 12px;background:rgba(0,0,0,0.2);border-color:rgba(255,255,255,0.1);" />
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
      <div class="fade-in" style="display:flex;flex-direction:column;gap:24px;">
        <!-- Premium Summary Panel -->
        <div class="premium-card" style="border-top: 4px solid ${r.status==='SAFE'?'var(--safe)':r.status==='WARNING'?'var(--warning)':'var(--critical)'}">
          <div class="premium-section-title">
            <span>Prediction Summary</span>
            ${statusBadge(r.status)}
          </div>
          
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin-top:20px;">
            <div>
              <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Predicted Basis Weight</div>
              <div style="font-size:28px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--text-primary);line-height:1;">
                ${r.predicted_bw.toFixed(2)} <span style="font-size:14px;color:var(--text-secondary);font-weight:500;">g/m²</span>
              </div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Confidence Score</div>
              <div style="font-size:28px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--accent);line-height:1;">
                ${r.confidence}%
              </div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Target Grade</div>
              <div style="font-size:28px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--text-primary);line-height:1;">
                ${body.grade} <span style="font-size:14px;color:var(--text-secondary);font-weight:500;">GSM</span>
              </div>
            </div>
          </div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05);">
            <div>
              <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Safe Range</div>
              <div style="font-size:16px;font-weight:600;font-family:'JetBrains Mono',monospace;color:var(--safe);margin-top:4px;">${r.safe_range.low}–${r.safe_range.high} g/m²</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Deviation</div>
              <div style="font-size:16px;font-weight:600;font-family:'JetBrains Mono',monospace;color:${Math.abs(r.deviation)>2?'var(--warning)':'var(--text-primary)'};margin-top:4px;">${r.deviation>0?'+':''}${r.deviation.toFixed(3)} g/m²</div>
            </div>
          </div>
        </div>

        <!-- SHAP Explanation & Anomaly -->
        <div class="prediction-results-grid">
          <!-- Feature Importance -->
          <div class="premium-card">
            <div class="premium-section-title">Feature Impact (SHAP)</div>
            <div class="shap-bar-container" style="margin-top:16px;">
              ${shap.slice(0, 5).map(s => `
                <div class="shap-item" style="margin-bottom:12px;">
                  <span class="shap-label" style="font-size:12px;min-width:110px;">${labelMap[s.feature]||s.feature}</span>
                  <div class="shap-bar-track" style="height:6px;background:rgba(255,255,255,0.1);">
                    <div class="shap-bar-fill ${s.shap_value>0?'shap-positive':'shap-negative'}"
                      style="width:${Math.round(Math.abs(s.shap_value)/maxAbs*100)}%"></div>
                  </div>
                  <span class="shap-pct" style="font-size:12px;">${s.shap_value>0?'+':''}${s.contribution_pct}%</span>
                </div>`).join('')}
            </div>
            <div style="margin-top:16px;font-size:12px;color:var(--text-muted);">
              🔴 Increases BW · 🟢 Decreases BW
            </div>
          </div>

          <!-- Model Explanation / Anomaly -->
          <div class="premium-card">
            <div class="premium-section-title">Process Stability</div>
            <div style="display:flex;align-items:center;gap:20px;margin-top:16px;">
              <div style="position:relative;width:80px;height:80px;flex-shrink:0;">
                <svg viewBox="0 0 36 36" style="transform:rotate(-90deg);width:80px;height:80px">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3"/>
                  <circle cx="18" cy="18" r="15" fill="none"
                    stroke="${r.anomaly_prob>0.6?'var(--critical)':r.anomaly_prob>0.3?'var(--warning)':'var(--safe)'}"
                    stroke-width="3" stroke-dasharray="94 94"
                    stroke-dashoffset="${94-(r.anomaly_prob*94)}" stroke-linecap="round"/>
                </svg>
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--text-primary)">${Math.round(r.anomaly_prob*100)}%</div>
              </div>
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:700;margin-bottom:4px;color:${r.anomaly_prob>0.5?'var(--critical)':r.anomaly_prob>0.3?'var(--warning)':'var(--safe)'}">
                  ${r.anomaly_prob>0.6?'High Instability Risk':r.anomaly_prob>0.3?'Moderate Instability':'Stable Process'}
                </div>
                <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">
                  The isolation forest model evaluates current variables against historical stable baselines.
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">Anomaly Score: ${r.anomaly_score.toFixed(4)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Feedback button -->
        <button class="btn btn-secondary btn-full" onclick="App.navigate('feedback')" style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border-color:rgba(255,255,255,0.08);font-size:13px;">Submit Operator Feedback →</button>
      </div>`;
  }

  function load() { render(); }

  return { load, runPredict, applyGradeDefaults };
})();
