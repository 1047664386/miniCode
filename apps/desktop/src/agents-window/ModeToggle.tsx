import { useAgentsStore } from './store';

export function ModeToggle() {
  const mode = useAgentsStore((s) => s.mode);
  const setMode = useAgentsStore((s) => s.setMode);

  const modes: Array<{ key: 'agent' | 'ask' | 'plan'; label: string; icon: string }> = [
    { key: 'agent', label: '智能体', icon: '∞' },
    { key: 'ask', label: 'Ask', icon: '✦' },
    { key: 'plan', label: 'Plan', icon: '◇' },
  ];

  return (
    <div className="mode-toggle" role="tablist" aria-label="对话模式">
      {modes.map((m) => (
        <button
          key={m.key}
          role="tab"
          aria-selected={mode === m.key}
          className={`mode-toggle-btn${mode === m.key ? ' active' : ''} mode-toggle-btn--${m.key}`}
          onClick={() => setMode(m.key)}
          title={m.label}
        >
          {m.icon} {m.label}
        </button>
      ))}
    </div>
  );
}
