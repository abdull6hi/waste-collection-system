/**
 * Centralized ownership-assertion helpers.
 *
 * Each function throws a tagged error on a violation; the central error
 * middleware (error.middleware.js) maps it to a 403 response.  Using helpers
 * rather than ad-hoc inlined checks means a new endpoint can't forget the
 * check accidentally, and the rule lives in one place.
 */

class OwnershipError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OwnershipError';
    this.status = 403;
  }
}

/**
 * Assert that the complaint belongs to `user` (as resident) or to
 * `collector` (as the assigned collector).  Officials are implicitly exempt
 * (callers should skip this check when role === 'official').
 *
 * @param {object} complaint     - Row from ComplaintModel
 * @param {{ id: number, role: string }} user
 * @param {object|null} collector - Row from CollectorModel (null if not a collector)
 */
export function assertOwnsComplaint(complaint, user, collector) {
  if (user.role === 'resident') {
    if (complaint.resident_id !== user.id) {
      throw new OwnershipError('Forbidden');
    }
  } else if (user.role === 'collector') {
    if (!collector || complaint.assigned_collector_id !== collector.id) {
      throw new OwnershipError('Forbidden');
    }
  }
  // 'official' passes through
}

/**
 * Assert that `pickup` is assigned to `collector`.
 *
 * @param {object} pickup     - Row from PickupModel
 * @param {object} collector  - Row from CollectorModel
 */
export function assertOwnsPickup(pickup, collector) {
  if (pickup.collector_id !== collector.id) {
    throw new OwnershipError('Not authorized to update this pickup');
  }
}
