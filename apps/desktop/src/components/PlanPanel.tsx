
/**
 * PlanPanel — 实时显示 Agent 通过 update_plan tool 声明的任务计划。
 *
 * v3：支持 priority badge / 嵌套子任务 (parentId) / note 提示
 */
import { useStore } from '../store';

const ICON: Record<string, string> = {
  pending: '☐',
  in_progress: '⏳',
  completed: '✅',
};

const PRIO_COLOR: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#94a3b8',
};

interface Item {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: 'high' | 'medium' | 'low';
  parentId?: string;
  note?: string;
}

export function PlanPanel() {
  const plan = useStore((s) => s.plan);
  if (!plan || !plan.items?.length) return null;
  const items = plan.items as Item[];
  const done = items.filter((i) => i.status === 'completed').length;
  const inProgress = items.filter((i) => i.status === 'in_progress').length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isActive = inProgress > 0;
  const isComplete = done === total && total > 0;

  // 构建父子树
  const byParent = new Map<string, Item[]>();
  const tops: Item[] = [];
  for (const it of items) {
    if (it.parentId && items.some((p) => p.id === it.parentId)) {
      if (!byParent.has(it.parentId)) byParent.set(it.parentId, []);
      byParent.get(it.parentId)!.push(it);
    } else {
      tops.push(it);
    }
  }

  const renderItem = (it: Item, depth = 0) => (
    <li key={it.id} className={`plan-item plan-${it.status}`} style={{ paddingLeft: depth * 16 }}>
      <span className="plan-icon">{ICON[it.status] ?? '·'}</span>
      {it.priority && (
        <span
          title={`priority: ${it.priority}`}
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: PRIO_COLOR[it.priority],
            margin: '0 6px 0 0',
          }}
        />
      )}
      <span className="plan-content">{it.content}</span>
      {it.note && (
        <span
          style={{ fontSize: 10, opacity: 0.6, marginLeft: 6, fontStyle: 'italic' }}
          title={it.note}
        >
          — {it.note.length > 40 ? it.note.slice(0, 40) + '…' : it.note}
        </span>
      )}
      {byParent.get(it.id) && (
        <ul className="plan-items" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {byParent.get(it.id)!.map((child) => renderItem(child, depth + 1))}
        </ul>
      )}
    </li>
  );

  return (
    <div className="plan-panel">
      <div className="plan-header">
        <span className="plan-title">
          Plan{' '}
          {isComplete && <span style={{ color: '#4ade80', marginLeft: 4 }}>✓</span>}
        </span>
        <span className="plan-progress">
          {done} / {total} ({pct}%)
        </span>
      </div>
      <div
        className="plan-progressbar"
        style={{
          height: 4,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          margin: '4px 0 8px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: isComplete ? '#4ade80' : isActive ? '#60a5fa' : '#94a3b8',
            transition: 'width 0.3s ease, background 0.3s',
            ...(isActive && !isComplete
              ? {
                  backgroundImage:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'plan-shimmer 1.5s infinite linear',
                }
              : {}),
          }}
        />
        <style>
          {`@keyframes plan-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}
        </style>
      </div>
      {plan.summary && <div className="plan-summary">{plan.summary}</div>}
      <ul className="plan-items" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {tops.map((it) => renderItem(it, 0))}
      </ul>
    </div>
  );
}