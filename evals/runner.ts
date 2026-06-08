
/**
 * Eval Runner —— mini SWE-bench
 *
 * 设计：
 *  - 跑前会把 fixture 复制到 tmp 工作区（每个 case 隔离）
 *  - 通过 HTTP 调用一个本地 mini server（用临时 WORKSPACE 启动）
 *  - 收集 SSE 事件统计 toolsUsed / filesTouched / tokens
 *  - case 跑完用 verify[] 规则判定成功
 *
 * 用法：
 *   pnpm --filter @mini/evals eval                  # 跑全部
 *   pnpm --filter @mini/evals eval -- --case edit-001  # 跑指定
 *   pnpm --filter @mini/evals eval -- --quick       # 只跑 fast cases
 *
 * 必需环境：本地至少有一个 chat provider 配好（.minicodeide/providers.json 或 OPENAI_API_KEY）
 *
 * 输出：reports/<timestamp>.json + 终端摘要表
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import * as os from 'node:os';

interface VerifyRule {
  type: 'fileContains' | 'fileNotContains' | 'fileExists' | 'llmJudge' | 'retrievalIncludes';
  path?: string;
  needle?: string;
  /** llmJudge fields */
  question?: string;
  expectedConcepts?: string[];
  context?: string;
  passThreshold?: number;
  /** retrievalIncludes fields：期望检索结果的某个命中文件路径包含某子串，可用 maxRank 限定“前 N 名” */
  pathPattern?: string;
  maxRank?: number;
}

interface EvalCase {
  id: string;
  category: string;
  description: string;
  fixture: string;
  prompt: string;
  expected: {
    filesTouched?: string[];
    toolsUsed?: string[];
    toolsForbidden?: string[];
    answerContains?: string[];
    verify?: VerifyRule[];
    /** 期望召回到的 memory：标题/关键词字符串数组，至少一个 mem 标题命中即算通过 */
    memoryRecall?: string[];
  };
  /** 在跑 case 前往 memory 里 seed 这些条目（user/project scope 都写） */
  seedMemory?: Array<{
    scope?: 'user' | 'project';
    title: string;
    content: string;
    category?: string;
    keywords?: string[];
    importance?: number;
  }>;
  maxSteps?: number;
  budgetTokens?: number;
}

interface CaseResult {
  id: string;
  category: string;
  pass: boolean;
  reasons: string[];
  steps: number;
  tokens: { prompt: number; completion: number; cached: number };
  durationMs: number;
  toolsUsed: string[];
  filesTouched: string[];
  finalAnswer: string;
  /** 本轮被 server 召回到的 memory 标题（来自 memory_recalled SSE） */
  memoryRecalled: string[];
  /** 本轮检索命中（来自 retrieval SSE） */
  retrieval: { rank: number; file: string }[];
  /** 有多少条 llmJudge 评分 + 平均分 */
  judgeScores?: { question: string; score: number; pass: boolean; reasoning: string }[];
}

const ROOT = path.resolve(new URL('.', import.meta.url).pathname);
const REPO_ROOT = path.resolve(ROOT, '..');
const CASES_DIR = path.join(ROOT, 'cases');
const FIXTURES_DIR = path.join(ROOT, 'fixtures');
const REPORTS_DIR = path.join(ROOT, 'reports');

// ---------- argparse ----------
const args = process.argv.slice(2);
const caseFilter = (() => {
  const i = args.indexOf('--case');
  return i >= 0 ? args[i + 1] : null;
})();
const quick = args.includes('--quick');

// ---------- main ----------
async function main() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const cases = await loadCases();
  const filtered = cases.filter((c) => {
    if (caseFilter && !c.id.includes(caseFilter)) return false;
    if (quick && (c.maxSteps ?? 0) > 10) return false;
    return true;
  });
  if (filtered.length === 0) {
    console.error('No cases match filter');
    process.exit(1);
  }

  console.log(`▶ Running ${filtered.length} case(s)\n`);
  const results: CaseResult[] = [];
  for (const c of filtered) {
    console.log(`── ${c.id} (${c.category}) ──`);
    const r = await runCase(c);
    results.push(r);
    console.log(
      `  ${r.pass ? '✓ PASS' : '✗ FAIL'}  ` +
        `steps=${r.steps} tokens=${r.tokens.prompt + r.tokens.completion} ` +
        `dur=${r.durationMs}ms`,
    );
    if (!r.pass) for (const rs of r.reasons) console.log(`    · ${rs}`);
  }

  printSummary(results);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.writeFile(
    path.join(REPORTS_DIR, `${ts}.json`),
    JSON.stringify({ ts, results }, null, 2),
  );
  console.log(`\n📄 Report: evals/reports/${ts}.json`);

  // Baseline 对比：如果存在 evals/baseline.json，逐 case 对比 token + pass 状态
  await compareBaseline(results);

  // 如果传 --update-baseline，把当前结果写为新 baseline
  if (args.includes('--update-baseline')) {
    const baseline = results.map((r) => {
      const judge = r.judgeScores ?? [];
      const avgJudge = judge.length ? judge.reduce((a, j) => a + j.score, 0) / judge.length : null;
      return {
        id: r.id,
        pass: r.pass,
        tokens: r.tokens.prompt + r.tokens.completion,
        steps: r.steps,
        judgeAvg: avgJudge,
        retrievalTop3: (r.retrieval ?? []).filter((h) => h.rank <= 3).map((h) => h.file),
      };
    });
    await fs.writeFile(
      path.join(ROOT, 'baseline.json'),
      JSON.stringify({ ts, cases: baseline }, null, 2),
    );
    console.log(`\n📌 Baseline updated: evals/baseline.json`);
  }

  process.exit(results.every((r) => r.pass) ? 0 : 1);
}

async function loadCases(): Promise<EvalCase[]> {
  const files = await fs.readdir(CASES_DIR);
  const cases: EvalCase[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const txt = await fs.readFile(path.join(CASES_DIR, f), 'utf-8');
    cases.push(JSON.parse(txt));
  }
  cases.sort((a, b) => a.id.localeCompare(b.id));
  return cases;
}

// ---------- single case ----------
async function runCase(c: EvalCase): Promise<CaseResult> {
  const start = Date.now();
  const reasons: string[] = [];
  let steps = 0;
  const tokens = { prompt: 0, completion: 0, cached: 0 };
  const toolsUsed: string[] = [];
  const filesTouchedSet = new Set<string>();
  const memoryRecalled: string[] = [];
  const retrieval: { rank: number; file: string }[] = [];
  const judgeScores: { question: string; score: number; pass: boolean; reasoning: string }[] = [];
  let finalAnswer = '';

  // 1. 复制 fixture 到 tmp 沙盒
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), `mini-eval-${c.id}-`));
  await copyDir(path.join(FIXTURES_DIR, c.fixture), sandbox);

  // 2. 启动一个临时 server 指向沙盒
  const server = await spawnServer(sandbox);

  try {
    // 3. 等 indexReady
    await waitIndexReady(server.port, 30_000);

    // 3.5 seed memory（如果 case 配置了）
    if (c.seedMemory && c.seedMemory.length > 0) {
      for (const m of c.seedMemory) {
        try {
          await fetch(`http://127.0.0.1:${server.port}/api/memory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scope: m.scope ?? 'project',
              title: m.title,
              content: m.content,
              category: m.category ?? 'project_knowledge',
              keywords: m.keywords ?? [],
              importance: m.importance ?? 4,
            }),
          });
        } catch {
          /* ignore */
        }
      }
    }

    // 4. 创建 session（避免污染）
    const sessR = await fetch(`http://127.0.0.1:${server.port}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `eval:${c.id}` }),
    });
    const sess = await sessR.json();

    // 5. 调 /api/chat（SSE）
    const chatR = await fetch(`http://127.0.0.1:${server.port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [],
        userMessage: c.prompt,
        mode: 'agent',
        sessionId: sess.id,
        maxSteps: c.maxSteps ?? 12,
      }),
    });
    if (!chatR.ok || !chatR.body) {
      reasons.push(`HTTP ${chatR.status}`);
      return finalize();
    }
    const reader = chatR.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const ln of lines) {
        if (!ln.startsWith('data:')) continue;
        try {
          const ev = JSON.parse(ln.slice(5).trim());
          handleEvent(ev);
        } catch {
          /* */
        }
      }
    }

    // 6. 校验
    if (c.expected.filesTouched) {
      for (const f of c.expected.filesTouched) {
        if (!filesTouchedSet.has(f)) reasons.push(`expected to touch ${f}, but did not`);
      }
    }
    if (c.expected.toolsUsed) {
      for (const t of c.expected.toolsUsed) {
        if (!toolsUsed.includes(t)) reasons.push(`expected tool ${t} not used`);
      }
    }
    if (c.expected.toolsForbidden) {
      for (const t of c.expected.toolsForbidden) {
        if (toolsUsed.includes(t)) reasons.push(`forbidden tool ${t} was called`);
      }
    }
    if (c.expected.answerContains) {
      for (const needle of c.expected.answerContains) {
        if (!finalAnswer.toLowerCase().includes(needle.toLowerCase())) {
          reasons.push(`answer missing "${needle}"`);
        }
      }
    }
    if (c.expected.verify) {
      for (const v of c.expected.verify) {
        if (v.type === 'llmJudge') {
          const reason = await checkLlmJudge(server.port, v, finalAnswer, judgeScores);
          if (reason) reasons.push(reason);
        } else if (v.type === 'retrievalIncludes') {
          const reason = checkRetrievalIncludes(v, retrieval);
          if (reason) reasons.push(reason);
        } else {
          const reason = await checkVerifyRule(sandbox, v);
          if (reason) reasons.push(reason);
        }
      }
    }
    if ((c.budgetTokens ?? Infinity) < tokens.prompt + tokens.completion) {
      reasons.push(
        `over budget: ${tokens.prompt + tokens.completion} > ${c.budgetTokens}`,
      );
    }
    if (c.expected.memoryRecall && c.expected.memoryRecall.length > 0) {
      const titlesLower = memoryRecalled.map((t) => t.toLowerCase());
      for (const needle of c.expected.memoryRecall) {
        const n = needle.toLowerCase();
        if (!titlesLower.some((t) => t.includes(n))) {
          reasons.push(`expected memory recall containing "${needle}" not found (got: [${memoryRecalled.join(', ') || '<none>'}])`);
        }
      }
    }
  } catch (e: any) {
    reasons.push(`runtime error: ${e?.message ?? String(e)}`);
  } finally {
    server.proc.kill('SIGTERM');
    // 不删 sandbox，以便失败时复盘
  }

  function handleEvent(ev: any) {
    if (ev.type === 'text' && ev.text) finalAnswer += ev.text;
    if (ev.type === 'tool_call' && ev.toolCall?.name) {
      toolsUsed.push(ev.toolCall.name);
      // edit/write 工具取 path
      const args = ev.toolCall.arguments;
      if (args?.path && /^(edit_file|write_file)$/.test(ev.toolCall.name)) {
        filesTouchedSet.add(args.path);
      }
      steps++;
    }
    if (ev.type === 'usage' && ev.usage) {
      tokens.prompt = Math.max(tokens.prompt, ev.usage.promptTokens ?? 0);
      tokens.completion = Math.max(
        tokens.completion,
        ev.usage.completionTokens ?? 0,
      );
      tokens.cached = Math.max(tokens.cached, ev.usage.cachedPromptTokens ?? 0);
    }
    if (ev.type === 'memory_recalled' && Array.isArray(ev.items)) {
      for (const it of ev.items) {
        if (it?.title) memoryRecalled.push(String(it.title));
      }
    }
    if (ev.type === 'retrieval' && Array.isArray(ev.hits)) {
      for (const h of ev.hits) {
        if (h?.file && typeof h.rank === 'number') {
          retrieval.push({ rank: h.rank, file: String(h.file) });
        }
      }
    }
  }

  function finalize(): CaseResult {
    return {
      id: c.id,
      category: c.category,
      pass: reasons.length === 0,
      reasons,
      steps,
      tokens,
      durationMs: Date.now() - start,
      toolsUsed,
      filesTouched: [...filesTouchedSet],
      finalAnswer: finalAnswer.slice(0, 300),
      memoryRecalled,
      retrieval,
      judgeScores,
    };
  }
  return finalize();
}

async function checkVerifyRule(
  sandbox: string,
  v: VerifyRule,
): Promise<string | null> {
  if (!v.path) return `verify ${v.type}: missing path field`;
  const fp = path.join(sandbox, v.path);
  try {
    if (v.type === 'fileExists') {
      await fs.access(fp);
      return null;
    }
    const txt = await fs.readFile(fp, 'utf-8');
    if (v.type === 'fileContains') {
      if (!txt.includes(v.needle!)) return `${v.path} missing "${v.needle}"`;
    } else if (v.type === 'fileNotContains') {
      if (txt.includes(v.needle!))
        return `${v.path} unexpectedly contains "${v.needle}"`;
    }
    return null;
  } catch (e: any) {
    return `verify ${v.type} ${v.path} failed: ${e?.message ?? e}`;
  }
}

/** 调 server /api/judge 评 final answer */
async function checkLlmJudge(
  port: number,
  v: VerifyRule,
  finalAnswer: string,
  bucket: { question: string; score: number; pass: boolean; reasoning: string }[],
): Promise<string | null> {
  if (!v.question) return 'llmJudge: missing question';
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/judge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: v.question,
        answer: finalAnswer,
        expectedConcepts: v.expectedConcepts ?? [],
        context: v.context ?? '',
        passThreshold: v.passThreshold ?? 7,
      }),
    });
    if (!r.ok) return `llmJudge HTTP ${r.status}`;
    const data = (await r.json()) as { score: number; pass: boolean; reasoning: string; missing?: string[] };
    bucket.push({
      question: v.question,
      score: data.score,
      pass: data.pass,
      reasoning: data.reasoning,
    });
    if (!data.pass) {
      const miss = data.missing?.length ? ` missing=[${data.missing.join(', ')}]` : '';
      return `llmJudge fail score=${data.score}/${v.passThreshold ?? 7}: ${data.reasoning}${miss}`;
    }
    return null;
  } catch (e: any) {
    return `llmJudge error: ${e?.message ?? e}`;
  }
}

/** retrievalIncludes：检查检索命中的前 N 名里是否含某子串路径 */
function checkRetrievalIncludes(
  v: VerifyRule,
  hits: { rank: number; file: string }[],
): string | null {
  if (!v.pathPattern) return 'retrievalIncludes: missing pathPattern';
  const maxRank = v.maxRank ?? 6;
  const inRange = hits.filter((h) => h.rank <= maxRank);
  const hit = inRange.find((h) => h.file.includes(v.pathPattern!));
  if (!hit) {
    const sample = inRange.map((h) => `#${h.rank}:${h.file}`).join(', ');
    return `retrieval top-${maxRank} did not include "${v.pathPattern}" (got: ${sample || '<none>'})`;
  }
  return null;
}

// ---------- helpers ----------
async function copyDir(src: string, dst: string) {
  await fs.mkdir(dst, { recursive: true });
  for (const ent of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) await copyDir(s, d);
    else if (ent.isFile()) await fs.copyFile(s, d);
  }
}

interface SpawnedServer {
  proc: ChildProcess;
  port: number;
}
async function spawnServer(workspace: string): Promise<SpawnedServer> {
  const port = 18000 + Math.floor(Math.random() * 1000);
  const proc = spawn(
    'pnpm',
    ['--filter', '@mini/server', 'dev'],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        WORKSPACE: workspace,
        PORT: String(port),
        NODE_ENV: 'eval',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  proc.stdout?.on('data', (d) => {
    if (process.env.EVAL_VERBOSE) process.stdout.write(`[srv] ${d}`);
  });
  proc.stderr?.on('data', (d) => {
    if (process.env.EVAL_VERBOSE) process.stderr.write(`[srv-err] ${d}`);
  });
  return { proc, port };
}

async function waitIndexReady(port: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (r.ok) {
        const j = (await r.json()) as { indexReady?: boolean };
        if (j.indexReady) return;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server on :${port} not ready in ${timeoutMs}ms`);
}

function printSummary(results: CaseResult[]) {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const totalTokens = results.reduce(
    (a, r) => a + r.tokens.prompt + r.tokens.completion,
    0,
  );
  const avgSteps =
    results.reduce((a, r) => a + r.steps, 0) / Math.max(1, results.length);
  // judge 平均分（仅算 llmJudge 实际跑过的）
  const judgeScores = results.flatMap((r) => r.judgeScores ?? []).map((j) => j.score);
  const avgJudge = judgeScores.length
    ? (judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length).toFixed(2)
    : '—';
  // retrieval top-3 命中文件数（粗略：所有 retrieval rank<=3 的文件去重计数）
  const retrievalTop3 = new Set<string>();
  for (const r of results) {
    for (const h of r.retrieval ?? []) {
      if (h.rank <= 3) retrievalTop3.add(`${r.id}::${h.file}`);
    }
  }
  console.log('\n══════ SUMMARY ══════');
  console.log(`Pass:        ${passed}/${total}  (${Math.round((passed / total) * 100)}%)`);
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Avg steps:    ${avgSteps.toFixed(1)}`);
  console.log(`Avg judge:    ${avgJudge}/10  (n=${judgeScores.length})`);
  console.log(`Retrieval top3 file occurrences: ${retrievalTop3.size}`);
  // 按 category
  const byCat = new Map<string, { p: number; t: number }>();
  for (const r of results) {
    const k = r.category;
    const e = byCat.get(k) ?? { p: 0, t: 0 };
    e.t++;
    if (r.pass) e.p++;
    byCat.set(k, e);
  }
  console.log('By category:');
  for (const [k, v] of byCat) {
    console.log(`  ${k.padEnd(12)}  ${v.p}/${v.t}`);
  }
}

/**
 * 与 evals/baseline.json 对比。给出回归项：
 *  - 通过状态退化（baseline pass → 当前 fail）
 *  - token 涨幅 > 10%
 * 没有 baseline 文件就跳过。
 */
async function compareBaseline(results: CaseResult[]) {
  const file = path.join(ROOT, 'baseline.json');
  let baseline: { ts: string; cases: { id: string; pass: boolean; tokens: number; steps: number }[] };
  try {
    const txt = await fs.readFile(file, 'utf-8');
    baseline = JSON.parse(txt);
  } catch {
    console.log(`\n(no baseline.json — run with --update-baseline to create one)`);
    return;
  }
  console.log(`\n══════ BASELINE DIFF (vs ${baseline.ts}) ══════`);
  const baseMap = new Map(baseline.cases.map((c) => [c.id, c]));
  const regressions: string[] = [];
  for (const r of results) {
    const b = baseMap.get(r.id);
    if (!b) {
      console.log(`  ${r.id}: (new case)`);
      continue;
    }
    const curT = r.tokens.prompt + r.tokens.completion;
    const dT = curT - b.tokens;
    const dPct = b.tokens > 0 ? Math.round((dT / b.tokens) * 100) : 0;
    const flag = b.pass && !r.pass ? '⚠ REGRESS' : !b.pass && r.pass ? '✓ FIXED' : '';
    const tokenFlag = dPct > 10 ? '⚠ +tokens' : dPct < -10 ? '✓ -tokens' : '';
    console.log(
      `  ${r.id.padEnd(30)} tokens ${b.tokens} → ${curT} (${dPct >= 0 ? '+' : ''}${dPct}%) ${flag} ${tokenFlag}`.trim(),
    );
    if (b.pass && !r.pass) regressions.push(`${r.id} pass→fail`);
    if (dPct > 20) regressions.push(`${r.id} token +${dPct}%`);
  }
  if (regressions.length) {
    console.log(`\n⚠ Regressions: ${regressions.join(', ')}`);
  } else {
    console.log(`\n✓ No regressions vs baseline.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});