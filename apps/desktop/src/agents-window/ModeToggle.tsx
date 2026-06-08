

import { useAgentsStore } from './store';

export function ModeToggle() {
  const mode = useAgentsStore((s) => s.mode);
  const setMode = useAgentsStore((s) => s.setMode);

  return (
    <div className="mode-toggle" role="tablist" aria-label="对话模式">
      <button
        role="tab"
        aria-selected={mode === 'work'}
        className={`mode-toggle-btn${mode === 'work' ? ' active' : ''}`}
        onClick={() => setMode('work')}
        title="通用对话，不绑定仓库"
      >
        Work
      </button>
      <button
        role="tab"
        aria-selected={mode === 'code'}
        className={`mode-toggle-btn${mode === 'code' ? ' active' : ''}`}
        onClick={() => setMode('code')}
        title="编码模式，绑定当前 workspace"
      >
        Code
      </button>
    </div>
  );
}