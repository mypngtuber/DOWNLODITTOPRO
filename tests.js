'use strict';
// Run with node tests.js. Host APIs are replaced with in-memory fakes.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { safeName, filenameFromUrl, imageType } = require('./utils');
const { validateUrl, download } = require('./downloader');

const jpg = Uint8Array.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 255, 217]);
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 73, 69, 78, 68, 174, 66, 96, 130]);
const webp = Uint8Array.from([82, 73, 70, 70, 12, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32, 0, 0, 0, 0]);
function response(bytes, mime, status = 200) {
  return { ok: status === 200, status, headers: { get: key => key === 'content-type' ? mime : String(bytes.length) },
    arrayBuffer: async () => bytes.buffer, body: null };
}
async function rejectsTitle(fn, title) {
  await assert.rejects(fn, error => error.title === title);
}

async function main() {
  assert.equal(imageType(jpg), 'jpg');
  assert.equal(imageType(png), 'png');
  assert.equal(imageType(webp), 'webp');
  assert.equal(imageType(Uint8Array.from([60, 104, 116, 109, 108, 62])), null);
  assert.equal(filenameFromUrl(new URL('https://site.test/image?id=123'), 'jpg'), 'image.jpg');
  assert.equal(filenameFromUrl(new URL('https://site.test/cat.jpeg'), 'jpg'), 'cat.jpeg');
  assert.equal(safeName('CON'), 'image');
  assert.equal(safeName('a<b>:"/\\|?*.jpg'), 'a_b________.jpg');
  for (const input of ['garbage', 'ftp://site.test/a.jpg', 'https://u:p@site.test/a.jpg']) {
    assert.throws(() => validateUrl(input), error => error.title === 'Invalid URL');
  }
  assert.equal(validateUrl('http://site.test/image.png').protocol, 'http:');
  const originalFetch = global.fetch;
  try {
    for (const [bytes, mime, extension] of [[jpg, 'image/jpeg', 'jpg'], [png, 'image/png', 'png'], [webp, 'image/webp', 'webp']]) {
      global.fetch = async () => response(bytes, mime);
      assert.equal((await download('https://site.test/image?id=123')).extension, extension);
    }
    global.fetch = async () => response(jpg, 'image/jpeg', 404);
    await rejectsTitle(() => download('https://site.test/404.jpg'), 'Download failed');
    global.fetch = async () => response(jpg, 'text/html');
    await rejectsTitle(() => download('https://site.test/html.jpg'), 'Unsupported format');
    global.fetch = async () => response(png, 'image/jpeg');
    await rejectsTitle(() => download('https://site.test/mismatch.jpg'), 'Download failed');
    global.fetch = async () => { throw new Error('offline'); };
    await rejectsTitle(() => download('https://site.test/offline.jpg'), 'Download failed');
    global.fetch = async () => ({ ...response(jpg, 'image/jpeg'), headers: { get: key => key === 'content-length' ? '104857601' : 'image/jpeg' } });
    await rejectsTitle(() => download('https://site.test/large.jpg'), 'Image too large');
  } finally { global.fetch = originalFetch; }

  const files = [];
  const folder = {
    isFolder: true, name: 'Images', nativePath: 'C:\\Users\\Test\\Documents\\ImageDropper\\Images',
    getEntries: async () => files,
    createFile: async name => {
      if (files.some(f => f.name.toLowerCase() === name.toLowerCase())) throw Error('overwrite attempted');
      const file = { name, isFile: true, nativePath: `${folder.nativePath}\\${name}`, write: async data => { file.data = data; } };
      files.push(file); return file;
    }
  };
  const fakeUXP = { storage: { localFileSystem: {
    getNativePath: entry => entry.nativePath,
    createPersistentToken: async () => 'saved-token', getEntryForPersistentToken: async () => folder,
    getFolder: async () => folder
  }, domains: { userDocuments: Symbol('documents') }, formats: { binary: Symbol('binary') } } };
  let hasProject = true;
  let importCount = 0;
  const bin = { name: 'ImageDropper', items: [], getItems: async function () { return this.items; } };
  const root = { items: [], getItems: async function () { return this.items; }, createBinAction: () => ({ run: () => root.items.push(bin) }) };
  const project = { getRootItem: async () => root,
    executeTransaction: fn => { fn({ addAction: action => { action.run(); return true; } }); return true; },
    importFiles: async (paths, suppressUI, target, numbered) => {
      assert.equal(suppressUI, true); assert.equal(numbered, false); assert.equal(target, bin);
      importCount++; bin.items.push({ name: paths[0].split('\\').pop(), path: paths[0] }); return true;
    }
  };
  const fakePremiere = { Project: { getActiveProject: async () => hasProject ? project : null },
    FolderItem: { cast: value => value === bin ? value : null },
    ClipProjectItem: { cast: value => value.path ? { getMediaFilePath: async () => value.path } : null }
  };
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'uxp') return fakeUXP;
    if (request === 'premierepro') return fakePremiere;
    return originalLoad.apply(this, arguments);
  };
  try {
    const storage = require('./storage');
    const { importImage } = require('./importer');
    const { activeProject } = require('./premiere');
    global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    hasProject = false;
    await rejectsTitle(activeProject, 'Premiere project unavailable');
    hasProject = true;
    const saved = await storage.saveImage(folder, new URL('https://site.test/cat.jpg'), 'jpg', jpg);
    assert.equal(saved.filename, 'cat.jpg');
    assert.deepEqual(new Uint8Array(saved.file.data), jpg);
    assert.equal((await storage.saveImage(folder, new URL('https://site.test/cat.jpg'), 'jpg', jpg)).filename, 'cat_001.jpg');
    assert.equal((await storage.existingFile(folder, 'CAT.JPG')).name, 'cat.jpg');
    assert.equal((await importImage(saved.path, () => {})).alreadyImported, false);
    assert.equal((await importImage(saved.path, () => {})).alreadyImported, true);
    assert.equal(importCount, 1);
    assert.equal(root.items.length, 1);
    assert.equal(bin.items[0].path, saved.path);
  } finally { Module._load = originalLoad; }
  console.log('ImageDropper tests passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
