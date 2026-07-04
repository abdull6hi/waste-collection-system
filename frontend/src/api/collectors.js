import client from './client.js';

export const getMyProfile  = () => client.get('/api/collectors/me');
export const getMyResidents = () => client.get('/api/collectors/me/residents');
