'use strict';
const { storage } = require('uxp');
const { localFileSystem: fs } = storage;
const FILE = 'metadata.json';

async function read() {
  const folder = await fs.getDataFolder();
  try {
    const file = await folder.getEntry(FILE);
    const data = JSON.parse(await file.read());
    return data && data.version === 1 && typeof data.urls === 'object' && data.urls ? data : { version: 1, urls: {} };
  } catch (_) { return { version: 1, urls: {} }; }
}

async function record(url, path) {
  const folder = await fs.getDataFolder();
  const data = await read();
  data.urls[url] = { path, downloadedAt: new Date().toISOString() };
  const file = await folder.createFile(FILE, { overwrite: true });
  await file.write(JSON.stringify(data));
}

module.exports = { read, record };
