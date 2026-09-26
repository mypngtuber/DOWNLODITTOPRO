'use strict';

class ImageDropperError extends Error {
  constructor(title, message) {
    super(message);
    this.name = 'ImageDropperError';
    this.title = title;
  }
}

function safeName(value) {
  let name = String(value || '').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_')
    .replace(/[. ]+$/g, '').replace(/^\.+/, '').trim();
  if (!name || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) name = 'image';
  return name.slice(0, 100).replace(/[. ]+$/g, '') || 'image';
}

function filenameFromUrl(url, extension) {
  let part = url.pathname.split('/').pop() || '';
  try { part = decodeURIComponent(part); } catch (_) { part = ''; }
  const stem = part.replace(/\.(jpe?g|png|webp)$/i, '');
  const suffix = extension === 'jpg' && /\.jpeg$/i.test(part) ? 'jpeg' : extension;
  return `${safeName(stem)}.${suffix}`;
}

function imageType(data) {
  const b = data instanceof Uint8Array ? data : new Uint8Array(data);
  // JPEG encoders can append padding after the end-of-image marker.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 24 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 &&
    b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10 &&
    b[12] === 73 && b[13] === 72 && b[14] === 68 && b[15] === 82) return 'png';
  if (b.length >= 20 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...b.subarray(8, 12)) === 'WEBP' &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(String.fromCharCode(...b.subarray(12, 16))) &&
    ((b[4] | b[5] << 8 | b[6] << 16 | b[7] << 24) >>> 0) <= b.length - 8) return 'webp';
  return null;
}

module.exports = { ImageDropperError, safeName, filenameFromUrl, imageType };
