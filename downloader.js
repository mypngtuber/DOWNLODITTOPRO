'use strict';
const { ImageDropperError, imageType } = require('./utils');
const MAX_BYTES = 100 * 1024 * 1024;
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

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
    if (mime && !allowed) throw new ImageDropperError('Unsupported format', 'The server did not return JPG, PNG, or WEBP.');
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
        total += value.byteLength;
        if (total > MAX_BYTES) { await reader.cancel(); throw new ImageDropperError('Image too large', 'Maximum download size is 100 MB.'); }
        chunks.push(value);
        if (length > 0) progress(Math.min(99, Math.floor(total / length * 100)));
      }
      bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    } else {
      bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_BYTES) throw new ImageDropperError('Image too large', 'Maximum download size is 100 MB.');
    }
    const extension = imageType(bytes);
    if (!extension) throw new ImageDropperError('Download failed', 'The server did not return a valid supported image.');
    if (mime && mime !== MIME[extension]) throw new ImageDropperError('Download failed', 'The image data does not match the server Content-Type.');
    return { bytes, extension, url };
  } catch (error) {
    if (error instanceof ImageDropperError) throw error;
    throw new ImageDropperError('Download failed', controller.signal.aborted
      ? 'The download timed out after 45 seconds.' : `Unable to download the image. ${error.message || 'Check your connection and URL.'}`);
  } finally { clearTimeout(timer); }
}

module.exports = { validateUrl, download };
