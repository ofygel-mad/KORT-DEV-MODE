import '@testing-library/jest-dom';

// Fix: Windows + pnpm path casing mismatch creates duplicate React instances.
// pnpm stores packages under "Kort" but the process cwd is "KORT", so Node.js
// may cache the same react module under two different path strings.
// Patching Module._resolveFilename with realpathSync.native normalises
// every resolved path to the OS-canonical casing, making the caches consistent.
import Module from 'module';
import fs from 'fs';

const _orig = (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename;
(Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename = function (
  request: unknown,
  parent: unknown,
  isMain: unknown,
  options: unknown,
) {
  const resolved = _orig.call(this, request, parent, isMain, options);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
};
