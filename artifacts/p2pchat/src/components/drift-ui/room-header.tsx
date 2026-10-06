import { Hash, Volume2, Users, UserPlus, Activity } from 'lucide-react';
import type { SessionStatus } from '@workspace/p2p-room';
import { Button } from './index';

export function RoomHeader({ name, voice, status, detail, membersCollapsed, onToggleMembers, onInvite, inviteBusy, onDiagnostics }: {
  name: string; voice: boolean; status: SessionStatus; detail: string;
  membersCollapsed: boolean; onToggleMembers: () => void; onInvite: () => void; inviteBusy: boolean; onDiagnostics: () => void;
}) {
  const label = status === 'connected' ? 'В комнате' : status === 'offline' ? 'Нет соединения' : status === 'connecting' ? 'Подключение…' : 'Переподключение…';
  return <header className="topbar d2-room-header">
    <div className="d2-channel-title"><span className="d2-channel-symbol">{voice ? <Volume2 size={18} /> : <Hash size={18} />}</span><div><h1>{name}</h1><p>{voice ? 'Голосовой канал' : 'Текстовый канал'}</p></div></div>
    <div className="d2-header-actions">
      <button className="d2-room-status" data-status={status} title={status === 'connected' ? 'Вы подключены к комнате. Доступ из интернета проверяется отдельно.' : detail} onClick={onDiagnostics} aria-label={`${label}. Открыть диагностику`}><span aria-hidden="true" />{label}</button>
      <Button tone="quiet" className="d2-icon-action" aria-pressed={!membersCollapsed} aria-label={membersCollapsed ? 'Показать участников' : 'Свернуть участников'} onClick={onToggleMembers} data-testid="button-toggle-member-pane"><Users size={18} /></Button>
      <Button tone="secondary" busy={inviteBusy} onClick={onInvite} data-testid="button-top-invite">{!inviteBusy && <UserPlus size={16} />}{inviteBusy ? 'Копируем…' : 'Пригласить по ссылке'}</Button>
      <Button tone="quiet" className="d2-icon-action" aria-label="Открыть диагностику" onClick={onDiagnostics} data-testid="button-open-diagnostics"><Activity size={17} /></Button>
    </div>
  </header>;
}

export function RoomWelcome({ onDismiss }: { onDismiss: () => void }) {
  return <div className="d2-room-welcome" data-testid="banner-setup-guide"><div><strong>Ваше место для общения</strong><p>Пригласите друзей кнопкой сверху. Для разговора выберите голосовой канал слева.</p></div><Button tone="quiet" onClick={onDismiss} data-testid="button-guide-dismiss">Понятно</Button></div>;
}
