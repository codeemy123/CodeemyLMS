# Zoom class recording integration

Status: design only. No Zoom app, webhook, recording import or paid subscription has been connected yet.

## What the academy needs

- A Zoom account/plan supporting cloud recording and licensed meeting hosts. Assign the appropriate host licences to the mentors who conduct classes. Students do not need a paid host licence merely to attend or watch recordings in the LMS.
- Decide meeting capacity and the number of simultaneously teaching hosts before choosing licences/add-ons. Total registered LMS students and simultaneous Zoom meeting participants are different quantities.
- Enable automatic cloud recording for the intended hosts/meetings. A local/computer recording is not automatically available to the cloud-recording webhook pipeline.
- For mentors managed under the academy's Zoom account, create an account-level Server-to-Server OAuth app with the necessary recording permissions and the recording.completed subscription. For unrelated personal accounts, each account needs an appropriate authorized integration instead; one academy account token does not grant access to every mentor's personal recordings.
- Store Zoom app credentials/webhook secret server-side. Never paste secret values into chat or client code.

## Intended workflow

1. Admin schedules an LMS class and assigns its batch and mentor.
2. Store the associated Zoom meeting identity. Use the meeting UUID/occurrence and recording-file ID for recurring meetings and deduplication; do not guess the target batch from a class title or mentor name.
3. Mentor hosts the meeting with automatic cloud recording enabled.
4. Zoom processes the recording after the session. Availability is asynchronous, not guaranteed immediately when the class ends.
5. A verified recording.completed webhook acknowledges promptly and enqueues background ingestion. Do not download a long video inside the webhook response.
6. A retryable worker downloads the authorized recording and streams/multipart-uploads it to private R2 storage. The current manual upload endpoint has a 100 MB video cap; automatic recordings must use a separate large-file ingestion pipeline.
7. Persist recording metadata in PostgreSQL, linked to the exact class and batch. Keep PROCESSING, READY and FAILED states and unique Zoom file identifiers.
8. Only after the object and metadata are complete, expose a playback entry to the assigned batch and create in-app notifications for its students.
9. Authorize playback by exact batch membership/assigned mentor/Admin. A shared course ID alone is insufficient when two batches take the same course. Use private, authorized video delivery with range/seek support.

Planned schema: class_sessions Zoom meeting identity, and a class_recordings table containing class_session_id, Zoom meeting UUID, recording file ID, R2 object key, status, duration/size, timestamps and error/retry information. This schema/worker/UI is not implemented in the current task.

Existing recordings are retained according to the academy's selected policy. Do not automatically delete Zoom originals merely because a webhook was received or an upload began.

## Official references

- Automatic recording: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067954
- Cloud recording settings/licensed host prerequisites: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0065362
- Recording download pipeline: https://developers.zoom.us/blog/meeting-api-querying-tips-part4/
- Webhooks and delivery acknowledgement: https://developers.zoom.us/docs/api/webhooks/
