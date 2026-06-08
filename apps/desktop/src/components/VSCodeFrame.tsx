
import { useEffect, useRef } from 'react';
import { vsBridge } from '../vscode-bridge';

interface Props {
  url: string;
}

export function VSCodeFrame({ url }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    vsBridge.attach(ref.current);
    return () => vsBridge.detach();
  }, [url]);

  return (
    <iframe
      ref={ref}
      title="OpenVSCode-Server"
      src={url}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#1e1e1e',
      }}
      allow="clipboard-read; clipboard-write; cross-origin-isolated"
    />
  );
}