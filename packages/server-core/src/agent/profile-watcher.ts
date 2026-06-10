/**
 * Agent Profile hot-reload 逻辑
 *
 * 监听 .minicodeide/agents/ 目录，文件增/删/改 → debounce 500ms → 自动刷新。
 * 从 subagent-manager.ts 拆出，保持主文件 < 500 行。
 */
import * as fsSync from 'node:fs';
import path from 'node:path';
import { loadAgentProfiles, type AgentProfile } from './agent-profile-loader.js';

export class ProfileWatcher {
  private watcher: fsSync.FSWatcher | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private profiles = new Map<string, AgentProfile>();
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /** 启动时加载 profile + 启动 fs.watch */
  async init(): Promise<Map<string, AgentProfile>> {
    this.profiles = await loadAgentProfiles(this.workspaceRoot).catch(() => new Map());
    if (this.profiles.size > 0) {
      console.log(`[subagents] Loaded ${this.profiles.size} agent profiles: ${[...this.profiles.keys()].join(', ')}`);
    }
    this._startWatch();
    return this.profiles;
  }

  /** 手动刷新 profile */
  async refresh(): Promise<Map<string, AgentProfile>> {
    this.profiles = await loadAgentProfiles(this.workspaceRoot);
    return this.profiles;
  }

  /** 获取当前 profile 缓存 */
  getProfiles(): Map<string, AgentProfile> {
    return this.profiles;
  }

  /** 返回所有 profile 名（用于 tool description 动态填充） */
  getProfileNames(): Array<{ name: string; description: string }> {
    return [...this.profiles.values()].map((p) => ({ name: p.name, description: p.description }));
  }

  /** 停止 watcher（server shutdown 时调用） */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  // ─── 内部 ─────────────────────────────────────────────

  private _startWatch() {
    const agentsDir = path.join(this.workspaceRoot, '.minicodeide', 'agents');
    try {
      const stat = fsSync.statSync(agentsDir);
      if (!stat.isDirectory()) return;
    } catch {
      // 目录不存在 → 不监听
      return;
    }

    try {
      this.watcher = fsSync.watch(agentsDir, (eventType: string, filename: string | null) => {
        if (!filename || !filename.endsWith('.md')) return;
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(async () => {
          try {
            this.profiles = await this.refresh();
            console.log(`[subagents] Hot-reloaded ${this.profiles.size} agent profiles (trigger: ${eventType} ${filename})`);
          } catch (e: any) {
            console.error(`[subagents] Hot-reload failed: ${e?.message ?? e}`);
          }
        }, 500);
      });
      console.log(`[subagents] Watching ${agentsDir} for profile hot-reload`);
    } catch (e: any) {
      console.warn(`[subagents] fs.watch on ${agentsDir} failed: ${e?.message ?? e}. Profiles will NOT auto-reload.`);
    }
  }
}
