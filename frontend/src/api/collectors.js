import client from './client.js';

export const getMyProfile = () => client.get('/api/collectors/me');
