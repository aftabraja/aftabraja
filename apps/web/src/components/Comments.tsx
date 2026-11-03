import { Fragment, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AtSign, MessageSquareText, Trash2 } from 'lucide-react';
import { del, get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ago } from '../lib/format';
import { Avatar, Button, Card, ErrorText, cx } from './ui';

const TOKEN = /@\[([^\]]+)\]\(([a-z0-9]+)\)/g;

function Body({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    parts.push(text.slice(last, m.index));
    parts.push(<span key={m.index} className="rounded bg-brand-50 px-1 font-medium text-brand-700">@{m[1]}</span>);
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last));
  return <p className="whitespace-pre-wrap break-words text-sm text-ink-800">{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</p>;
}

/** Discussion thread with @mentions on any league record */
export function Comments({ leagueId, type, id, title = 'Discussion', className }: { leagueId: string; type: string; id: string; title?: string; className?: string }) {
  const { user } = useAuth();
  const key = ['comments', type, id];
  const list = useQuery({ queryKey: key, queryFn: () => get<any[]>(`/leagues/${leagueId}/comments?type=${type}&id=${encodeURIComponent(id)}`), refetchInterval: 20_000 });
  const people = useQuery({ queryKey: ['people', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/comments/people`), staleTime: 60_000 });
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const [menu, setMenu] = useState<{ q: string; at: number } | null>(null);
  const [hi, setHi] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const send = useMutation({
    mutationFn: () => {
      // "@Asha Rao" typed via the picker becomes a mention token
      let body = text;
      for (const p of picked) body = body.split(`@${p.name}`).join(`@[${p.name}](${p.id})`);
      return post(`/leagues/${leagueId}/comments`, { type, id, body });
    },
    onSuccess: () => { setText(''); setPicked([]); list.refetch(); },
  });
  const remove = useMutation({ mutationFn: (cid: string) => del(`/leagues/${leagueId}/comments/${cid}`), onSuccess: () => list.refetch() });
  const options = (people.data ?? []).filter((p) => p.id !== user?.id && (!menu?.q || p.name.toLowerCase().split(/\s+/).some((w: string) => w.startsWith(menu.q.toLowerCase().trim())) || p.name.toLowerCase().startsWith(menu.q.toLowerCase()))).slice(0, 6);
  const onChange = (v: string) => {
    setText(v);
    const caret = ta.current?.selectionStart ?? v.length;
    const m = /(^|\s)@([\w ]{0,20})$/.exec(v.slice(0, caret));
    setMenu(m && !m[2].includes('  ') ? { q: m[2], at: caret - m[2].length - 1 } : null);
    setHi(0);
  };
  const choose = (p: { id: string; name: string }) => {
    if (!menu) return;
    const caret = ta.current?.selectionStart ?? text.length;
    setText(`${text.slice(0, menu.at)}@${p.name} ${text.slice(caret)}`);
    setPicked((x) => (x.some((y) => y.id === p.id) ? x : [...x, p]));
    setMenu(null);
    setTimeout(() => ta.current?.focus(), 0);
  };
  return (
    <Card className={className} title={<span className="flex items-center gap-2"><MessageSquareText className="h-4 w-4" />{title}{!!list.data?.length && <span className="text-xs font-normal text-ink-500">{list.data.length}</span>}</span>}>
      <ul className="space-y-4">
        {list.data?.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar name={c.author.name} src={c.author.avatarUrl} size={30} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-500"><span className="font-semibold text-ink-900">{c.author.name}</span> · {ago(c.createdAt)}{c.editedAt && ' · edited'}
                {c.authorId === user?.id && <button onClick={() => confirm('Delete this comment?') && remove.mutate(c.id)} className="ml-2 align-middle text-ink-300 hover:text-red-600" aria-label="Delete comment"><Trash2 className="inline h-3 w-3" /></button>}</p>
              <Body text={c.body} />
            </div>
          </li>
        ))}
        {!list.isLoading && !list.data?.length && <li className="text-sm text-ink-500">No comments yet. Type @ to bring a colleague in.</li>}
      </ul>
      <div className="relative mt-4">
        <textarea ref={ta} rows={2} value={text} onChange={(e) => onChange(e.target.value)} placeholder="Write a comment… use @ to mention someone" className="input"
          onKeyDown={(e) => {
            if (menu && options.length) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % options.length); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + options.length) % options.length); return; }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(options[hi]); return; }
              if (e.key === 'Escape') { setMenu(null); return; }
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) send.mutate();
          }} />
        {menu && options.length > 0 && (
          <ul className="absolute bottom-full left-0 z-10 mb-1 w-72 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-pop">
            {options.map((p, k) => (
              <li key={p.id}><button onMouseDown={(e) => { e.preventDefault(); choose(p); }} className={cx('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm', k === hi ? 'bg-brand-50' : 'hover:bg-ink-50')}>
                <Avatar name={p.name} size={22} /><span className="min-w-0 flex-1 truncate">{p.name}</span><span className="text-[11px] text-ink-400">{p.role}</span>
              </button></li>
            ))}
          </ul>
        )}
        <ErrorText error={send.error} />
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] text-ink-400"><AtSign className="h-3 w-3" />Mentioned people get a notification · Ctrl+Enter to send</span>
          <Button size="sm" disabled={!text.trim()} loading={send.isPending} onClick={() => send.mutate()}>Comment</Button>
        </div>
      </div>
    </Card>
  );
}
