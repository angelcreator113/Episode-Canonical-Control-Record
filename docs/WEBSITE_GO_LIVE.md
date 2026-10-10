# Website media: go-live checklist

- **Date:** 2026-10-10
- **For:** Evoni. Every step below is a production action only she performs (CLAUDE.md non-negotiables). No session runs any of it.
- **Builds on:** W1 #2820 (the plan, `docs/reads/2026-10-10-website-content-read.md` §2), W2 #2821 (slots table, admin routes, public endpoint), W3 #2822 (the Website admin page and the landing page reading published media).

This is the W1 §2 checklist, narrowed to what W2 and W3 actually shipped. Code is cited by name.

## What works today, before any of this

- The landing page (`/`) shows its bundled defaults. `PublicLanding` asks `GET /api/v1/public/site-content`; with no published slots it gets `{ slots: {} }` and keeps the defaults.
- On the Website page (`/website`, Sidebar → WORLD → Website), **YouTube links work now** for the featured video: they need no storage.
- **Every upload is refused** (image, clip, poster, captions) with `503 SITE_STORAGE_NOT_CONFIGURED` and the message "Website uploads are off until the public site storage is set up". This is `websiteSlotService.requireStorage`. There is no `data:` URL fallback.

## 1. Run the migration

The `website_slots` table comes from `src/migrations/20261010150000-create-website-slots.js`. It is created by the normal migration run on deploy. Until it exists, the Website page cannot list its slots, and the public endpoint answers `{ slots: {} }`, so the landing page is unaffected.

## 2. Storage (AWS console or IaC)

1. **Choose the location.** Either a prefix in an existing bucket (`s3://<bucket>/site-public/`) or a dedicated bucket. Nothing else should live under that prefix.
2. **CloudFront in front of it.**
   - Use Origin Access Control on the bucket.
   - Restrict the behaviour to path pattern `site-public/*`.
   - **Leave the origin path empty.** The app builds URLs as `https://<cdn>/<prefix>/<file>` (`websiteSlotService.publicUrl`), so the key already carries the prefix. An origin path of `/site-public` would double it and every image would 404.
   - Use a cache policy that respects the object's `Cache-Control`. Uploads are written with `public, max-age=31536000, immutable`, and keys are never reused.
   - Add a response-headers policy with `X-Content-Type-Options: nosniff`.
3. **Bucket policy.** Grant `s3:GetObject` on `<bucket>/site-public/*` only: to the CloudFront distribution (OAC) or to the public. Grant no `ListBucket`. Keep Block Public Access on for every other prefix.
4. **The app's IAM role.** Grant `s3:PutObject` on `<bucket>/site-public/*` only. The app never deletes site media (replacing a file writes a new key), so `DeleteObject` is not needed.
5. **CORS: none needed.** The page shows media with `<img>`, `<video>` and `<track>`, and never reads pixels.

## 3. Server `.env`

| Variable | Value | Required |
|---|---|---|
| `SITE_PUBLIC_BUCKET` | the bucket name | **yes**: uploads stay off until it is set |
| `SITE_PUBLIC_PREFIX` | the prefix, without slashes | no; default `site-public` |
| `SITE_PUBLIC_CDN` | the CloudFront domain, e.g. `dxxxx.cloudfront.net` (with or without `https://`) | **yes if the bucket is private behind OAC**. Without it the app hands out plain S3 object URLs, which only load if the prefix is public. |
| `AWS_REGION` | the bucket's region | already set; default `us-east-1` |
| `FFPROBE_BIN` | path to `ffprobe` | no; default `ffprobe` on `PATH` |

Restart the app after editing (Evoni's own PM2 step).

## 4. ffprobe on the server

Video clips are measured with `ffprobe` before they are accepted (`websiteSlotService.clipSeconds`). A clip it cannot measure is refused. Install it with the server's package manager (`ffmpeg` provides it). Check with `ffprobe -version`.

## 5. Check it works

1. **Public endpoint, logged out.** Run `curl -i https://<site>/api/v1/public/site-content`. Expect `200`, `Cache-Control: public, max-age=300, stale-while-revalidate=3600`, an `ETag`, and `{"slots":{}}` while nothing is published.
2. **Upload.** On `/website`, upload a small image to the hero slot. It should save as a draft, with no 503.
3. **The URL.** Open the draft's image URL from the page in a private window. It should load from the CDN domain.
4. **Draft preview.** Signed in, `/site-preview?drafts=1` shows drafts. `/site-preview` shows only what visitors see. Signed in, `/` is the studio dashboard, not the landing page.
5. **Publish.** Add alt text and publish. Within five minutes (the endpoint's cache), `/` in a private window shows it.
6. **A clip.** Try a clip over 30 seconds or over 25 MB: refused. A clip of 30 seconds or less needs a poster (and captions if "has speech" is on) before it will publish.

## Limits (as built)

Images (and posters) are at most 5 MB. A clip is at most 30 seconds and 25 MB. Captions are a WebVTT file of at most 200 KB. Alt text is at most 300 characters. These are constants at the top of `websiteSlotService`. Changing them is a code change.

## Still open (not blocking go-live)

- **Logo slot.** On the Website page, "Use the logo from Show Settings" copies a show's logo into the public site storage as a draft. Like any upload, it needs the storage above. It is a copy, so after a later change in Show Settings, use it again. Deciding whether the site's logo should be the show's logo or a Prime Studios mark is Evoni's call.
- **W1 questions:**
  - Should an existing CloudFront distribution be reused?
  - Are the size caps right?
  - Should the brand_fashion style sheet update itself?
