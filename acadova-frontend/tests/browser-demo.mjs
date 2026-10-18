// Uses installed Chrome/Edge and Vite; no extra dependencies or live API/DB.
// Run: node tests/browser-demo.mjs [browser-executable] [browser-demo.jsx|browser-p71.jsx|browser-correction.jsx] [width] [screenshot.png] [height] [capture-route]
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const browser = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fixture = process.argv[3] || 'browser-demo.jsx';
if (!/^browser-(demo|p71|p71b|correction|hardening|quality|rollback|learning|landing|qa|register|integrity|completion|enhancements|milestone|phaseb|phaseb1|phaseb3|staff-live|ui-corrections|release-c1|release-c2|release-c2-live|moderator-defense-live|learning-progress-live|ai-study|ai-ux|bundle-a|bundle-b|bundle-c|ui-redesign|chat|master)\.jsx$/.test(fixture)) throw new Error('Unknown browser fixture');
const live = ['browser-staff-live.jsx', 'browser-release-c2-live.jsx', 'browser-moderator-defense-live.jsx', 'browser-learning-progress-live.jsx'].includes(fixture) ? JSON.parse(process.env.ACADOVA_LOCAL_BROWSER_CONFIG || '{}') : null;
if (live) {
  const endpoint = new URL(live.url);
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || !endpoint.port || endpoint.pathname !== '/' || endpoint.search || endpoint.username || endpoint.password || endpoint.hash) throw new Error('Live fixture requires an isolated loopback API');
  if (!/^[A-Za-z\d_.-]+$/.test(live.token || '')) throw new Error('Missing synthetic test token');
}
const width = Number(process.argv[4] || 1366);
if (!Number.isInteger(width) || width < 320 || width > 3840) throw new Error('Width must be 320â€“3840 pixels');
if (process.argv[5] && !process.argv[5].endsWith('.png')) throw new Error('Screenshot argument must be a .png path');
const height = Number(process.argv[6] || (width < 700 ? 844 : 900));
if (!Number.isInteger(height) || height < 480 || height > 2160) throw new Error('Invalid viewport height');
const reflowScale = Number(process.env.ACADOVA_REFLOW_SCALE || 1);
if (![1, 2].includes(reflowScale)) throw new Error('Reflow scale must be 1 or 2');
const zoomReflow = Number(process.env.ACADOVA_ZOOM_REFLOW || 1);
if (![.8, .9, 1, 1.1, 1.25].includes(zoomReflow) || (zoomReflow !== 1 && reflowScale !== 1)) throw new Error('Unsupported zoom reflow');
const viewportScale = reflowScale * zoomReflow;
const visualBaseline = process.env.ACADOVA_VISUAL_BASELINE === '1';
const fixtureRoot = visualBaseline ? path.resolve('.ux-rollback-baseline') : process.cwd();
const profile = await mkdtemp(path.join(tmpdir(), 'acadova-browser-test-'));
const fontLinks = process.env.ACADOVA_BROWSER_FONTS === '1'
  ? ((await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/<link\b[^>]*>/gi) || [])
    .filter((tag) => /fonts\.(googleapis|gstatic)\.com/.test(tag)).join('') : '';
const entry = fontLinks ? `<script type="module">
try {
  const fonts = ['400 16px Inter', '500 16px Inter', '600 16px Inter', '700 16px Inter',
    '500 16px "Plus Jakarta Sans"', '600 16px "Plus Jakarta Sans"', '700 16px "Plus Jakarta Sans"', '800 16px "Plus Jakarta Sans"',
    '500 16px "JetBrains Mono"', '700 16px "JetBrains Mono"'];
  const loaded = await Promise.all(fonts.map((font) => document.fonts.load(font)));
  if (loaded.some((faces) => !faces.length)) throw new Error('Canonical fonts did not load');
  window.__acadovaFontsLoaded = true;
  await import('/tests/${fixture}');
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message; }
</script>` : `<script type="module" src="/tests/${fixture}"></script>`;
let server;
let child;
let socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
server = await createServer({
  root: fixtureRoot,
  ...(live ? { envDir: profile, define: { 'import.meta.env.VITE_API_URL': "''", 'import.meta.env.VITE_ONESIGNAL_APP_ID': "''", 'import.meta.env.VITE_GOOGLE_CLIENT_ID': "''" } } : {}),
  ...(visualBaseline ? { configFile: false } : {}),
  logLevel: 'error',
  // Concurrent viewport runs must not overwrite each other's optimized modules.
  cacheDir: path.join(profile, 'vite-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'react-router-dom', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  plugins: [...(visualBaseline ? [react()] : []), ...(process.env.ACADOVA_AI_UX_BEFORE === '1' ? [{ name:'ai-ux-saved-source', enforce:'pre', async load(id) {
    const filename = path.resolve(id.split('?')[0]);
    if (fixture !== 'browser-ai-ux.jsx' || !filename.startsWith(path.resolve('src') + path.sep)) return null;
    const saved = path.resolve('../docs/real-gemini-evidence/source-before/acadova-frontend', path.relative(process.cwd(),filename));
    try { await access(saved); return await readFile(saved,'utf8'); } catch { return null; }
  } }] : []), { name: 'demo-test-page', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      // Keep mocked fixtures loaded if Vite reloads a URL changed by BrowserRouter.
      if (!req.url?.startsWith('/__demo-test') && !(req.method === 'GET' && req.headers.accept?.includes('text/html'))) return next();
      try {
        const html = await vite.transformIndexHtml('/__demo-test', `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">${fontLinks}<style>#result{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><div id="root"></div><pre id="result">RUNNING</pre><script>window.__acadovaVisualBaseline=${visualBaseline};window.__acadovaLocalTest=${JSON.stringify(live).replaceAll('<', '\\u003c')};</script>${entry}</body></html>`);
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
    '--renderer-process-limit=1', '--js-flags=--max-old-space-size=128 --max-semi-space-size=4',
    '--disable-background-networking', '--disable-extensions', '--disable-popup-blocking',
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
  // Reuse this isolated profile's initial blank tab instead of allocating a
  // second renderer. Never attaches to the user's existing browser profile.
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(target => target.type === 'page')
    || await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  const browserErrors = [];
  const pendingNetwork = new Map();
  socket.addEventListener('message', (event) => {
    const response = JSON.parse(event.data);
    if (response.method === 'Network.requestWillBeSent') pendingNetwork.set(response.params.requestId, new URL(response.params.request.url).pathname);
    if (['Network.loadingFinished', 'Network.loadingFailed'].includes(response.method)) pendingNetwork.delete(response.params.requestId);
    if (response.method === 'Runtime.exceptionThrown') browserErrors.push(response.params.exceptionDetails.exception?.description || response.params.exceptionDetails.text);
    if (response.method === 'Runtime.consoleAPICalled' && response.params.type === 'error') browserErrors.push(response.params.args.map((arg) => arg.value || arg.description || '').join(' '));
    if (pending.has(response.id)) { pending.get(response.id)(response); pending.delete(response.id); }
  });
  const command = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error(`Browser command timed out: ${method}`)); }, 20_000);
    pending.set(requestId, (response) => { clearTimeout(timeout); resolve(response); });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = (expression) => command('Runtime.evaluate', { expression, returnByValue: true });
  await command('Runtime.enable', {});
  await command('Page.enable', {});
  await command('Page.bringToFront', {});
  await command('Network.enable', {});
  await command('Emulation.setDeviceMetricsOverride', { width: Math.floor(width / viewportScale), height: Math.floor(height / viewportScale), deviceScaleFactor: viewportScale, mobile: process.env.ACADOVA_COARSE_POINTER === '1' });
  if (process.env.ACADOVA_COARSE_POINTER === '1') await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await command('Emulation.setFocusEmulationEnabled', { enabled: true });
  if (process.env.ACADOVA_REDUCED_MOTION === '1') await command('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  const media = (await evaluate(`({ fine: matchMedia('(pointer: fine)').matches,
    coarse: matchMedia('(pointer: coarse)').matches, hover: matchMedia('(hover: hover)').matches,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches })`)).result?.result?.value;
  if (process.env.ACADOVA_COARSE_POINTER === '1' && (!media?.coarse || media.hover)) throw new Error('Coarse-pointer emulation did not activate');
  if (process.env.ACADOVA_REDUCED_MOTION === '1' && !media?.reduced) throw new Error('Reduced-motion emulation did not activate');
  console.log('Browser media:', JSON.stringify(media));
  console.log('CSS viewport:', JSON.stringify((await evaluate(`({ width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio, visualScale: visualViewport.scale, narrowStaff: matchMedia('(max-width: 1024px)').matches, shortStaff: matchMedia('(max-height: 700px)').matches })`)).result?.result?.value));
  await command('Page.navigate', { url: `http://127.0.0.1:${address.port}/__demo-test?capture=${encodeURIComponent(process.argv[7] || '/dashboard')}` });
  if (process.env.ACADOVA_SCREENSHOT_DIR) await command('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__acadovaCaptureEnabled = true;' });
  await evaluate(`window.__acadovaCaptureEnabled = ${Boolean(process.env.ACADOVA_SCREENSHOT_DIR)}`);
  let result;
  for (let i = 0; i < 1200; i += 1) {
    const capture = (await evaluate('window.__acadovaCapture')).result?.result?.value;
    if (capture && process.env.ACADOVA_SCREENSHOT_DIR && /^[a-z0-9-]+$/.test(capture)) {
      const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(path.join(process.env.ACADOVA_SCREENSHOT_DIR, `${capture}-${width}.png`), Buffer.from(screenshot.result.data, 'base64'));
      const details = (await evaluate('window.__acadovaCaptureDetails')).result?.result?.value;
      if (details?.name === capture) await writeFile(path.join(process.env.ACADOVA_SCREENSHOT_DIR, `${capture}-${width}.json`), JSON.stringify(details, null, 2));
      await evaluate('window.__acadovaCapture = null');
    }
    const key = (await evaluate('window.__acadovaKey')).result?.result?.value;
    if (['Tab', 'Shift+Tab', 'Enter', 'Escape', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
      const actualKey = key === 'Shift+Tab' ? 'Tab' : key === 'Space' ? ' ' : key;
      const code = { Tab: 9, Enter: 13, Escape: 27, ' ': 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35 }[actualKey];
      const domCode = key === 'Space' ? 'Space' : actualKey;
      const modifiers = key === 'Shift+Tab' ? 8 : 0;
      await command('Input.dispatchKeyEvent', { type: 'keyDown', key: actualKey, code: domCode, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers, ...(actualKey === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
      await command('Input.dispatchKeyEvent', { type: 'keyUp', key: actualKey, code: domCode, windowsVirtualKeyCode: code, modifiers });
      await evaluate('window.__acadovaKey = null');
    }
    const pointer = (await evaluate('window.__acadovaPointer')).result?.result?.value;
    if (pointer && Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
      await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pointer.x, y: pointer.y });
      for (let click = 1; !pointer.hover && click <= (pointer.double ? 2 : 1); click++) {
        await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: pointer.x, y: pointer.y, button: 'left', clickCount: click });
        await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pointer.x, y: pointer.y, button: 'left', clickCount: click });
      }
      await evaluate('window.__acadovaPointer = null');
    }
    result = (await evaluate('document.getElementById("result")?.textContent')).result?.result?.value;
    if (result?.startsWith('PASS:') || result?.startsWith('FAIL:')) break;
    await pause(100);
  }
  if (process.argv[5]) {
    const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(process.argv[5], Buffer.from(screenshot.result.data, 'base64'));
  }
  if (process.env.ACADOVA_ZOOM_CHECK === '1' && result?.startsWith('PASS:')) {
    await command('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
    const scale = (await evaluate('window.visualViewport.scale')).result?.result?.value;
    if (Math.abs(scale - 2) > .01) throw new Error('Browser zoom sanity check did not reach 2x');
    await command('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    console.log('PASS: browser 2x visual zoom and reset; CSS reflow is checked separately');
  }
  console.log(result || 'FAIL: browser did not return test results');
  if (!result?.startsWith('PASS:') && !result?.startsWith('FAIL:')) {
    console.error('Pending local browser resources:', JSON.stringify([...pendingNetwork.values()]));
    console.error('Local fixture state:', (await evaluate('JSON.stringify({path:location.pathname,title:document.title,ready:document.readyState,milestoneRefresh:sessionStorage.getItem("milestone-refresh")})')).result?.result?.value);
  }
  if (browserErrors.length) console.error(browserErrors.join('\n'));
  if (!result?.startsWith('PASS:') || browserErrors.length) process.exitCode = 1;
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
