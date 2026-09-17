// Readiness for the installed public address. Preserve the last failure in the
// install report and bound DNS, TLS, response headers, and retries by one deadline.
const http = require('node:http');
const https = require('node:https');
const { performance } = require('node:perf_hooks');

async function waitReady(address, { timeout = 60000, requestTimeout = 5000, interval = 1000 } = {}) {
  const url = new URL('/api/health', address);
  const client = url.protocol === 'https:' ? https : url.protocol === 'http:' ? http : null;
  if (!client) throw new Error(`Unsupported readiness protocol: ${url.protocol}`);
  const deadline = performance.now() + timeout;
  let last = 'No response';
  while (performance.now() < deadline) {
    try {
      await new Promise((resolve, reject) => {
        const req = client.get(url, res => {
          res.destroy();
          clearTimeout(timer);
          if (res.statusCode === 200) resolve();
          else reject(new Error(`HTTP ${res.statusCode}`));
        });
        // A socket inactivity timeout alone does not bound DNS lookup.
        const timer = setTimeout(() => req.destroy(new Error('Request timed out')),
          Math.min(requestTimeout, Math.max(1, deadline - performance.now())));
        req.on('error', error => { clearTimeout(timer); reject(error); });
      });
      return;
    } catch (error) {
      last = `${error.code ? `${error.code}: ` : ''}${error.message}`;
    }
    const remaining = deadline - performance.now();
    if (remaining <= interval) break;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Readiness failed for ${url.href}: ${last}`);
}

module.exports = { waitReady };
if (require.main === module) {
  waitReady(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
