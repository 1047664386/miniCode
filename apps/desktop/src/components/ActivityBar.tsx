
/**
 * VSCode 风格左侧活动栏（Activity Bar）。
 *
 * 一列窄按钮，控制左侧 Sidebar 显示哪个视图。
 * 点击当前已选 view 等于折叠 Sidebar（VSCode 行为）。
 */
import { useStore } from '../store';

type View = 'explorer' | 'search' | 'git' | 'outline' | 'problems';

interface Item {
  id: View;
  title: string;
  /** Inline SVG path data, viewBox 24 24 */
  icon: JSX.Element;
}

const ICONS: Item[] = [
  {
    id: 'explorer',
    title: '资源管理器 (Explorer)',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 5h6l2 2h10v12H3z" />
      </svg>
    ),
  },
  {
    id: 'search',
    title: '搜索 (⌘⇧F)',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4-4" />
      </svg>
    ),
  },
  {
    id: 'git',
    title: 'Git 源代码管理',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="M6 8v4a2 2 0 0 0 2 2h4M18 8v2a4 4 0 0 1-4 4" />
      </svg>
    ),
  },
  {
    id: 'outline',
    title: '大纲 (⌘⇧O)',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M5 6h14M5 12h10M5 18h6" />
      </svg>
    ),
  },
  {
    id: 'problems',
    title: '问题 (⌘⇧M)',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
    ),
  },
];

const FOOTER: { id: string; title: string; icon: JSX.Element; onClick?: () => void }[] = [
  {
    id: 'extensions',
    title: '扩展（即将上线）',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM18 14v3M15 17h6" />
      </svg>
    ),
    onClick: () => alert('扩展商店即将上线。'),
  },
];

interface Props {
  onOpenSettings: () => void;
}

export function ActivityBar({ onOpenSettings }: Props) {
  const view = useStore((s) => s.sidebarView);
  const setView = useStore((s) => s.setSidebarView);

  const click = (id: View) => {
    setView(view === id ? null : id);
  };

  return (
    <div className="activity-bar">
      <div className="activity-bar__group">
        {ICONS.map((it) => (
          <button
            key={it.id}
            className={`activity-bar__btn ${view === it.id ? 'active' : ''}`}
            title={it.title}
            onClick={() => click(it.id)}
          >
            {it.icon}
          </button>
        ))}
      </div>
      <div className="activity-bar__group activity-bar__group--bottom">
        {FOOTER.map((it) => (
          <button
            key={it.id}
            className="activity-bar__btn"
            title={it.title}
            onClick={it.onClick}
          >
            {it.icon}
          </button>
        ))}
        <button
          className="activity-bar__btn"
          title="设置"
          onClick={onOpenSettings}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}