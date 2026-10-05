// Uses installed Chrome/Edge and Vite; no extra dependencies or live API/DB.
// Run: node tests/browser-demo.mjs [browser-executable] [browser-demo.jsx|browser-p71.jsx|browser-correction.jsx] [width] [screenshot.png] [height] [capture-route]
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const browser = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fixture = process.argv[3] || 'browser-demo.jsx';
if (!/^browser-(demo|p71|p71b|correction)\.jsx$/.test(fixture)) throw new Error('Unknown browser fixture');
const width = Number(process.argv[4] || 1366);
if (!Number.isInteger(width) || width < 320 || width > 3840) throw new Error('Width must be 320–3840 pixels');
const height = Number(process.argv[6] || (width < 700 ? 844 : 900));
if (!Number.isInteger(height) || height < 480 || height > 2160) throw new Error('Invalid viewport height');
const profile = await mkdtemp(path.join(tmpdir(), 'acadova-browser-test-'));
let server;
let child;
let socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  plugins: [{ name: 'demo-test-page', configureServer(vite) {
    vite.middlewares.use('/__demo-test', async (_req, res, next) => {
      try {
        const html = await vite.transformIndexHtml('/__demo-test', `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>#result{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><div id="root"></div><pre id="result">RUNNING</pre><script type="module" src="/tests/${fixture}"></script></body></html>`);
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      } catch (error) { next(error); }
    });
  } }],
});
  await server.listen();
  const address = server.httpServer.address();
  child = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-extensions',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let spawnError;
  child.on('error', (error) => { spawnError = error; });
  let port;
  for (let i = 0; i < 100; i += 1) {
    if (spawnError) throw spawnError;
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await pause(100); }
  }
  if (!port) throw new Error('Browser debugging port did not start');
  const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const response = JSON.parse(event.data);
    if (pending.has(response.id)) { pending.get(response.id)(response); pending.delete(response.id); }
  });
  const command = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error(`Browser command timed out: ${method}`)); }, 10_000);
    pending.set(requestId, (response) => { clearTimeout(timeout); resolve(response); });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = (expression) => command('Runtime.evaluate', { expression, returnByValue: true });
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await command('Emulation.setFocusEmulationEnabled', { enabled: true });
  await command('Page.navigate', { url: `http://127.0.0.1:${address.port}/__demo-test?capture=${encodeURIComponent(process.argv[7] || '/dashboard')}` });
  let result;
  for (let i = 0; i < 300; i += 1) {
    result = (await evaluate('document.getElementById("result")?.textContent')).result?.result?.value;
    if (result?.startsWith('PASS:') || result?.startsWith('FAIL:')) break;
    await pause(100);
  }
  if (process.argv[5]) {
    const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(process.argv[5], Buffer.from(screenshot.result.data, 'base64'));
  }
  console.log(result || 'FAIL: browser did not return test results');
  if (!result?.startsWith('PASS:')) process.exitCode = 1;
} catch (error) {
  console.error('Browser runner failed:', error.code || error.message);
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
  for (let i = 0; child && child.exitCode === null && i < 30; i += 1) await pause(100);
  if (child && child.exitCode === null) child.kill();
  socket?.close();
  await server?.close();
  // Delete only the fresh, uniquely owned test profile inside the OS temp dir.
  if (path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith('acadova-browser-test-')) {
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
