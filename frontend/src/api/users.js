import client from './client.js';

export const setMyZone       = (zoneId) => client.patch('/api/users/me/zone', { zone_id: zoneId });
export const updateMyProfile = (data)   => client.patch('/api/users/me', data);
export const changeMyPassword = (data)  => client.patch('/api/users/me/password', data);
