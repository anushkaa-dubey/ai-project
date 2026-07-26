/* Operator Feedback Page */
const FeedbackPage = (() => {
  function render(data) {
    const records = data.records || [];
    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <!-- Submit Form -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-title">Submit Operator Feedback</div>
          <div class="form-grid form-grid-2" style="margin-bottom:14px">
            <div class="form-group">
              <label class="form-label">Paper Grade</label>
              <select class="form-select" id="fb-grade">
                <option value="45">45 GSM</option><option value="60">60 GSM</option>
                <option value="80" selected>80 GSM</option><option value="120">120 GSM</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Predicted BW (g/m²)</label>
              <input type="number" class="form-input" id="fb-pred-bw" value="${window.appState.lastPrediction?.predicted_bw?.toFixed(2)||'80.00'}" step="0.01" />
            </div>
            <div class="form-group">
              <label class="form-label">Actual BW Measured (optional)</label>
              <input type="number" class="form-input" id="fb-actual-bw" placeholder="Lab measurement" step="0.01" />
            </div>
            <div class="form-group">
              <label class="form-label">Operator ID</label>
              <input type="text" class="form-input" id="fb-operator" value="OP-001" />
            </div>
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label class="form-label">Recommendation Applied</label>
            <input type="text" class="form-input" id="fb-recommendation"
              value="${window.appState.lastRecommendation?.recommendations?.[0] ?
                window.appState.lastRecommendation.recommendations[0].label + ': ' +
                window.appState.lastRecommendation.recommendations[0].current_value + ' → ' +
                window.appState.lastRecommendation.recommendations[0].recommended_value + ' ' +
                window.appState.lastRecommendation.recommendations[0].unit : ''}"
              placeholder="e.g. Machine Speed: 670 → 650 m/min" />
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Comment</label>
            <textarea id="fb-comment" rows="3" placeholder="Operator notes, observations, or additional context..."></textarea>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-success" onclick="FeedbackPage.submit('accept')">
              ✓ Accept Recommendation
            </button>
            <button class="btn btn-danger" onclick="FeedbackPage.submit('reject')">
              ✗ Reject Recommendation
            </button>
          </div>
        </div>

        <!-- Feedback History -->
        <div class="card">
          <div class="card-title">Feedback History <span style="font-weight:400;color:var(--text-muted)">(${data.count} records)</span></div>
          ${records.length === 0 ? `
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="40" height="40"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
              <div>No feedback records yet. Submit your first operator feedback above.</div>
            </div>` : `
            <div style="overflow-x:auto">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Timestamp</th><th>Operator</th><th>Grade</th>
                    <th>Predicted BW</th><th>Actual BW</th><th>Recommendation</th>
                    <th>Action</th><th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  ${records.map(r => `
                    <tr>
                      <td style="color:var(--text-muted)">${r.id}</td>
                      <td>${r.timestamp.slice(0,16).replace('T',' ')}</td>
                      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${r.operator_id}</td>
                      <td><span class="kpi-badge badge-accent">${r.grade} GSM</span></td>
                      <td style="font-family:'JetBrains Mono',monospace">${r.predicted_bw?.toFixed(2)||'—'}</td>
                      <td style="font-family:'JetBrains Mono',monospace">${r.actual_bw?.toFixed(2)||'—'}</td>
                      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.recommendation}">${r.recommendation||'—'}</td>
                      <td>
                        <span class="kpi-badge ${r.action==='accept'?'badge-safe':'badge-critical'}">
                          ${r.action==='accept'?'✓ ACCEPTED':'✗ REJECTED'}
                        </span>
                      </td>
                      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.comment||''}">${r.comment||'—'}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
        </div>
      </div>`;
  }

  async function submit(action) {
    const grade   = parseInt(document.getElementById('fb-grade')?.value || '80');
    const predBW  = parseFloat(document.getElementById('fb-pred-bw')?.value || '80');
    const actualBW= parseFloat(document.getElementById('fb-actual-bw')?.value) || null;
    const rec     = document.getElementById('fb-recommendation')?.value || '';
    const comment = document.getElementById('fb-comment')?.value || '';
    const opId    = document.getElementById('fb-operator')?.value || 'OP-001';

    try {
      await api.post('/feedback', {
        grade, predicted_bw: predBW, actual_bw: actualBW,
        recommendation: rec, action, comment, operator_id: opId,
        confidence: window.appState.lastPrediction?.confidence || null,
        status: window.appState.lastPrediction?.status || null,
      });
      await load();
    } catch(e) {
      alert('Failed: ' + e.message);
    }
  }

  async function load() {
    document.getElementById('page-content').innerHTML = `<div class="loading-state"><div class="spinner"></div> Loading feedback...</div>`;
    try {
      const data = await api.get('/feedback?limit=50');
      render(data);
    } catch(e) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-critical">Cannot load feedback: ${e.message}</div>`;
    }
  }

  return { load, submit };
})();
