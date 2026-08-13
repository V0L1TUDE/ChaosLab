// ChaosLab — file storage (Phase 6 + 7)
//
// Two real implementations behind one small interface:
//   - local disk (uploads/<presentationId>/<storedName>)  — Phase 6
//   - AWS S3 (a real bucket in the cloud)                 — Phase 7
//
// Which one runs is decided once, at startup, by whether AWS credentials
// are present in .env. No credentials configured -> local disk, exactly
// like before. This means the project keeps working with zero cloud setup
// (nothing to sign up for just to run it locally), while genuinely using
// S3 the moment real credentials are provided — nothing is faked either
// way, it's a real fork in behavior, not a pretend one.

const fs = require("fs");
const path = require("path");

const UPLOADS_DIR = path.join(__dirname, "uploads");

const AWS_REGION = process.env.AWS_REGION;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const useS3 = Boolean(AWS_REGION && AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

let s3Client = null;
let S3_COMMANDS = null;
if (useS3) {
  // Only required when actually used — keeps startup fast when running
  // in local-disk mode, and makes the "which mode am I in" branch obvious.
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
  S3_COMMANDS = { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command };
  // Credentials come from process.env automatically (the SDK looks for
  // AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY itself) — we never pass them
  // in directly, so they're never sitting in this file or in memory twice.
  s3Client = new S3Client({ region: AWS_REGION });
}

function s3Key(presentationId, storedName) {
  return `presentations/${presentationId}/${storedName}`;
}

// Writes the file's bytes to wherever storage actually is. Returns
// nothing — the caller already knows storedName, which is all that's
// needed later to find this same file again via (presentationId, storedName).
async function saveFile(presentationId, storedName, buffer) {
  if (useS3) {
    await s3Client.send(
      new S3_COMMANDS.PutObjectCommand({ Bucket: AWS_S3_BUCKET, Key: s3Key(presentationId, storedName), Body: buffer })
    );
    return;
  }
  const dir = path.join(UPLOADS_DIR, String(presentationId));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, storedName), buffer);
}

// Streams the file straight into the HTTP response. Caller sets
// Content-Type/Content-Disposition headers before calling this.
async function streamFile(presentationId, storedName, res) {
  if (useS3) {
    const obj = await s3Client.send(
      new S3_COMMANDS.GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: s3Key(presentationId, storedName) })
    );
    obj.Body.pipe(res);
    return;
  }
  const filePath = path.join(UPLOADS_DIR, String(presentationId), storedName);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ message: "File is missing on disk." });
    }
  });
}

// Deletes every file belonging to a presentation in one go (used when a
// presentation itself is deleted).
async function deleteAllFilesForPresentation(presentationId) {
  if (useS3) {
    const prefix = `presentations/${presentationId}/`;
    const listed = await s3Client.send(
      new S3_COMMANDS.ListObjectsV2Command({ Bucket: AWS_S3_BUCKET, Prefix: prefix })
    );
    const objects = listed.Contents || [];
    if (!objects.length) return;
    await s3Client.send(
      new S3_COMMANDS.DeleteObjectsCommand({
        Bucket: AWS_S3_BUCKET,
        Delete: { Objects: objects.map((o) => ({ Key: o.Key })) },
      })
    );
    return;
  }
  fs.rmSync(path.join(UPLOADS_DIR, String(presentationId)), { recursive: true, force: true });
}

module.exports = { saveFile, streamFile, deleteAllFilesForPresentation, useS3 };
