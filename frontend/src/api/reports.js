import client from './client.js';

export const generate = (data) => client.post('/api/reports/generate', data);
export const list     = ()     => client.get('/api/reports');
export const getOne   = (id)   => client.get(`/api/reports/${id}`);

export async function downloadCsv(id, filename) {
  const res = await client.get(`/api/reports/${id}/export.csv`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename || `nema-report-${id}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
