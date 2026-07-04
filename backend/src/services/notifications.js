// Scoped email notifications: each event notifies only the people it concerns.
// Every function is fire-and-forget — it fetches its own recipients, sends in
// parallel, and swallows errors so a mail failure never affects the operation
// that triggered it. Controllers call these WITHOUT awaiting.
import * as UserModel      from '../models/user.model.js';
import * as CollectorModel from '../models/collector.model.js';
import * as ZoneModel      from '../models/zone.model.js';
import { sendMail, APP }   from '../utils/mailer.js';

const CATEGORY_LABELS = {
  missed_pickup:     'Missed pickup',
  illegal_dumping:   'Illegal dumping',
  overflowing_bin:   'Overflowing bin',
  damaged_equipment: 'Damaged equipment',
  other:             'Other',
};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Run an async side effect without blocking the caller; log but never rethrow. */
function run(fn) {
  Promise.resolve().then(fn).catch(err => console.error('[notify] error:', err.message));
}

/**
 * A new complaint was filed. Concerns: the resident (confirmation), the assigned
 * collector (if any), and county officials.
 */
export function complaintSubmitted(c) {
  run(async () => {
    const [resident, zone, officials] = await Promise.all([
      UserModel.findById(c.resident_id),
      ZoneModel.findById(c.zone_id),
      UserModel.findByRole('official'),
    ]);
    const zoneName = zone?.name ?? `Zone #${c.zone_id}`;
    const category = CATEGORY_LABELS[c.category] ?? c.category;
    const ref = c.reference_no;
    const tasks = [];

    if (resident?.email) {
      tasks.push(sendMail({
        to: resident.email,
        subject: `${APP} — complaint ${ref} received`,
        text: `Hi ${resident.name},\n\nWe've received your complaint (${ref}) about "${category}" in ${zoneName}.\n\n`
            + `You can track its status any time from your dashboard. We'll email you when it's updated.\n\n— ${APP}`,
      }));
    }

    if (c.assigned_collector_id) {
      const collector = await CollectorModel.findById(c.assigned_collector_id);
      if (collector?.user_email) {
        tasks.push(sendMail({
          to: collector.user_email,
          subject: `${APP} — new complaint ${ref} in ${zoneName}`,
          text: `A new complaint has been assigned to you.\n\nReference: ${ref}\nZone: ${zoneName}\n`
              + `Category: ${category}\n\n"${c.description}"\n\nPlease review and update its status.\n\n— ${APP}`,
        }));
      }
    }

    for (const o of officials) {
      if (!o.email) continue;
      tasks.push(sendMail({
        to: o.email,
        subject: `${APP} — new complaint ${ref} (${zoneName})`,
        text: `A new complaint was filed by ${resident?.name ?? 'a resident'} in ${zoneName}.\n\n`
            + `Reference: ${ref}\nCategory: ${category}\n\n"${c.description}"\n\n— ${APP}`,
      }));
    }

    await Promise.allSettled(tasks);
  });
}

/**
 * A complaint's status changed. Concerns: the resident who filed it.
 */
export function complaintStatusChanged(c) {
  run(async () => {
    const resident = await UserModel.findById(c.resident_id);
    if (!resident?.email) return;
    const ref = c.reference_no;
    const status = String(c.status).replace(/_/g, ' ');
    let body = `Hi ${resident.name},\n\nYour complaint ${ref} is now "${status}".`;
    if (c.status === 'resolved' && c.resolution_notes) {
      body += `\n\nResolution: ${c.resolution_notes}`;
    }
    body += `\n\n— ${APP}`;
    await sendMail({
      to: resident.email,
      subject: `${APP} — complaint ${ref} ${status}`,
      text: body,
    });
  });
}

/**
 * A collection schedule was assigned. Concerns: the collector it was assigned to.
 */
export function scheduleCreated(s) {
  run(async () => {
    const [collector, zone] = await Promise.all([
      CollectorModel.findById(s.collector_id),
      ZoneModel.findById(s.zone_id),
    ]);
    if (!collector?.user_email) return;
    const day  = DAYS[s.day_of_week] ?? `day ${s.day_of_week}`;
    const time = String(s.start_time ?? '').slice(0, 5);
    await sendMail({
      to: collector.user_email,
      subject: `${APP} — new collection schedule for ${zone?.name ?? 'a zone'}`,
      text: `A new collection schedule has been assigned to you.\n\n`
          + `Zone: ${zone?.name ?? `#${s.zone_id}`}\nDay: ${day}\nTime: ${time}\nFrequency: ${s.frequency}\n\n`
          + `It's now visible on your dashboard.\n\n— ${APP}`,
    });
  });
}

/**
 * A resident just registered. Concerns: the new resident (welcome + orientation).
 */
export function registrationWelcome(user) {
  run(async () => {
    if (!user?.email) return;
    await sendMail({
      to: user.email,
      subject: `Welcome to ${APP}`,
      text: `Hi ${user.name},\n\nYour resident account is ready. From your dashboard you can see your zone's `
          + `collection schedule and report issues like missed pickups — we'll email you as they're handled.\n\n— ${APP}`,
    });
  });
}
