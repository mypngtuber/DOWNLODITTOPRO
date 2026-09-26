'use strict';
const { validateUrl, download } = require('./downloader');
const storage = require('./storage');
const metadata = require('./metadata');
const { activeProject } = require('./premiere');
const { importImage } = require('./importer');
const { ImageDropperError } = require('./utils');
const $ = id => document.getElementById(id);
const PREF = 'imagedropper.reuseUrls.v1';
let busy = false;

function status(title, detail = '', kind = '') {
  $('statusTitle').textContent = title;
  $('statusDetail').textContent = detail;
  document.querySelector('.status').className = `status ${kind}`;
}

function setBusy(value) {
  busy = value;
  $('importButton').disabled = value;
  $('chooseFolder').disabled = value;
  $('duplicates').disabled = value;
}

async function run(event) {
  event.preventDefault();
  if (busy) return;
  setBusy(true);
  let savedPath = null;
  let importing = false;
  try {
    const url = validateUrl($('imageUrl').value);
    // Check before any download or storage dialog.
    await activeProject();
    const folder = await storage.getImagesFolder(() => status('Select Documents', 'Choose your Documents folder once. ImageDropper/Images will be created automatically.'));
    $('folderPath').textContent = storage.getNativePath(folder);
    const key = url.href;
    let path = null;
    if ($('duplicates').checked) {
      const entry = (await metadata.read()).urls[key];
      if (entry && entry.path) {
        // A persistent folder token grants access to its children without fullAccess.
        const filename = entry.path.replace(/\\/g, '/').split('/').pop();
        const file = await storage.existingFile(folder, filename);
        if (file && storage.getNativePath(file).replace(/\\/g, '/').toLowerCase() ===
          entry.path.replace(/\\/g, '/').toLowerCase()) {
          path = storage.getNativePath(file);
          savedPath = path;
          status('Reusing downloaded image...');
        }
      }
    }
    if (!path) {
      status('Downloading image...');
      const result = await download(key, percent => status(`Downloading: ${percent}%`));
      status('Saving image...');
      const saved = await storage.saveImage(folder, result.url, result.extension, result.bytes);
      path = saved.path;
      savedPath = path;
      // Metadata errors must not lose the successfully saved image or block import.
      try { await metadata.record(key, path); } catch (error) { console.warn('Could not update download record:', error); }
    }
    importing = true;
    status('Importing into Premiere...');
    const result = await importImage(path, title => status(title));
    status(result.alreadyImported ? 'Image already in ImageDropper Bin.' : 'Image imported successfully.', `File saved at:\n${path}`, 'success');
  } catch (error) {
    console.error('ImageDropper:', error);
    if (savedPath && importing) {
      status('Import failed', `Image is saved permanently but could not be imported into Premiere.\nFile saved at:\n${savedPath}\n${error.message}`, 'error');
    } else {
      status(error instanceof ImageDropperError ? error.title : 'Import failed', error.message || 'An unexpected error occurred.', 'error');
    }
  } finally { setBusy(false); }
}

$('importForm').addEventListener('submit', run);
$('settingsToggle').addEventListener('click', () => {
  $('settings').hidden = !$('settings').hidden;
  $('settingsToggle').setAttribute('aria-expanded', String(!$('settings').hidden));
});
$('chooseFolder').addEventListener('click', async () => {
  try {
    const folder = await storage.chooseFolder();
    if (folder) { $('folderPath').textContent = storage.getNativePath(folder); status('Storage folder updated.'); }
  } catch (error) { status('Storage unavailable', error.message, 'error'); }
});
$('duplicates').checked = localStorage.getItem(PREF) !== 'false';
$('duplicates').addEventListener('change', () => localStorage.setItem(PREF, String($('duplicates').checked)));
