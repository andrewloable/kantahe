import { join } from 'node:path';
import { Stack } from './stack';

/** Starts the real server and the dev server; the returned function stops them and removes the temp files. */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const stack = new Stack('kantahe-e2e-');
  try {
    await stack.build();

    // the songs the server finds in its folder, and the ones an administrator uploads: other numbers
    const library = join(stack.work, 'library');
    const uploads = join(stack.work, 'uploads');
    const font = join(stack.work, 'test.sf2');
    stack.fixtures(['-out', library, '-mp3', '3', '-midi', '4', '-sf2', font]);
    stack.fixtures(['-out', uploads, '-first', '20', '-mp3', '1', '-midi', '2']);
    process.env['E2E_UPLOAD_DIR'] = uploads;

    await stack.startServer(['--library', library, '--soundfont', font, '--score-seconds', '3']);
    await stack.startApp();
  } catch (e) {
    await stack.stop();
    throw e;
  }
  return () => stack.stop();
}
