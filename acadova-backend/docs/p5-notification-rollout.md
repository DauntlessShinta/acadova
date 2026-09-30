# P5 notification rollout (manual production checklist)

MongoDB `notifications` is authoritative. OneSignal is optional push delivery. This document does not execute production database or OneSignal changes.

## Configure

- Backend: retain `MONGO_URI`, `FRONTEND_URL`, `NODE_ENV=production`; add `ONESIGNAL_APP_ID`, backend-only `ONESIGNAL_REST_API_KEY`, and a stable random `ONESIGNAL_IDENTITY_SECRET` of at least 32 characters. Keep the secret across deploys; rotating it changes every push alias and requires users to sign in again on each device. Set `MESSAGE_PUSH_COOLDOWN_MINUTES` (default 5), `UNREAD_REMINDER_MINUTES` (default 30), and `SESSION_REMINDER_MINUTES` (default 45) only if needed.
- Frontend build: set public `VITE_ONESIGNAL_APP_ID` to the same app ID. Never put the REST key or identity secret in Vite variables. Browser push requires HTTPS in production. Without push configuration, in-app notifications still work.
- In the OneSignal dashboard, configure the deployed frontend site origin (`https://acadova-ze91.onrender.com` if that remains the live frontend) as the Web Push site URL/origin and complete provider-specific web push setup. Confirm the deployed frontend serves `/push/onesignal/OneSignalSDKWorker.js` on that same origin. This dedicated service-worker path/scope is used by the SDK; do not replace an existing root worker without review. Permission is requested only when a signed-in user clicks “Enable browser alerts.”
- The Web SDK does not support OneSignal's signed identity verification. Acadova therefore gives the authenticated browser an opaque HMAC alias through `/api/notifications/push-identity`; the backend targets that alias rather than a guessable MongoDB User ID. The alias is an identity bearer, so keep the frontend origin and JWT secure. Neither the REST key nor identity secret is returned by the API.

## Indexes before enabling production writes

The new Notification and SessionMessage indexes are not automatically built in production. Have an operator inspect current index names and data, then create the following in the correct Acadova database, during a maintenance window. The unique event-key index is correctness-critical for retry deduplication; do not enable P5 writes before it exists. The other indexes support own-user listing, unread counts, worker scans, and chat read updates.

```javascript
db.notifications.createIndex({ eventKey: 1 }, { unique: true, name: 'uniq_notification_event_key' })
db.notifications.createIndex({ recipient: 1, createdAt: -1 })
db.notifications.createIndex({ recipient: 1, readAt: 1, createdAt: -1 })
db.notifications.createIndex({ pushStatus: 1, pushAttemptedAt: 1 })
db.sessionmessages.createIndex({ session: 1, sender: 1, unreadForRecipient: 1, createdAt: 1 })
db.sessionmessages.createIndex({ unreadForRecipient: 1, createdAt: 1 })
```

Check for duplicate non-null `eventKey` values before creating the unique index. No historical notification/message backfill is required. The reminder scan only considers messages explicitly marked unread by P5.

## Reminder worker

Schedule `npm run notifications:scan` in `acadova-backend` about every 5 minutes with the same backend environment and database. It scans due scheduled Sessions, older unread chat bursts, and pending/failed push attempts; event keys make repeats and restarts safe. Do not run it inside every web process or use an in-memory-only timer. If no scheduler is configured, normal event notifications still work but upcoming/unread reminders will not be generated. Verify a single successful worker invocation before relying on reminders.

## Smoke test and rollback

With two verified Student accounts, request and accept a Session, exchange a chat message, open each account's bell, mark an item read, and verify the other account cannot access that item. Opt in to browser alerts on one device, then confirm push reaches only that account while the MongoDB record remains readable. Check cooldown with rapid messages. In a non-production test Session, schedule a near-future time and run the worker twice; only one reminder per participant/occurrence should appear. Read chat before the unread cutoff to confirm no unread reminder. Verify dispute resolution, learning approval, and account status notifications without private notes in push.

If OneSignal fails, disable its credentials; in-app records remain available. To pause reminders, stop the scheduled worker without deleting Notification data. To roll back application code, retain the new collections/fields/indexes for safe later re-deployment; do not drop production data. Already accepted external pushes cannot be recalled.
