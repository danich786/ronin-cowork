import { randomUUID } from 'node:crypto';
import { cliRequest } from './cli-http.js';

const args = process.argv.slice(2);
if (!args.length) args.push('list');
try {
  const result = await cliRequest('channel', args, args[0] === 'post' ? randomUUID() : undefined);
  await new Promise<void>((resolve, reject) => process.stdout.write(result.stdout, error => error ? reject(error) : resolve()));
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exit;
  // The read cursor moves only after output has been written successfully.
  if (!result.exit && args[0] === 'read') {
    const body = JSON.parse(result.stdout);
    const ack = await cliRequest('channel', ['ack', args[1], String(body.through)]);
    if (ack.exit) {
      process.stderr.write(ack.stderr);
      process.exitCode = ack.exit;
    }
  }
} catch (error) {
  console.error(`REFUSED: ${(error as Error).message}`);
  process.exitCode = 4;
}
