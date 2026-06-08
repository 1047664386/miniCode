
/**
 * CtxMenu — 共享右键菜单组件（用 React Portal 渲染到 document.body，避免被 overflow 剪裁）
 *
 * 用法：
 *   const [pos, setPos] = useState<{x:number;y:number}|null>(null);
 *   onContextMenu={(e) => { e.preventDefault(); setPos({x:e.clientX,y:e.clientY}); }}
 *   {pos && <CtxMenu x={pos.x} y={pos.y} onClose={() => setPos(null)} items={[...]} />}
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface CtxMenuItem {
  label: string;
  icon?: string;
  hint?: string;
  variant?: 'default' | 'primary' | 'muted';
  disabled?: boolean;
  onClick: () => void;
}

interface Props {
  x: number;
  y: number;
  items: (CtxMenuItem | 'divider')[];
  onClose: () => void;
}

export function CtxMenu({ x, y, items, onClose }: Props) {
  useEffect(() => {
    // 用 mousedown / contextmenu 关闭（避免和触发它的事件冲突）
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.agents-ctxmenu')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // setTimeout 0：避免捕获到触发本菜单的同一次 mousedown/contextmenu
    const t = setTimeout(() => {
      window.addEventListener('mousedown', onDown, true);
      window.addEventListener('contextmenu', onDown, true);
      window.addEventListener('keydown', onKey, true);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('contextmenu', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  // 边界保护：菜单不超出视口
  const maxX = window.innerWidth - 240;
  const maxY = window.innerHeight - items.length * 28 - 16;
  const left = Math.min(x, maxX);
  const top = Math.min(y, maxY);

  return createPortal(
    <ul
      className="agents-ctxmenu"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it === 'divider' ? (
          <li key={`d${i}`} className="agents-ctxmenu-divider" />
        ) : (
          <li
            key={i}
            className={`agents-ctxmenu-item agents-ctxmenu-item--${it.variant ?? 'default'}${it.disabled ? ' is-disabled' : ''}`}
            onClick={() => {
              if (it.disabled) return;
              it.onClick();
              onClose();
            }}
          >
            <span className="agents-ctxmenu-label">
              {it.icon && <span className="agents-ctxmenu-icon">{it.icon}</span>}
              {it.label}
            </span>
            {it.hint && <span className="agents-ctxmenu-hint">{it.hint}</span>}
          </li>
        ),
      )}
    </ul>,
    document.body,
  );
}