import { join } from 'node:path';
import { Stack } from '../stack';
import { holdOnline, seedServer, workerCount, writeSeed } from './seed';

/** Starts the real server with the audit's data and the dev server in front of it; the returned function stops everything. */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const stack = new Stack('kantahe-audit-');
  let release: () => void = () => undefined;
  try {
    await stack.build();
    const library = join(stack.work, 'library');
    const font = join(stack.work, 'test.sf2');
    // 320 songs in the library
    stack.fixtures(['-out', library, '-mp3', '200', '-midi', '120', '-sf2', font], true);
    // the score stays on the screen long enough to be looked at
    await stack.startServer(['--library', library, '--soundfont', font, '--score-seconds', '30']);
    await stack.startApp();

    const { seed, tvToken } = await seedServer(workerCount(), library);
    release = await holdOnline(tvToken);
    const file = join(stack.work, 'seed.json');
    writeSeed(file, seed);
    process.env['KANTAHE_AUDIT_SEED'] = file;
  } catch (e) {
    release();
    await stack.stop();
    throw e;
  }
  return async () => {
    release();
    await stack.stop();
  };
}
