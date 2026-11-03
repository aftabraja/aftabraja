import { useEffect } from 'react';

/** Subscribe to a server-sent event stream; calls onUpdate whenever the server signals a change. */
export function useLive(path: string | null, onUpdate: () => void) {
  useEffect(() => {
    if (!path) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const open = () => {
      es = new EventSource(`/api${path}`);
      es.addEventListener('update', () => onUpdate());
      es.onerror = () => { es?.close(); retry = setTimeout(open, 3000); };
    };
    open();
    return () => { clearTimeout(retry); es?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}
