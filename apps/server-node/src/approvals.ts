
/**
 * approvals.ts —— inline approval bus（替代 express 版的 approvals queue）
 * 极简：内存队列 + Map<id, callback>
 */
export interface ApprovalRequest {
  id: string;
  cmd: string;
  ts: number;
  resolver: (decision: 'allow' | 'deny') => void;
}

export class ApprovalsStore {
  private waiting = new Map<string, ApprovalRequest>();

  list(): Array<{ id: string; cmd: string; ts: number }> {
    return [...this.waiting.values()].map(({ resolver: _r, ...rest }) => rest);
  }

  /** 加入等待队列；返回 Promise，resolve 时拿到决定 */
  enqueue(cmd: string): Promise<'allow' | 'deny'> {
    const id = `apv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      this.waiting.set(id, { id, cmd, ts: Date.now(), resolver: resolve });
    });
  }

  /** 通过 id 决议 */
  decide(id: string, decision: 'allow' | 'deny'): boolean {
    const r = this.waiting.get(id);
    if (!r) return false;
    this.waiting.delete(id);
    r.resolver(decision);
    return true;
  }
}