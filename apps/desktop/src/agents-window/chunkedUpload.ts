
/**
 * chunkedUpload — 大文件分块上传 + 断点续传 + 进度回调
 *
 * 用法：
 *   await chunkedUpload(file, '/path/in/sandbox.zip', (p) => console.log(p));
 *
 * 协议：apps/server-cloud/src/routes/uploads.ts
 *
 * 最佳实践：
 *  - chunkSize 4MB（HTTP/2 单流默认 OK；HTTP/1.1 nginx 默认 client_max_body_size 1m，
 *    上线时记得改 nginx 到 8m+）
 *  - 并发 3：吃满带宽但不打爆服务器
 *  - 失败重试：指数退避，单 chunk 最多 5 次
 *  - localStorage 持久化 uploadId+fingerprint：刷新后能续传
 *  - fingerprint = name + size + lastModified（不算 hash，避免大文件 sha 太慢）
 */

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
const CONCURRENCY = 3;
const MAX_RETRY = 5;
const LS_KEY = 'mci.upload.resumes';
const RESUME_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface UploadProgress {
  /** 0..1 */
  ratio: number;
  /** 已完成 chunk 数 */
  done: number;
  /** 总 chunk 数 */
  total: number;
  /** 实时速度 bytes/sec */
  speed: number;
  /** 当前阶段 */
  phase: 'init' | 'uploading' | 'completing' | 'done';
  /** 是否是断点续传（首次报告时携带） */
  resumed?: boolean;
  uploadId?: string;
}

export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (p: UploadProgress) => void;
}

interface ResumeEntry {
  uploadId: string;
  fingerprint: string;
  path: string;
  size: number;
  ts: number;
}

function loadResumes(): Record<string, ResumeEntry> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, ResumeEntry>;
    // 过期清理
    const now = Date.now();
    let dirty = false;
    for (const k of Object.keys(obj)) {
      if (now - (obj[k].ts ?? 0) > RESUME_TTL_MS) { delete obj[k]; dirty = true; }
    }
    if (dirty) localStorage.setItem(LS_KEY, JSON.stringify(obj));
    return obj;
  } catch { return {}; }
}

function saveResume(entry: ResumeEntry) {
  const all = loadResumes();
  all[entry.fingerprint] = entry;
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
}

function clearResume(fingerprint: string) {
  const all = loadResumes();
  delete all[fingerprint];
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
}

function fingerprintOf(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

async function postJSON(url: string, body: any, signal?: AbortSignal) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
  return j;
}

async function putChunk(
  uploadId: string,
  index: number,
  blob: Blob,
  signal?: AbortSignal,
): Promise<void> {
  let attempt = 0;
  let lastErr: any;
  while (attempt < MAX_RETRY) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    try {
      const r = await fetch(`/api/uploads/chunk?uploadId=${encodeURIComponent(uploadId)}&index=${index}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: blob,
        signal,
      });
      if (r.ok) return;
      // 4xx 直接抛
      if (r.status >= 400 && r.status < 500) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${r.status}`);
      }
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      lastErr = e;
    }
    attempt++;
    // 指数退避：250ms, 500ms, 1s, 2s, 4s
    await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt - 1)));
  }
  throw lastErr ?? new Error('chunk upload failed');
}

export async function chunkedUpload(
  file: File,
  destPath: string,
  opts: UploadOptions = {},
): Promise<{ uploadId: string; size: number; resumed: boolean }> {
  const { signal, onProgress } = opts;
  const fp = fingerprintOf(file);
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  onProgress?.({ ratio: 0, done: 0, total: totalChunks, speed: 0, phase: 'init' });

  // 1) init / resume
  const init = await postJSON('/api/uploads/init', {
    path: destPath,
    size: file.size,
    totalChunks,
    chunkSize: CHUNK_SIZE,
    fingerprint: fp,
  }, signal);
  const uploadId: string = init.uploadId;
  const resumed: boolean = !!init.resumed;
  const receivedSet = new Set<number>(Array.isArray(init.received) ? init.received : []);
  saveResume({ uploadId, fingerprint: fp, path: destPath, size: file.size, ts: Date.now() });

  onProgress?.({
    ratio: receivedSet.size / totalChunks,
    done: receivedSet.size,
    total: totalChunks,
    speed: 0,
    phase: 'uploading',
    resumed,
    uploadId,
  });

  // 2) 并发上传缺失的 chunk
  const missing: number[] = [];
  for (let i = 0; i < totalChunks; i++) if (!receivedSet.has(i)) missing.push(i);

  let doneCount = receivedSet.size;
  let doneBytes = 0;
  const startTs = Date.now();

  // 简单的并发池
  let cursor = 0;
  const worker = async () => {
    while (true) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const idx = cursor++;
      if (idx >= missing.length) return;
      const ci = missing[idx];
      const start = ci * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      await putChunk(uploadId, ci, blob, signal);
      doneCount++;
      doneBytes += end - start;
      const elapsed = Math.max(1, Date.now() - startTs) / 1000;
      onProgress?.({
        ratio: doneCount / totalChunks,
        done: doneCount,
        total: totalChunks,
        speed: doneBytes / elapsed,
        phase: 'uploading',
        uploadId,
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, () => worker()));

  // 3) complete
  onProgress?.({ ratio: 1, done: totalChunks, total: totalChunks, speed: 0, phase: 'completing', uploadId });
  const cmp = await postJSON('/api/uploads/complete', { uploadId }, signal);
  clearResume(fp);
  onProgress?.({ ratio: 1, done: totalChunks, total: totalChunks, speed: 0, phase: 'done', uploadId });
  return { uploadId, size: cmp.size, resumed };
}

export async function abortUpload(uploadId: string) {
  try {
    await fetch('/api/uploads/abort', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uploadId }),
    });
  } catch { /* ignore */ }
}

export function listResumableUploads(): ResumeEntry[] {
  return Object.values(loadResumes());
}