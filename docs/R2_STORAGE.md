# Cloudflare R2 uploads

New files uploaded through the LMS now go to the private `codeemy-lms` R2 bucket. File content is no longer serialized as Base64 into browser storage. Metadata (`storage`, object `key`, name, MIME type, size and local access URLs) remains in the current browser demo records until database integration.

## Connected screens

- Assignment/project attachments.
- Career resumes (PDF/Word).
- Course lesson resources and Admin content-library resources, including images and videos.
- Lesson editor: upload MP4/WebM/MOV through the new video file control. Uploaded video takes precedence over an external video URL. Empty video controls preserve an existing uploaded lesson video when editing other lesson fields.
- Resource preview/download and lesson playback use the R2-backed local access route. HTTP byte ranges are forwarded for video seeking.
- Removing a resource deletes its attached R2 object before unlinking the browser record. Replaced lesson videos and removed lessons do not currently trigger automatic orphan-object cleanup; that requires durable file-reference tracking in the database phase.

## Limits and compatibility

- Documents/images/archives: 20 MB per file.
- Video files: 100 MB per file, buffered server upload. Large/resumable multipart uploads are not implemented.
- MP4/WebM are recommended for browser playback; decoding depends on the browser and the actual codec, even for accepted extensions.
- Existing Base64 attachments stay readable but are not automatically migrated.
- Pasting an external resource/video URL keeps it external; it is not copied to R2.
- Static project assets such as the logo remain in `public/`.
- Browser storage clearing loses the demo's metadata/associations, but does not delete objects already in R2. Different devices still need database/auth integration to share the LMS catalog and permissions.

## Local preview boundary

Set the five `CLOUDFLARE_R2_*` values in `.env.local`. Set `R2_LOCAL_PREVIEW_ENABLED=true` for this localhost preview. `.env.example` contains no credentials and defaults this flag to false.

`npm run dev` and `npm start` bind to `127.0.0.1`. For the existing port use `npm start -- --port 3002`, then open http://127.0.0.1:3002. Do not expose this demo server through a public tunnel.

Storage endpoints reject public hostnames, cross-origin requests and missing mutation headers. Object reads/deletes require a server-generated key-specific signature and are limited to app-generated upload keys. These signatures are local preview capabilities, not user authorization. There is no role/session enforcement on storage yet. Public production storage access remains blocked until real authentication, ownership/enrollment checks, database file references and deployment configuration are implemented. Private bucket access is not enabled publicly on Cloudflare.

## Implementation

- `src/app/api/storage/upload/route.js`: validates extension/size, reads a bounded upload and sends a private R2 PUT.
- `src/app/api/storage/object/route.js`: signed local GET/range/download and DELETE.
- `src/lib/server/r2.js`: server-only Node S3 Signature V4 requests; credentials are never returned to the browser. The R2 region is `auto`. Clock-skew errors retry using R2's reported server time; fixing the machine clock is still preferable.
- `src/lib/uploads.js`: shared frontend upload/download/delete helpers.
- No new npm dependencies were required.

Tests use isolated browser contexts and clean up only object URLs returned to that context during successful test uploads. They never bulk-delete or scan the bucket. The storage browser test uploads a real PNG and a generated WebM, checks R2-backed responses, video metadata/ranges, refresh persistence, invalid signatures and invalid upload requests. Remaining integration work includes durable upload transactions, orphan-file cleanup, per-user quotas, rate limits, malware scanning and multi-user authorization.

Implementation reference: [Cloudflare S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/).
