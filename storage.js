'use strict';
const { storage } = require('uxp');
const { localFileSystem: fs, domains, formats } = storage;
const { ImageDropperError, filenameFromUrl } = require('./utils');
const TOKEN_KEY = 'imagedropper.storageToken.v1';

async function getImagesFolder(onFirstUse) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    try {
      const folder = await fs.getEntryForPersistentToken(token);
      if (!folder.isFolder) throw new Error('Not a folder');
      await folder.getEntries();
      return folder;
    } catch (_) { localStorage.removeItem(TOKEN_KEY); }
  }
  // UXP has no documented silent lookup of the user's redirected Documents path.
  onFirstUse();
  const documents = await fs.getFolder({ initialDomain: domains.userDocuments });
  if (!documents) throw new ImageDropperError('Storage folder needed', 'Select your Documents folder to save images permanently.');
  return createDefaultIn(documents);
}

async function childFolder(parent, name) {
  const entries = await parent.getEntries();
  const found = entries.find(e => e.name.toLowerCase() === name.toLowerCase());
  if (found) {
    if (!found.isFolder) throw new ImageDropperError('Storage unavailable', `${name} exists but is not a folder.`);
    return found;
  }
  return parent.createFolder(name);
}

async function remember(folder) {
  const token = await fs.createPersistentToken(folder);
  localStorage.setItem(TOKEN_KEY, token);
  return folder;
}

async function createDefaultIn(documents) {
  const base = await childFolder(documents, 'ImageDropper');
  const images = await childFolder(base, 'Images');
  return remember(images);
}

async function chooseFolder() {
  const folder = await fs.getFolder({ initialDomain: domains.userDocuments });
  if (!folder) return null;
  return remember(folder); // Custom selection is the Images folder itself.
}

async function existingFile(folder, filename) {
  const entry = (await folder.getEntries()).find(e => e.name.toLowerCase() === filename.toLowerCase());
  return entry && entry.isFile ? entry : null;
}

async function saveImage(folder, url, extension, bytes) {
  const desired = filenameFromUrl(url, extension);
  const dot = desired.lastIndexOf('.');
  const stem = desired.slice(0, dot);
  const entries = new Set((await folder.getEntries()).map(e => e.name.toLowerCase()));
  let filename = desired;
  for (let i = 1; entries.has(filename.toLowerCase()); i++) {
    if (i > 99999) throw new ImageDropperError('Storage unavailable', 'Too many files with this name.');
    filename = `${stem}_${String(i).padStart(3, '0')}${desired.slice(dot)}`;
  }
  // Never request overwrite: a write failure preserves every existing user file.
  const file = await folder.createFile(filename);
  await file.write(bytes.buffer, { format: formats.binary });
  return { path: fs.getNativePath(file), filename, file };
}

module.exports = { getImagesFolder, chooseFolder, saveImage, existingFile, getNativePath: e => fs.getNativePath(e) };
