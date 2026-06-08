
/**
 * BYOK API Key 加解密
 *
 * 设计要求：
 *  - 用 JWT_SECRET 派生 AES-256-GCM 密钥（无需新增 secret）
 *  - 加密格式：base64(iv(12) | ciphertext | tag(16))
 *  - 数据库里只存密文，server 重启不影响（key 来自 env）
 *
 * 安全性提示：
 *  - 这只能防数据库泄露后明文 key 直接暴露，不能防 server 内存被读取
 *  - prod 应换成 KMS 托管（M5）
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function deriveKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'dev-only-secret';
  // sha256(secret) → 32 bytes，作为 AES-256 key
  return createHash('sha256').update(secret).digest();
}

export function encryptApiKey(plain: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

export function decryptApiKey(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}