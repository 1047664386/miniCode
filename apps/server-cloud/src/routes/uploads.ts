
/**
 * 分块 / 断点续传上传协议
 *
 * 协议：
 *   POST /api/uploads/init      { path, size, totalChunks, chunkSize, fingerprint }
 *      -> { uploadId, received: number[] }   // received 让客户端可跳过已传 chunk
 *   PUT  /api/uploads/chunk     ?uploadId=&index=   raw body (bytes)
 *      -> { ok, received }
 *   POST /api/uploads/complete  { uploadId }
 *      -> { ok, path, size }
 *   GET  /api/uploads/status    ?uploadId=
 *      -> { uploadId, totalChunks, received: number[], path }
 *   DELETE /api/uploads/abort   { uploadId }
 *      -> { ok }
 *
 * 存储：所有临时 chunk 落地到沙箱的 `.uploads/{uploadId}/cNNNN`（base64），
 *       manifest 落地到 `.uploads/{uploadId}/manifest.json`。
 * Resume 通过 fingerprint（fileName + size + lastModified）查 manifest 完成。
 *
 * 安全限制：
 *   - chunkSize 上限 8MB（接近 bodyLimit），客户端推荐 4MB
 *   - 单个 upload 最多 4096 个 chunk（≈ 32GB 上限）
 *   - 24h 未完成的 upload 视为僵死（清理由 sandbox TTL 兜底）
 */
import type { FastifyPluginAsync } from 'fastify';
import type { SandboxProvider } from '@mini/sandbox';
import { randomBytes } from 'node:crypto';

const MAX_CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_CHUNK_COUNT = 4096;

interface Manifest {
  uploadId: string;
  path: string;
  size: number;
  totalChunks: number;
  chunkSize: number;
  fingerprint: string;
  createdAt: number;
  // received 存到磁盘是冗余信息（list `.uploads/{uploadId}/c*` 才是 source of truth）
  // 但缓存可以加速 status 查询
  received: number[];
}

interface Deps {
  sandbox: SandboxProvider;
}

function sandboxKey(req: any) {
  return `u_${req.userId ?? 'anon'}`;
}
function uploadDir(uploadId: string) {
  return `/.uploads/${uploadId}`;
}
function chunkPath(uploadId: string, index: number) {
  // 4 位 0 padding 让目录排序自然
  return `${uploadDir(uploadId)}/c${String(index).padStart(4, '0')}`;
}
function manifestPath(uploadId: string) {
  return `${uploadDir(uploadId)}/manifest.json`;
}

async function readManifest(sb: any, uploadId: string): Promise<Manifest | null> {
  try {
    const r = await sb.read(manifestPath(uploadId));
    return JSON.parse(r.content) as Manifest;
  } catch {
    return null;
  }
}

async function writeManifest(sb: any, m: Manifest) {
  await sb.write(manifestPath(m.uploadId), JSON.stringify(m), 'utf-8');
}

/** list `.uploads/{uploadId}/` and return chunk indexes that exist */
async function listReceived(sb: any, uploadId: string): Promise<number[]> {
  try {
    const list = await sb.list({ path: uploadDir(uploadId) });
    const out: number[] = [];
    for (const f of list) {
      if (f.isDir) continue;
      const m = /\/c(\d+)$/.exec(f.path);
      if (m) out.push(parseInt(m[1], 10));
    }
    return out.sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/** Resume 关键：通过 fingerprint 查找正在进行中的 upload */
async function findUploadByFingerprint(sb: any, fingerprint: string): Promise<Manifest | null> {
  try {
    const list = await sb.list({ path: '/.uploads' });
    for (const e of list) {
      if (!e.isDir) continue;
      const id = e.path.replace(/^\/\.uploads\//, '').replace(/\/$/, '');
      const m = await readManifest(sb, id);
      if (m && m.fingerprint === fingerprint) return m;
    }
  } catch { /* dir 不存在 = 没有 upload */ }
  return null;
}

export function makeUploadsRoutes({ sandbox }: Deps): FastifyPluginAsync {
  return async (app) => {
    // ---- Init / Resume ----
    app.post('/init', async (req, reply) => {
      const body = (req.body ?? {}) as Partial<Manifest>;
      const path = String(body.path ?? '').trim();
      const size = Number(body.size ?? 0);
      const totalChunks = Number(body.totalChunks ?? 0);
      const chunkSize = Number(body.chunkSize ?? 0);
      const fingerprint = String(body.fingerprint ?? '').trim();

      if (!path) return reply.code(400).send({ error: 'path required' });
      if (!fingerprint) return reply.code(400).send({ error: 'fingerprint required' });
      if (size <= 0 || totalChunks <= 0 || chunkSize <= 0) {
        return reply.code(400).send({ error: 'size/totalChunks/chunkSize must be positive' });
      }
      if (chunkSize > MAX_CHUNK_SIZE) {
        return reply.code(413).send({ error: `chunkSize > ${MAX_CHUNK_SIZE}` });
      }
      if (totalChunks > MAX_CHUNK_COUNT) {
        return reply.code(413).send({ error: `totalChunks > ${MAX_CHUNK_COUNT}` });
      }

      const sb = await sandbox.getOrCreate(sandboxKey(req));

      // 1) 同 fingerprint 已有进行中的 upload → 复用 + 返回已接收 chunk
      const existing = await findUploadByFingerprint(sb, fingerprint);
      if (existing && existing.path === path && existing.size === size && existing.totalChunks === totalChunks) {
        const received = await listReceived(sb, existing.uploadId);
        return { uploadId: existing.uploadId, received, resumed: true };
      }

      // 2) 新建一个 uploadId
      const uploadId = randomBytes(8).toString('hex');
      const m: Manifest = {
        uploadId, path, size, totalChunks, chunkSize, fingerprint,
        createdAt: Date.now(), received: [],
      };
      // 创建目录（写一个占位文件让 mkdir 触发）
      await sb.write(`${uploadDir(uploadId)}/.keep`, '', 'utf-8');
      await writeManifest(sb, m);
      return { uploadId, received: [] as number[], resumed: false };
    });

    // ---- Status (用于断网重连后的进度查询) ----
    app.get('/status', async (req, reply) => {
      const q = req.query as any;
      const uploadId = String(q?.uploadId ?? '').trim();
      if (!uploadId) return reply.code(400).send({ error: 'uploadId required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const m = await readManifest(sb, uploadId);
      if (!m) return reply.code(404).send({ error: 'upload not found' });
      const received = await listReceived(sb, uploadId);
      return { uploadId, totalChunks: m.totalChunks, received, path: m.path, size: m.size };
    });

    // ---- Chunk (raw body) ----
    // 用 raw bytes 而不是 JSON：避免 base64 30% 膨胀；用 octet-stream
    app.put('/chunk', {
      // 让 fastify 把 body 收成 Buffer 而不是尝试 JSON.parse
      bodyLimit: MAX_CHUNK_SIZE + 1024,
    }, async (req, reply) => {
      const q = req.query as any;
      const uploadId = String(q?.uploadId ?? '').trim();
      const index = Number(q?.index ?? -1);
      if (!uploadId || !Number.isInteger(index) || index < 0) {
        return reply.code(400).send({ error: 'uploadId & index required' });
      }
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const m = await readManifest(sb, uploadId);
      if (!m) return reply.code(404).send({ error: 'upload not found' });
      if (index >= m.totalChunks) return reply.code(400).send({ error: 'index out of range' });

      const buf: Buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buf)) {
        return reply.code(400).send({ error: 'expected raw octet-stream body' });
      }
      // 写到沙箱（base64）。已存在则覆盖（幂等）
      await sb.write(chunkPath(uploadId, index), buf.toString('base64'), 'base64');

      const received = await listReceived(sb, uploadId);
      return { ok: true, received: received.length, totalChunks: m.totalChunks };
    });

    // ---- Complete (assemble) ----
    app.post('/complete', async (req, reply) => {
      const body = (req.body ?? {}) as any;
      const uploadId = String(body?.uploadId ?? '').trim();
      if (!uploadId) return reply.code(400).send({ error: 'uploadId required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const m = await readManifest(sb, uploadId);
      if (!m) return reply.code(404).send({ error: 'upload not found' });

      const received = await listReceived(sb, uploadId);
      if (received.length !== m.totalChunks) {
        return reply.code(400).send({
          error: 'incomplete',
          received: received.length,
          totalChunks: m.totalChunks,
          missing: Array.from({ length: m.totalChunks }, (_, i) => i).filter((i) => !received.includes(i)),
        });
      }

      // 拼接所有 chunk 的二进制，写入最终文件
      const buffers: Buffer[] = [];
      for (let i = 0; i < m.totalChunks; i++) {
        const r = await sb.read(chunkPath(uploadId, i));
        const buf = Buffer.from(r.content, r.encoding === 'base64' ? 'base64' : 'utf-8');
        buffers.push(buf);
      }
      const all = Buffer.concat(buffers);
      if (m.size && all.length !== m.size) {
        return reply.code(400).send({ error: `size mismatch: assembled ${all.length} expected ${m.size}` });
      }
      // 二进制都按 base64 写（mem provider 能正确还原）
      await sb.write(m.path, all.toString('base64'), 'base64');

      // 清理临时目录
      try {
        for (let i = 0; i < m.totalChunks; i++) {
          await sb.exec(`rm -f ${shellQuote(chunkPath(uploadId, i))}`);
        }
        await sb.exec(`rm -rf ${shellQuote(uploadDir(uploadId))}`);
      } catch { /* 清理失败不阻塞 */ }

      return { ok: true, path: m.path, size: all.length };
    });

    // ---- Abort ----
    app.delete('/abort', async (req, reply) => {
      const body = (req.body ?? {}) as any;
      const uploadId = String(body?.uploadId ?? '').trim();
      if (!uploadId) return reply.code(400).send({ error: 'uploadId required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      try { await sb.exec(`rm -rf ${shellQuote(uploadDir(uploadId))}`); } catch {}
      return { ok: true };
    });
  };
}

function shellQuote(s: string) {
  return `'${s.replace(/'/g, "'\\''")}'`;
}