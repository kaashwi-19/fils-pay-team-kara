import sharp from "sharp";
import type { DetectedFileType } from "./fileSignature.js";

/**
 * Longest side, in pixels.
 */
const THUMBNAIL_MAX_DIMENSION_PX = 320;

export interface GeneratedThumbnail {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Generates a review-UI-sized thumbnail from an already-validated upload
 * buffer. Only `jpeg`/`png` documents get one — a `pdf` (commercial
 * registration, bank letter) has no image to thumbnail, and this returns
 * `null` rather than attempting a PDF-to-image conversion. Always
 * re-encodes to JPEG regardless of the source format, so the admin
 * console's `<img>` tag never needs to branch on thumbnail mime type the
 * way the original-file endpoint does.
 */
export async function generateKycThumbnail(
  buffer: Buffer,
  detectedType: DetectedFileType,
): Promise<GeneratedThumbnail | null> {
  if (detectedType !== "jpeg" && detectedType !== "png") {
    return null;
  }
  // The 8 MiB upload cap limits the FILE, not the image: a small, highly
  // compressible PNG can declare e.g. 30,000 x 30,000 pixels and sharp's
  // default limit (~268 million pixels, about 1 GB decoded) lets it through —
  // enough to take down a 512 MB API process with one upload. Cap the decoded
  // size at 50 million pixels (larger than any phone photo), and treat a
  // failed thumbnail as "no thumbnail" rather than failing the upload.
  try {
    const resized = await sharp(buffer, { limitInputPixels: 50_000_000 })
      .resize(THUMBNAIL_MAX_DIMENSION_PX, THUMBNAIL_MAX_DIMENSION_PX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return { buffer: resized, mimeType: "image/jpeg" };
  } catch {
    return null;
  }
}
