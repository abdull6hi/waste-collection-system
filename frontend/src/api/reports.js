import client from './client.js';

export const generate = (data) => client.post('/api/reports/generate', data);
export const list     = ()     => client.get('/api/reports');
export const getOne   = (id)   => client.get(`/api/reports/${id}`);

/** Builds a `?scope=…&entityId=…` query string from a scope object, or '' when unscoped. */
export function scopeQuery(scope) {
  if (!scope || scope.scope === 'all' || scope.entityId == null) return '';
  const p = new URLSearchParams({ scope: scope.scope, entityId: String(scope.entityId) });
  return `?${p.toString()}`;
}

export async function downloadCsv(id, filename, scope) {
  const res = await client.get(`/api/reports/${id}/export.csv${scopeQuery(scope)}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename || `nema-report-${id}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
