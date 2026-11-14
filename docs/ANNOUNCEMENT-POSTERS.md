# Announcement text and posters

Admin → Announcements → Create announcement:

1. Enter a title and a message, upload a poster, or use both.
2. PNG, JPG, WebP and GIF posters are supported up to 10 MB. Uploading shows a preview; **Save announcement** publishes it.
3. Leave course/batch empty for academy-wide Student/Mentor access. Select a course or batch for restricted publication.
4. Admin can edit the message, replace/remove the poster, or remove the announcement. A poster-only announcement needs either a replacement poster or a message before removing its only content.

Student and Mentor → Announcements show the published image and content. Notification actions open Announcements. Posters can be opened in a new tab at full size; images preserve their aspect ratio on mobile. An open announcements page refreshes every 30 seconds.

## Persistence and access

Files remain private in Cloudflare R2. The existing `announcements.message` TEXT column stores optional media using the `CODEEMY_ANNOUNCEMENT_V1:` envelope; text-only legacy announcements remain plain text. API readers decode the envelope into `message` and `image_url`. No schema migration or new environment variables are required.

The poster uploader uses an unscoped Admin upload. Server validation checks the registered image type, size and signed private URL. Reading a poster requires a published announcement visible to the actor. Read permission does not grant deletion. Removing the poster/announcement removes that audience access; the R2 object is not automatically erased, so Admin-owned storage cleanup is separate.

`scripts/verify-announcement-posters.mjs` verifies publication, persistent image playback, role notifications, batch privacy, forbidden deletion, Admin editing/removal and responsive browser rendering using temporary accounts. Academy-wide scope is checked inside a rolled-back transaction to avoid sending test notices to real users. The test removes its records/files.
