
/**
 * KeyRotator —— 同一 Provider 多 API Key 轮换 + 错误冷却
 * ---------------------------------------------------------------
 * 场景：一个云 Provider 配多个 apiKey（绕开单 key 的 RPM/RPD quota），
 *      或在团队部署时多人共享一份 server 配置但配多份 key 分摊。
 *
 * 策略：
 *  - round-robin 轮询；同一 profile.id 共享一个 KeyRotator 实例（按 profileId 缓存）
 *  - 429 → 冷却 60 秒；5xx → 冷却 10 秒；timeout/network → 冷却 5 秒
 *  - 全部 key 都在冷却 → 抛 AllKeysCooldownError（router 再走下一个 profile）
 *
 * 注：cooldown 是 in-memory 的，进程重启后清空。这是 trade-off：
 *      多机部署时各机各自独立计数，单机简单。要全局得用 Redis，过度设计。
 */
import type { LLMErrorKind } from './llm-router.js';

export class AllKeysCooldownError extends Error {
  constructor(public profileId: string, public nextAvailableInMs: number) {
    super(
      `[KeyRotator] all keys for profile '${profileId}' are in cooldown; next slot available in ${Math.ceil(
        nextAvailableInMs / 1000,
      )}s`,
    );
  }
}

interface KeyState {
  key: string;
  cooldownUntil: number;
  successCount: number;
  failCount: number;
}

export class KeyRotator {
  private keys: KeyState[];
  private cursor = 0;

  constructor(private profileId: string, keys: string[]) {
    if (keys.length === 0) throw new Error('KeyRotator: at least 1 key required');
    this.keys = keys.map((k) => ({ key: k, cooldownUntil: 0, successCount: 0, failCount: 0 }));
  }

  /**
   * 拿一个可用 key。round-robin。
   * 全在冷却 → 抛 AllKeysCooldownError。
   */
  pick(): KeyState {
    const now = Date.now();
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.cursor + i) % this.keys.length;
      const s = this.keys[idx];
      if (s.cooldownUntil <= now) {
        this.cursor = (idx + 1) % this.keys.length;
        return s;
      }
    }
    // 全冷却 → 算下一个能用的
    const nextAt = Math.min(...this.keys.map((k) => k.cooldownUntil));
    throw new AllKeysCooldownError(this.profileId, Math.max(0, nextAt - now));
  }

  markSuccess(key: string) {
    const s = this.keys.find((x) => x.key === key);
    if (s) {
      s.successCount++;
      s.cooldownUntil = 0; // 成功 → 立即解封
    }
  }

  markFailure(key: string, errKind: LLMErrorKind) {
    const s = this.keys.find((x) => x.key === key);
    if (!s) return;
    s.failCount++;
    const now = Date.now();
    let cd = 0;
    switch (errKind) {
      case 'http_429':
        cd = 60_000;
        break;
      case 'http_401':
        cd = 5 * 60_000; // 401 → key 可能失效，冷却 5 分钟
        break;
      case 'http_5xx':
        cd = 10_000;
        break;
      case 'timeout':
      case 'network':
        cd = 5_000;
        break;
      default:
        cd = 3_000;
    }
    s.cooldownUntil = now + cd;
  }

  /** 调试 / metrics */
  stats() {
    const now = Date.now();
    return this.keys.map((k) => ({
      keyTail: k.key.slice(-6),
      cooldownMs: Math.max(0, k.cooldownUntil - now),
      success: k.successCount,
      fail: k.failCount,
    }));
  }

  size() {
    return this.keys.length;
  }
}

/* -------------------- registry: profile.id → rotator -------------------- */
const rotators = new Map<string, KeyRotator>();
/** 侧信道缓存签名，避免给 KeyRotator 添加非业务属性 */
const sigMap = new WeakMap<KeyRotator, string>();

/**
 * 获取 / 创建 profile 的 rotator。
 * keys 的引用变化（比如新加 key 后重启）通过 keysSig 检测。
 */
export function getOrCreateRotator(profileId: string, keys: string[]): KeyRotator {
  const sig = profileId + ':' + keys.length + ':' + keys.map((k) => k.slice(-4)).join(',');
  const cached = rotators.get(profileId);
  if (cached && sigMap.get(cached) === sig) return cached;
  const r = new KeyRotator(profileId, keys);
  sigMap.set(r, sig);
  rotators.set(profileId, r);
  return r;
}

export function listRotatorStats() {
  const out: Record<string, ReturnType<KeyRotator['stats']>> = {};
  for (const [k, r] of rotators) out[k] = r.stats();
  return out;
}