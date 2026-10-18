// Upload-only transport. The central API client still owns auth, errors and
// mutation notifications; XHR adds real browser byte-progress events to fetch.
export function uploadResponse(url, config, onProgress, create = () => new XMLHttpRequest()) {
  return new Promise((resolve, reject) => {
    const xhr = create(); let settled = false;
    const abort = () => xhr.abort();
    const finish = (error, response) => {
      if (settled) return; settled = true;
      config.signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(response);
    };
    if (config.signal?.aborted) { finish(new DOMException('Upload cancelled.', 'AbortError')); return; }
    xhr.open(config.method || 'POST', url, true); xhr.timeout = 120000;
    for (const [name, value] of Object.entries(config.headers || {})) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = event => onProgress({ loaded: event.loaded, total: event.total, lengthComputable: event.lengthComputable });
    xhr.onload = () => {
      try { finish(null, new Response([204,205,304].includes(xhr.status) ? null : xhr.responseText, { status: xhr.status })); }
      catch { finish(new Error('The upload response could not be read.')); }
    };
    xhr.onerror = () => finish(new Error('Upload could not reach Acadova. Check your connection.'));
    xhr.ontimeout = () => finish(new Error('The request timed out. Check its status before starting a new generation.'));
    xhr.onabort = () => finish(new DOMException('Upload cancelled.', 'AbortError'));
    config.signal?.addEventListener('abort', abort, { once: true });
    xhr.send(config.body);
  });
}
