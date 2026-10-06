import { useEffect, useState } from 'react';
import { Copy, Check, RefreshCw, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { refreshCoordinatorInvite, parseInvite } from '@/lib/p2p-client';
import { type Server } from '@/lib/app-shared';
import { Button } from './index';
import { isPrivateOrLoopbackHost } from '@/lib/invite-origins';

export function InviteDialog({ server, onClose, onNotify, onInviteUpdated }: { server: Server; onClose: () => void; onNotify: (text: string) => void; onInviteUpdated?: (invite: string) => void }) {
  const [link, setLink] = useState(server.invite ?? '');
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setRefreshing(true); setCopied(false); setError('');
    void refreshCoordinatorInvite().then(meta => {
      if (cancelled) return;
      const next = meta?.invite || server.invite || '';
      setLink(next);
      if (meta?.invite) onInviteUpdated?.(meta.invite);
      if (!next) setError('Приглашение пока не готово. Проверьте подключение комнаты и повторите попытку.');
    }).catch(() => {
      if (!cancelled) { setLink(''); setError('Не удалось обновить приглашение. Повторите попытку.'); }
    }).finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
    // Refresh only on opening or explicit retry; updates to parent metadata must not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  const hasPublicAddress = (parseInvite(link)?.origins ?? []).some(origin => {
    try { return !isPrivateOrLoopbackHost(new URL(origin).hostname); } catch { return false; }
  });
  const copy = async () => {
    if (!link || refreshing) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setError(''); onNotify('Приглашение скопировано'); }
    catch { setCopied(false); setError('Не удалось скопировать. Выделите ссылку ниже и скопируйте вручную.'); }
  };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="d2-invite-dialog">
    <div className="d2-dialog-symbol"><ShieldCheck size={24} /></div>
    <DialogTitle>Пригласить в «{server.name}»</DialogTitle>
    <DialogDescription>Отправьте ссылку другу. У него должен быть установлен Drift.</DialogDescription>
    {refreshing ? <p className="d2-invite-state" role="status">Готовим актуальное приглашение…</p> : <>
      {link && <label className="d2-field"><span>Ссылка приглашения</span><textarea readOnly value={link} rows={3} onFocus={event => event.currentTarget.select()} aria-label="Ссылка приглашения" data-testid="text-invite-link" /></label>}
      {link && !hasPublicAddress && <p className="d2-invite-warning">В приглашении нет публичного адреса. Подключение из другой сети может быть недоступно.</p>}
    </>}
    {error && <p className="d2-invite-warning" role="alert">{error}</p>}
    <div className="d2-invite-actions"><Button tone="primary" busy={refreshing} disabled={!link} onClick={() => void copy()} data-testid="button-copy-invite">{!refreshing && (copied ? <Check size={16} /> : <Copy size={16} />)}{refreshing ? 'Готовим ссылку…' : copied ? 'Скопировано' : 'Скопировать приглашение'}</Button><Button tone="quiet" disabled={refreshing} onClick={() => setAttempt(value => value + 1)} aria-label="Обновить приглашение"><RefreshCw size={16} /></Button></div>
    <p className="d2-hint">Передавайте ссылку только тем, кого хотите видеть в комнате.</p>
  </DialogContent></Dialog>;
}
