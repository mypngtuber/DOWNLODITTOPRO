'use strict';
const { ImageDropperError, imageType } = require('./utils');
const MAX_BYTES = 100 * 1024 * 1024;
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function asBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new ImageDropperError('Download failed', 'The server response could not be read as binary image data.');
}

function validateUrl(input) {
  let url;
  try { url = new URL(String(input).trim()); } catch (_) { throw new ImageDropperError('Invalid URL', 'Enter a direct HTTP or HTTPS image URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new ImageDropperError('Invalid URL', 'Enter a direct HTTP or HTTPS image URL without credentials.');
  }
  return url;
}

async function download(input, progress = () => {}) {
  const url = validateUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(url.href, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new ImageDropperError('Download failed', `Server returned HTTP ${response.status}.`);
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const allowed = Object.values(MIME).includes(mime);
    // Some image CDNs send generic binary MIME types; trust the signature in that case.
    if (mime && !allowed && mime !== 'application/octet-stream') {
      throw new ImageDropperError('Unsupported format', `The server returned ${mime}, not JPG, PNG, or WEBP. Paste a direct image URL.`);
    }
    const length = Number(response.headers.get('content-length'));
    if (length > MAX_BYTES) throw new ImageDropperError('Image too large', 'Maximum download size is 100 MB.');
    let bytes;
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = asBytes(value);
        total += chunk.byteLength;
        if (total > MAX_BYTES) { await reader.cancel(); throw new ImageDropperError('Image too large', 'Maximum download size is 100 MB.'); }
        chunks.push(chunk);
        if (length > 0) progress(Math.min(99, Math.floor(total / length * 100)));
      }
      bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    } else {
      bytes = asBytes(await response.arrayBuffer());
      if (bytes.byteLength > MAX_BYTES) throw new ImageDropperError('Image too large', 'Maximum download size is 100 MB.');
    }
    const extension = imageType(bytes);
    if (!extension) {
      const signature = Array.from(bytes.subarray(0, 12), b => b.toString(16).padStart(2, '0')).join(' ') || '(empty)';
      throw new ImageDropperError('Download failed',
        `The URL returned ${bytes.length} bytes (${mime || 'no Content-Type'}), but the data is not JPG, PNG, or WEBP. ` +
        `First bytes: ${signature}. Paste a direct image URL, not a webpage or thumbnail page.`);
    }
    if (allowed && mime !== MIME[extension]) throw new ImageDropperError('Download failed', `The downloaded ${extension.toUpperCase()} data does not match Content-Type ${mime}.`);
    return { bytes, extension, url };
  } catch (error) {
    if (error instanceof ImageDropperError) throw error;
    throw new ImageDropperError('Download failed', controller.signal.aborted
      ? 'The download timed out after 45 seconds.' : `Unable to download the image. ${error.message || 'Check your connection and URL.'}`);
  } finally { clearTimeout(timer); }
}

module.exports = { validateUrl, download };
