import { prepareDevServices } from '../src/dev-services.js';

try {
  const result = await prepareDevServices(process.cwd());
  console.log(result.status === 'synced'
    ? `dev Services: ${result.source}@${result.revision} → ${result.target}/src/services`
    : `dev Services: skipped — ${result.reason}`);
} catch (error) {
  console.error(`dev Services preparation failed: ${(error as Error).message}`);
  process.exitCode = 1;
}
