// Large images are decoded once for editor previews. Project/export data stays embedded.
const editorMediaCache = new Map();

async function prepareEditorMedia(asset) {
  if (!asset || asset.type !== 'image' || !asset.data?.startsWith('data:') || asset.data.length < 131072) return;
  let cached = editorMediaCache.get(asset.data);
  if (!cached) {
    cached = {url: null, promise: null};
    editorMediaCache.set(asset.data, cached);
    cached.promise = fetch(asset.data).then(response => response.blob()).then(blob => {
      cached.url = URL.createObjectURL(blob);
    }).catch(() => {});
  }
  await cached.promise;
}

function editorMediaSource(asset) {
  if (!asset) return '';
  prepareEditorMedia(asset);
  return editorMediaCache.get(asset.data)?.url || asset.data;
}

function releaseUnusedEditorMedia() {
  const retained = new Set(project.assets.map(asset => asset.data));
  for (const [data, cached] of editorMediaCache) {
    if (retained.has(data)) continue;
    editorMediaCache.delete(data);
    cached.promise.finally(() => { if (cached.url) URL.revokeObjectURL(cached.url); });
  }
}

function projectStorageEstimate() {
  // Base64 has no JSON escapes. Only metadata needs to be encoded to count bytes.
  let mediaBytes = 0;
  const metadata = JSON.stringify(project, function (key, value) {
    if (key === 'data' && typeof value === 'string' && ['image', 'audio'].includes(this.type)) {
      mediaBytes += value.length;
      return '';
    }
    return value;
  });
  return mediaBytes + new TextEncoder().encode(metadata).length;
}
