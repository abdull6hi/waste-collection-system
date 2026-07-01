import client from './client.js';

export const submit       = (data)   => client.post('/api/complaints', data);
export const listMine     = ()       => client.get('/api/complaints/mine');
export const listAssigned = ()       => client.get('/api/complaints/assigned');
export const list         = (params) => client.get('/api/complaints', { params });
export const getOne       = (id)     => client.get(`/api/complaints/${id}`);
export const updateStatus = (id, data) => client.patch(`/api/complaints/${id}/status`, data);
export const openByZone   = ()       => client.get('/api/complaints/stats/open-by-zone');
