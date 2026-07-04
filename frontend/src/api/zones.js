import client from './client.js';

/** Authenticated full zones list (id, name, assignment, …). */
export const getZones = () => client.get('/api/zones');

/** Public, unauthenticated list — id + name only, for the registration dropdown. */
export const getPublicZones = () => client.get('/api/zones/public');

/** Official-only: approved collectors for a zone (full projection with status/default). */
export const getZoneCollectors = (zoneId) => client.get(`/api/zones/${zoneId}/collectors`);

/** Public: approved collectors for a zone — id + company_name only (resident picker). */
export const getPublicZoneCollectors = (zoneId) => client.get(`/api/zones/${zoneId}/collectors/public`);

/** Official-only: approve a collector for a zone. */
export const approveZoneCollector = (zoneId, collectorId) =>
  client.post(`/api/zones/${zoneId}/collectors`, { collector_id: collectorId });

/** Official-only: remove a collector from a zone's approved list. */
export const removeZoneCollector = (zoneId, collectorId) =>
  client.delete(`/api/zones/${zoneId}/collectors/${collectorId}`);
