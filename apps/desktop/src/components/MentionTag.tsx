
/**
 * MentionTag — 共享的文件/选区提及标签组件
 * ---------------------------------------------------------------
 * 在输入框（composer-att）和消息气泡（msg-mention-tag）中复用。
 * 支持 file / folder / selection / symbol 四种类型，各有不同配色。
 */

import type { FC, MouseEvent } from 'react';

export type MentionKind = 'file' | 'folder' | 'selection' | 'symbol' | 'skill' | 'slash';

export interface MentionTagProps {
  kind: MentionKind;
  label: string;
  path: string;
  line1?: number;
  line2?: number;
  /** 可删除模式（输入框用），消息展示时为 false */
  removable?: boolean;
  onRemove?: () => void;
  /** 点击标签时打开文件（仅桌面端有效） */
  onOpen?: (path: string, line?: number) => void | Promise<void>;
}

const ICONS: Record<MentionKind, string> = {
  file: '📄',
  folder: '📁',
  selection: '✂️',
  symbol: '🔣',
  skill: '⚡',
  slash: '📎',
};

export const MentionTag: FC<MentionTagProps> = ({
  kind,
  label,
  path,
  line1,
  line2,
  removable,
  onRemove,
  onOpen,
}) => {
  const tooltip = line1 != null
    ? `${kind}: ${path}:${line1}${line2 ? `-${line2}` : ''}`
    : `${kind}: ${path}`;

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onOpen?.(path, line1);
  };

  return (
    <span
      className={`mention-tag mention-tag--${kind}`}
      title={tooltip}
      onClick={handleClick}
    >
      <span className="mention-tag__icon">{ICONS[kind]}</span>
      <span className="mention-tag__label">{label}</span>
      {removable && onRemove && (
        <button
          type="button"
          className="mention-tag__x"
          title="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </span>
  );
};

// ─── 工具函数：从文本中解析 @file / @selection 等 ────────────

export interface ParsedMention {
  kind: MentionKind;
  label: string;
  path: string;
  line1?: number;
  line2?: number;
}

/** 匹配 @file:path / @folder:path / @symbol:name / @selection:path:l1-l2 / /skill:name */
const MENTION_RE = /@(file|folder|symbol|selection):([^\s@]+)|\/skill:([\w-]+)/g;

/**
 * 从消息文本中提取所有 mention，返回 { mentions, cleanText }
 */
export function parseMentions(text: string): {
  mentions: ParsedMention[];
  cleanText: string;
} {
  const mentions: ParsedMention[] = [];
  let cleanText = text;

  // 重置 lastIndex
  MENTION_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(text)) !== null) {
    // /skill:name 格式
    if (match[3]) {
      mentions.push({ kind: 'skill', label: match[3], path: match[3] });
      continue;
    }
    const kind = match[1] as MentionKind;
    const raw = match[2];

    let path = raw;
    let line1: number | undefined;
    let line2: number | undefined;

    // @selection:path:10-20
    if (kind === 'selection') {
      const lineMatch = raw.match(/^(.+):(\d+)-(\d+)$/);
      if (lineMatch) {
        path = lineMatch[1];
        line1 = Number(lineMatch[2]);
        line2 = Number(lineMatch[3]);
      }
    }

    // 生成简短 label（取文件名或最后一段路径）
    const segments = path.split('/');
    const fileName = segments[segments.length - 1] || path;
    let label: string;
    if (kind === 'selection' && line1 != null) {
      label = `${fileName}:${line1}-${line2}`;
    } else if (kind === 'symbol') {
      label = path; // symbol name 直接显示
    } else {
      label = path;
    }

    mentions.push({ kind, label, path, line1, line2 });
  }

  // 去掉 mention 前缀，保留用户实际输入的文字
  cleanText = text.replace(MENTION_RE, '').trim();

  return { mentions, cleanText };
}
