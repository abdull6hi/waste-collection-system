import client from './client.js';

export const generate     = (data)    => client.post('/api/pickups/generate', data ?? {});
export const getAll       = (params)  => client.get('/api/pickups', { params });
export const getMine      = ()        => client.get('/api/pickups/mine');
export const getStats     = (params)  => client.get('/api/pickups/stats', { params });
export const updateStatus = (id, data) => client.patch(`/api/pickups/${id}/status`, data);
