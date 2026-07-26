/* Correlation Analysis Page */
const CorrelationPage = (() => {
  let heatmapChart = null;
  let gradeFilter = null;

  function render(data) {
    const { labels, pearson_matrix, spearman_matrix, bw_correlations, top_interactions, sample_size } = data;

    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <!-- Controls -->
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div>
              <div class="card-title" style="margin-bottom:4px">Correlation Analysis</div>
              <div style="font-size:12px;color:var(--text-muted)">Sample: ${sample_size.toLocaleString()} observations · Pearson & Spearman methods</div>
            </div>
            <div style="display:flex;gap:10px;align-items:center">
              <select class="form-select" id="corr-grade-filter" style="width:160px" onchange="CorrelationPage.changeGrade()">
                <option value="">All Grades</option>
                <option value="45">45 GSM</option>
                <option value="60">60 GSM</option>
                <option value="80">80 GSM</option>
                <option value="120">120 GSM</option>
              </select>
              <div class="tabs" style="margin-bottom:0;border:none">
                <div class="tab active" id="tab-pearson" onclick="CorrelationPage.switchTab('pearson')">Pearson</div>
                <div class="tab" id="tab-spearman" onclick="CorrelationPage.switchTab('spearman')">Spearman</div>
              </div>
            </div>
          </div>
        </div>

        <div class="charts-grid grid-2" style="margin-bottom:16px">
          <!-- Heatmap -->
          <div class="card">
            <div class="card-title">Correlation Heatmap</div>
            <div id="heatmap-container" class="heatmap-container"></div>
            <div style="margin-top:12px;display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text-muted)">
              <div style="display:flex;gap:0">
                ${[...Array(11)].map((_, i) => {
                  const v = (i-5)/5;
                  return `<div style="width:16px;height:8px;background:${heatmapColor(v)}"></div>`;
                }).join('')}
              </div>
              <span>-1.0 (neg)</span><span style="flex:1;text-align:center">0</span><span>+1.0 (pos)</span>
            </div>
          </div>

          <!-- BW Correlations Bar -->
          <div class="card">
            <div class="card-title">Feature Correlations with Basis Weight</div>
            <div id="bw-corr-list">
              ${Object.entries(bw_correlations)
                .sort((a,b) => Math.abs(b[1].r) - Math.abs(a[1].r))
                .map(([key, val]) => `
                  <div style="margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                      <span style="font-size:12px;color:var(--text-secondary)">${val.label}</span>
                      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${val.r>0?'var(--critical)':'var(--safe)'}">${val.r>0?'+':''}${val.r.toFixed(3)} ${val.significant?'*':''}</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill" style="width:${Math.abs(val.r)*100}%;background:${val.r>0?'var(--critical)':'var(--safe)'}"></div>
                    </div>
                  </div>`).join('')}
              <div style="font-size:10px;color:var(--text-muted);margin-top:8px">* statistically significant (p&lt;0.05)</div>
            </div>
          </div>
        </div>

        <!-- Top Interactions Table -->
        <div class="card">
          <div class="card-title">Top Feature Interaction Matrix</div>
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Feature A</th><th>Feature B</th>
                  <th>Pearson r</th><th>Strength</th><th>Direction</th>
                </tr>
              </thead>
              <tbody>
                ${top_interactions.map(t => `
                  <tr>
                    <td style="color:var(--text-primary)">${t.feature_a}</td>
                    <td style="color:var(--text-primary)">${t.feature_b}</td>
                    <td style="font-family:'JetBrains Mono',monospace;color:${t.pearson_r>0?'var(--critical)':'var(--safe)'}">${t.pearson_r>0?'+':''}${t.pearson_r}</td>
                    <td><span class="kpi-badge ${t.strength==='Strong'?'badge-warning':t.strength==='Moderate'?'badge-accent':'badge-safe'}">${t.strength}</span></td>
                    <td style="color:${t.direction==='Positive'?'var(--critical)':'var(--safe)'}">${t.direction}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    window._corrData = data;
    renderHeatmap(labels, pearson_matrix);
  }

  function heatmapColor(v) {
    // Blue(-1) → dark(0) → Red(+1)
    if (v > 0) {
      const r = Math.round(255 * v);
      return `rgba(${r},${Math.round(50*(1-v))},0,${0.3+0.7*v})`;
    } else {
      const b = Math.round(255 * (-v));
      return `rgba(0,${Math.round(150*(-v))},${b},${0.3+0.7*(-v)})`;
    }
  }

  function renderHeatmap(labels, matrix) {
    const container = document.getElementById('heatmap-container');
    if (!container) return;

    let html = '<table class="heatmap-table"><thead><tr><th></th>';
    labels.forEach(l => html += `<th>${l}</th>`);
    html += '</tr></thead><tbody>';
    matrix.forEach((row, i) => {
      html += `<tr><th style="text-align:right;padding-right:8px;color:var(--text-secondary)">${labels[i]}</th>`;
      row.forEach(v => {
        const bg = heatmapColor(v);
        const textColor = Math.abs(v) > 0.6 ? '#fff' : 'var(--text-secondary)';
        html += `<td style="background:${bg};color:${textColor}" title="${v}">${v.toFixed(2)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  async function changeGrade() {
    const g = document.getElementById('corr-grade-filter')?.value;
    gradeFilter = g ? parseInt(g) : null;
    await loadData();
  }

  async function switchTab(type) {
    document.getElementById('tab-pearson').classList.toggle('active', type==='pearson');
    document.getElementById('tab-spearman').classList.toggle('active', type==='spearman');
    const d = window._corrData;
    if (!d) return;
    renderHeatmap(d.labels, type==='pearson' ? d.pearson_matrix : d.spearman_matrix);
  }

  async function loadData() {
    const path = gradeFilter ? `/correlations?grade=${gradeFilter}` : '/correlations';
    document.getElementById('page-content').innerHTML = `<div class="loading-state"><div class="spinner"></div> Computing correlations...</div>`;
    try {
      const data = await api.get(path);
      render(data);
    } catch(e) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-critical">Failed to load correlation data: ${e.message}</div>`;
    }
  }

  async function load() { await loadData(); }
  return { load, changeGrade, switchTab };
})();
