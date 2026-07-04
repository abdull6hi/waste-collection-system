import client from './client.js';

/** Authenticated full zones list (id, name, assignment, …). */
export const getZones = () => client.get('/api/zones');

/** Public, unauthenticated list — id + name only, for the registration dropdown. */
export const getPublicZones = () => client.get('/api/zones/public');
