// Uses installed Chrome/Edge and Vite; no extra dependencies or live API/DB.
// Run from acadova-frontend: node tests/browser-demo.mjs [browser-executable]
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const browser = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
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
        const html = await vite.transformIndexHtml('/__demo-test', '<!doctype html><html><body><div id="root"></div><pre id="result">RUNNING</pre><script type="module" src="/tests/browser-demo.jsx"></script></body></html>');
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
  const page = await (await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:${address.port}/__demo-test`, { method: 'PUT' })).json();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const response = JSON.parse(event.data);
    if (pending.has(response.id)) { pending.get(response.id)(response); pending.delete(response.id); }
  });
  const evaluate = (expression) => new Promise((resolve) => {
    const requestId = ++id;
    pending.set(requestId, resolve);
    socket.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  let result;
  for (let i = 0; i < 300; i += 1) {
    result = (await evaluate('document.getElementById("result")?.textContent')).result?.result?.value;
    if (result?.startsWith('PASS:') || result?.startsWith('FAIL:')) break;
    await pause(100);
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
