import client from './client.js';

export const getAll      = (params)   => client.get('/api/schedules', { params });
export const getOne      = (id)       => client.get(`/api/schedules/${id}`);
export const create      = (data)     => client.post('/api/schedules', data);
export const update      = (id, data) => client.put(`/api/schedules/${id}`, data);
export const remove      = (id)       => client.delete(`/api/schedules/${id}`);
export const getMine     = ()         => client.get('/api/schedules/mine');
export const getByZone   = (zoneId)   => client.get(`/api/schedules/zone/${zoneId}`);
