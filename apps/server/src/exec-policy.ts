
/**
 * ExecPolicy —— shell 命令安全策略
 *
 * 设计目标（参考 CodeFlicker 的 exec-approval，简化版）：
 *  - 不做完整沙箱（Docker 太重），靠 「分类 + 审批 + 路径守卫」 三板斧挡 90% 风险
 *  - 三档：auto（直跑）/ ask（弹审批）/ deny（直拒），优先级 deny > auto > ask
 *  - 解析时拆 shell pipeline（| && ; > 等），每段单独判定，只要有一段 deny → 整体 deny
 *
 * 已知短板（明确告诉用户的）：
 *  - LLM 可能 base64 encode 命令绕过白名单（mitigation：black list 含 base64 / eval 自身）
 *  - LLM 可能写一个脚本然后跑（mitigation：black list 含 sh script.sh / bash -c）
 *  - 完整对抗 prompt injection 必须靠 Docker，本项目不做
 */

export type ExecVerdict = 'auto' | 'ask' | 'deny';

export interface ExecPolicyDecision {
  verdict: ExecVerdict;
  /** 给前端 / 日志看的人类可读理由 */
  reason: string;
  /** 命中的规则名（用于审计） */
  matchedRule?: string;
}

/**
 * 命令分类（按 token 前缀的程序名匹配）。
 * 注意：这里识别的是单段 command（不含 pipe）。完整命令由 decideCommand 拆分后逐段调用。
 */
const AUTO_PROGRAMS = new Set([
  // 读类
  'ls', 'cat', 'head', 'tail', 'wc', 'file', 'stat', 'pwd', 'which', 'whoami', 'date',
  'echo', 'printf',
  // git 只读
  // ↓ git 的子命令在 isGitReadOnly 单独判断
  // 项目工具（典型 dev-loop，不会改 host）
  'node', 'npm', 'pnpm', 'yarn', 'npx',
  'tsc', 'eslint', 'prettier',
  'vitest', 'jest', 'mocha',
  'python', 'python3', 'pip', 'pip3',
  // 搜索
  'grep', 'rg', 'ripgrep', 'find', 'fd', 'ag',
  // 其他无害
  'jq', 'yq', 'tree', 'env',
]);

/** 显式禁掉（无论上下文都拒） */
const DENY_PROGRAMS = new Set([
  'sudo', 'su',
  'rm', // rm 单独看（有 -rf / 路径敏感）
  'chmod', 'chown',
  'kill', 'killall', 'pkill',
  'shutdown', 'reboot', 'halt',
  'dd',
  'mkfs', 'fdisk',
  'mount', 'umount',
  // 网络下载（可能拉恶意 payload）
  'curl', 'wget',
  // 远程执行
  'ssh', 'scp', 'sftp', 'rsync',
  // shell 内联执行（用来绕白名单）
  'eval', 'exec', 'source', '.',
  // 包管理（host 级别副作用）
  'brew', 'apt', 'apt-get', 'yum', 'dnf', 'pacman',
  // 加密/解密命令行（常被用来转储敏感数据）
  'gpg', 'openssl',
]);

/**
 * 危险参数模式（即使程序名是 auto，也升级为 ask 或 deny）
 */
const DANGEROUS_PATTERNS: Array<{ re: RegExp; reason: string; to: 'ask' | 'deny' }> = [
  { re: /(^|\s)-rf?\s+\/(\s|$)/, reason: '尝试 rm -rf 根目录', to: 'deny' },
  { re: /(^|\s)\/etc\//, reason: '访问系统配置目录 /etc', to: 'ask' },
  { re: /(^|\s)\/Users\/[^/\s]+\/\.ssh/, reason: '访问 SSH 私钥目录', to: 'deny' },
  { re: /(^|\s)\$HOME\/\.ssh/, reason: '访问 SSH 私钥目录', to: 'deny' },
  { re: /(^|\s)\.aws\//, reason: '访问 AWS 凭据', to: 'deny' },
  { re: /(^|\s)127\.0\.0\.1|localhost/, reason: '访问本机服务', to: 'ask' },
  { re: /(^|\s)169\.254|192\.168|10\.\d|172\.(1[6-9]|2\d|3[01])\./, reason: '访问内网 IP', to: 'ask' },
  { re: /base64\s+-d/, reason: 'base64 解码后执行的反混淆', to: 'deny' },
  { re: />\s*\/dev\/(?!null)/, reason: '写入特殊设备文件', to: 'deny' },
];

/**
 * 拆分 shell 复合命令为「单段命令」数组。
 * 简化版：按 |、&&、||、;、$()、`` 分隔；不严格处理转义（容错优先）。
 */
function splitPipeline(raw: string): string[] {
  // 先把命令替换 $(...) 和 `...` 里的子命令也提取出来
  const sub: string[] = [];
  const cleaned = raw
    .replace(/\$\(([^)]+)\)/g, (_m, inner) => {
      sub.push(inner);
      return ' '; // 占位
    })
    .replace(/`([^`]+)`/g, (_m, inner) => {
      sub.push(inner);
      return ' ';
    });
  const parts = cleaned
    .split(/\|\||&&|\||;|\bthen\b|\bdo\b/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...parts, ...sub];
}

/** 提取一段命令的程序名（第一个 token，去掉路径前缀） */
function programOf(segment: string): string {
  const tokens = segment.trim().split(/\s+/);
  if (tokens.length === 0) return '';
  let p = tokens[0];
  // env VAR=xxx command → 跳过 env 赋值
  while (/^[A-Z_][A-Z0-9_]*=/.test(p) && tokens.length > 1) {
    tokens.shift();
    p = tokens[0];
  }
  // 去掉路径前缀 /usr/bin/foo → foo
  const slash = p.lastIndexOf('/');
  if (slash >= 0) p = p.slice(slash + 1);
  return p;
}

function isGitReadOnly(segment: string): boolean {
  const tokens = segment.trim().split(/\s+/);
  if (tokens[0] !== 'git') return false;
  const sub = tokens[1];
  const READ_ONLY_GIT = new Set([
    'status', 'diff', 'log', 'show', 'blame', 'branch', 'remote', 'config',
    'rev-parse', 'rev-list', 'ls-files', 'ls-tree', 'describe', 'tag', 'stash',
  ]);
  if (!sub) return false;
  // git config --get 是读，git config --set 是写；保守只放 --get / 不带 set 的当读
  if (sub === 'config' && tokens.includes('--set')) return false;
  return READ_ONLY_GIT.has(sub);
}

function decideSegment(segment: string): ExecPolicyDecision {
  const seg = segment.trim();
  if (!seg) return { verdict: 'auto', reason: 'empty', matchedRule: 'empty' };

  // 1. 危险模式：最优先（包含 deny 的直接 deny）
  for (const p of DANGEROUS_PATTERNS) {
    if (p.re.test(seg)) {
      if (p.to === 'deny') {
        return { verdict: 'deny', reason: p.reason, matchedRule: 'dangerous-pattern' };
      }
    }
  }

  const prog = programOf(seg);

  // 2. 程序名 deny
  if (DENY_PROGRAMS.has(prog)) {
    // 特殊：rm 不带 -rf 且路径只在 workspace 内可以升级为 ask
    if (prog === 'rm' && !/\s-r?f?r?\s|\s-fr?\s/.test(seg)) {
      return { verdict: 'ask', reason: 'rm 命令需要确认', matchedRule: 'rm-soft' };
    }
    return { verdict: 'deny', reason: `禁用程序: ${prog}`, matchedRule: `deny-prog:${prog}` };
  }

  // 3. git 子命令：读类放行，写类 ask
  if (prog === 'git') {
    if (isGitReadOnly(seg)) {
      return { verdict: 'auto', reason: 'git 只读子命令', matchedRule: 'git-readonly' };
    }
    return { verdict: 'ask', reason: 'git 写类操作（commit/push/checkout 等）需要确认', matchedRule: 'git-write' };
  }

  // 4. 白名单程序
  if (AUTO_PROGRAMS.has(prog)) {
    // 检查危险模式中的 ask 类
    for (const p of DANGEROUS_PATTERNS) {
      if (p.to === 'ask' && p.re.test(seg)) {
        return { verdict: 'ask', reason: p.reason, matchedRule: 'dangerous-soft' };
      }
    }
    return { verdict: 'auto', reason: `白名单程序: ${prog}`, matchedRule: `auto-prog:${prog}` };
  }

  // 5. 默认 ask
  return { verdict: 'ask', reason: `未知程序 ${prog || '(空)'} 需要确认`, matchedRule: 'unknown' };
}

/**
 * 对一条完整 shell 命令做策略判定。
 * 拆 pipeline → 每段独立 decide → 合并：
 *  - 任一段 deny → 整体 deny
 *  - 否则任一段 ask → 整体 ask
 *  - 全部 auto → 整体 auto
 */
export function decideCommand(command: string): ExecPolicyDecision {
  const segments = splitPipeline(command);
  if (segments.length === 0) {
    return { verdict: 'ask', reason: '空命令', matchedRule: 'empty' };
  }
  let worst: ExecPolicyDecision = { verdict: 'auto', reason: '全部白名单', matchedRule: 'all-auto' };
  for (const seg of segments) {
    const d = decideSegment(seg);
    if (d.verdict === 'deny') return d; // 早退
    if (d.verdict === 'ask' && worst.verdict === 'auto') {
      worst = d;
    }
  }
  return worst;
}