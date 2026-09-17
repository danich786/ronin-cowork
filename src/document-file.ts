import { constants } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { listProjectRoots, type ProjectRootInfo } from './project-roots.js';
import { REPO_ROOT } from './resources.js';

export class DocumentPathError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** Preserve the established Docs shelf contract when no registered root is supplied. */
export function legacyDocumentPath(requestedPath: unknown): string {
  const file = String(requestedPath ?? '');
  if (!file.startsWith('/')) throw new DocumentPathError('An absolute path is required.');
  return file;
}

const containedBy = (root: string, file: string): boolean => {
  const relative = path.relative(root, file);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};

export async function resolveDocumentFile(rootName: unknown, requestedPath: unknown, suppliedRoots?: ProjectRootInfo[]): Promise<string> {
  const rootToken = String(rootName ?? '').trim();
  const supplied = String(requestedPath ?? '').trim();
  if (!supplied) throw new DocumentPathError('A document path is required.');

  const roots = (suppliedRoots ?? await listProjectRoots()).filter((root) => !root.archived);
  const root = roots.find((entry) => entry.name === rootToken);
  if (!root) throw new DocumentPathError('Choose a registered workspace folder.', 403);
  if (path.isAbsolute(supplied)) throw new DocumentPathError('Use a path relative to the workspace folder.');
  const candidate = path.resolve(root.dir, supplied);

  let canonical: string;
  try { canonical = await realpath(candidate); }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') throw new DocumentPathError('No such file — it moved or was deleted.', 404);
    throw error;
  }
  if (!/\.md$/i.test(canonical)) throw new DocumentPathError('Only Markdown documents can be edited.', 415);

  let rootPath: string;
  try { rootPath = await realpath(root.dir); }
  catch { throw new DocumentPathError('That workspace folder is unavailable.', 404); }
  if (!containedBy(rootPath, canonical)) throw new DocumentPathError('That document is outside the registered workspace folder.', 403);
  const facts = await stat(canonical);
  if (!facts.isFile()) throw new DocumentPathError('No such file.', 404);
  return canonical;
}

/** Resolve one shipped, read-only owner guide without pretending the install is a Workspace Folder. */
export async function resolveProductDocumentFile(requestedPath: unknown, productRoot = REPO_ROOT): Promise<string> {
  const supplied = String(requestedPath ?? '').trim();
  if (!supplied) throw new DocumentPathError('A document path is required.');
  if (path.isAbsolute(supplied) || supplied.includes('\0')) throw new DocumentPathError('Use a product-document path.');
  const docsRoot = await realpath(path.join(productRoot, 'docs')).catch(() => { throw new DocumentPathError('Product documentation is unavailable.', 404); });
  const candidate = path.resolve(productRoot, supplied);
  if (!containedBy(docsRoot, candidate)) throw new DocumentPathError('That is not a product document.', 403);
  let canonical: string;
  try { canonical = await realpath(candidate); }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') throw new DocumentPathError('No such product document.', 404);
    throw error;
  }
  if (!containedBy(docsRoot, canonical)) throw new DocumentPathError('That is not a product document.', 403);
  if (!/\.md$/i.test(canonical)) throw new DocumentPathError('Only Markdown product documents can be read.', 415);
  const facts = await stat(canonical);
  if (!facts.isFile()) throw new DocumentPathError('No such product document.', 404);
  return canonical;
}

/** Read from the validated inode without following a last-moment replacement symlink. */
export async function readDocumentFile(rootName: unknown, requestedPath: unknown): Promise<{ path: string; text: string }> {
  const file = await resolveDocumentFile(rootName, requestedPath);
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return { path: file, text: await handle.readFile('utf8') }; }
  finally { await handle.close(); }
}

export async function readProductDocumentFile(requestedPath: unknown): Promise<{ path: string; text: string }> {
  const file = await resolveProductDocumentFile(requestedPath);
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return { path: file, text: await handle.readFile('utf8') }; }
  finally { await handle.close(); }
}

/** Save only to the validated inode; the API never creates a document. */
export async function saveDocumentFile(rootName: unknown, requestedPath: unknown, text: string): Promise<string> {
  const file = await resolveDocumentFile(rootName, requestedPath);
  const handle = await open(file, constants.O_WRONLY | constants.O_TRUNC | constants.O_NOFOLLOW);
  try { await handle.writeFile(text, 'utf8'); }
  finally { await handle.close(); }
  return file;
}
