'use strict';
const { activeProject, getBin, ppro } = require('./premiere');
const { ImageDropperError } = require('./utils');

async function matchingItem(bin, path) {
  const children = await bin.getItems();
  for (const child of children) {
    const clip = ppro.ClipProjectItem.cast(child);
    if (clip && typeof clip.getMediaFilePath === 'function') {
      try {
        const mediaPath = await clip.getMediaFilePath();
        if (mediaPath && mediaPath.replace(/\\/g, '/').toLowerCase() === path.replace(/\\/g, '/').toLowerCase()) return child;
      } catch (_) { /* Non-media items are not matches. */ }
    }
  }
  return null;
}

async function importImage(path, status) {
  const project = await activeProject();
  const bin = await getBin(project, status);
  if (await matchingItem(bin, path)) return { alreadyImported: true };
  status('Adding image to Project...');
  // Import directly into the target Bin; no root import / subsequent move is needed.
  const success = await project.importFiles([path], true, bin, false);
  if (!success || !(await matchingItem(bin, path))) {
    throw new ImageDropperError('Import failed', 'Premiere Pro could not verify the image in the ImageDropper Bin.');
  }
  return { alreadyImported: false };
}

module.exports = { importImage };
