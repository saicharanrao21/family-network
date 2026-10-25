const adminBase = location.protocol === 'file:'
  ? 'http://localhost:3000/api/v1'
  : location.origin.replace(/:\d+$/, '') + ':3000/api/v1';

function adminRequest(path, options = {}) {
  const headers = {
    Authorization: `Bearer ${document.getElementById('token').value}`,
    ...(options.headers || {}),
  };
  return fetch(adminBase + path, { ...options, headers }).then(async (response) => {
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });
}

function renderAdminRows(elementId, rows, actions) {
  const container = document.getElementById(elementId);
  container.replaceChildren();
  if (!rows.length) {
    container.textContent = 'No open items.';
    return;
  }
  for (const row of rows) {
    const item = document.createElement('section');
    const details = document.createElement('pre');
    details.className = 'list';
    details.textContent = JSON.stringify(row, null, 2);
    item.append(details);
    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.addEventListener('click', () => action.run(row));
      item.append(button);
    }
    container.append(item);
  }
}

window.loadAll = async function loadAll() {
  const error = document.getElementById('error');
  try {
    const [overview, anomalies, reports, audit] = await Promise.all([
      adminRequest('/admin/overview'),
      adminRequest('/admin/anomalies'),
      adminRequest('/admin/reports'),
      adminRequest('/admin/audit'),
    ]);
    const metrics = document.getElementById('metrics');
    metrics.replaceChildren();
    for (const [key, value] of Object.entries(overview)) {
      if (key === 'generatedAt') continue;
      const card = document.createElement('div');
      card.className = 'card';
      const metric = document.createElement('div');
      metric.className = 'value';
      metric.textContent = String(value);
      const label = document.createElement('div');
      label.className = 'muted';
      label.textContent = key;
      card.append(metric, label);
      metrics.append(card);
    }
    renderAdminRows('anomalies', anomalies, [{
      label: 'Resolve anomaly',
      run: async (row) => {
        if (!confirm('Mark this graph anomaly as resolved?')) return;
        try {
          await adminRequest(`/admin/anomalies/${encodeURIComponent(row.id)}/resolve`, { method: 'PATCH' });
          await window.loadAll();
        } catch (failure) {
          error.textContent = failure.message;
        }
      },
    }]);
    renderAdminRows('reports', reports, [
      ...['RESOLVED', 'DISMISSED'].map((status) => ({
        label: status === 'RESOLVED' ? 'Resolve report' : 'Dismiss report',
        run: async (row) => {
          if (!confirm(`Mark this report as ${status.toLowerCase()}?`)) return;
          try {
            await adminRequest(`/admin/reports/${encodeURIComponent(row.id)}/${status}`, { method: 'PATCH' });
            await window.loadAll();
          } catch (failure) {
            error.textContent = failure.message;
          }
        },
      })),
    ]);
    document.getElementById('audit').textContent = JSON.stringify(audit, null, 2);
    error.textContent = '';
  } catch (failure) {
    error.textContent = failure.message;
  }
};

window.scan = async function scan() {
  const error = document.getElementById('error');
  try {
    await adminRequest('/admin/anomalies/scan', { method: 'POST' });
    await window.loadAll();
  } catch (failure) {
    error.textContent = failure.message;
  }
};
