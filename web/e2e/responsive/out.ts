import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

const repo = resolve(__dirname, '../../..');

/** Where the screenshots and the report go: $KANTAHE_AUDIT_OUT, or kantahe-responsive in the temp folder. Never inside the repository. */
export function auditOutDir(): string {
  const dir = resolve(process.env['KANTAHE_AUDIT_OUT'] || join(tmpdir(), 'kantahe-responsive'));
  const from = relative(repo, dir);
  if (from === '' || (!from.startsWith('..') && !isAbsolute(from))) {
    throw new Error(`The audit does not write inside the repository (${dir}); set KANTAHE_AUDIT_OUT to a folder elsewhere.`);
  }
  return dir;
}
