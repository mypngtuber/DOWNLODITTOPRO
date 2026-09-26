'use strict';
const ppro = require('premierepro');
const { ImageDropperError } = require('./utils');

async function activeProject() {
  if (!ppro.Project || typeof ppro.Project.getActiveProject !== 'function') {
    throw new ImageDropperError('Unsupported Premiere version', 'ImageDropper requires Premiere Pro 25.6 or newer.');
  }
  let project;
  try { project = await ppro.Project.getActiveProject(); } catch (_) { /* No open project. */ }
  if (!project) throw new ImageDropperError('Premiere project unavailable', 'Please open a Premiere Pro project first.');
  return project;
}

async function getBin(project, status) {
  const root = await project.getRootItem();
  if (!root) throw new ImageDropperError('Import failed', 'Could not access the project root.');
  let item = (await root.getItems()).find(child => child.name === 'ImageDropper');
  if (item) {
    const bin = ppro.FolderItem.cast(item);
    if (!bin) throw new ImageDropperError('Import failed', 'A non-bin project item is named ImageDropper. Rename it and retry.');
    return bin;
  }
  status('Creating ImageDropper Bin...');
  const committed = project.executeTransaction(compound => {
    if (!compound.addAction(root.createBinAction('ImageDropper', false))) {
      throw new Error('Could not queue bin creation');
    }
  }, 'Create ImageDropper Bin');
  if (!committed) throw new ImageDropperError('Import failed', 'Premiere could not create the ImageDropper Bin.');
  item = (await root.getItems()).find(child => child.name === 'ImageDropper');
  if (!item) throw new ImageDropperError('Import failed', 'Premiere did not create the ImageDropper Bin.');
  const bin = ppro.FolderItem.cast(item);
  if (!bin) throw new ImageDropperError('Import failed', 'The new ImageDropper item is not a Bin.');
  return bin;
}

module.exports = { activeProject, getBin, ppro };
