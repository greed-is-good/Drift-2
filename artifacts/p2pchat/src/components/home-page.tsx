import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Plus, Link, MessageCircle, Settings, ShieldCheck, Trash2 } from 'lucide-react';
import { activateSavedServer, createLocalRoom, getBootstrapOrigin, getPeerId, isDesktopShell, isLocalhostOrigin, loadSavedServers, parseInvite, prepareJoin, removeSavedServer, setBootstrapOrigin, type SavedServer } from '@/lib/p2p-client';
import { isValidDisplayName, normalizeDisplayName, PENDING_INVITE_EVENT, takePendingInvite } from '@/lib/invite-deep-link';
import { avatarColors, avatarInitials } from '@/lib/avatar';
import { type Server, SERVER_KEY, CHANNELS_KEY, MESSAGES_KEY, VOICE_KEY, PROFILE_NAME_KEY, readStore, writeStore, roomStateToClientState } from '@/lib/app-shared';
import { markServerCreatedGuide } from '@/lib/onboarding-guide';
import { LogoMark, CreatorCredit, AppVersionLabel } from '@/components/app-brand';
import { Button, Input, Field, Panel } from '@/components/drift-ui';
import { SettingsPage } from '@/components/settings-page';

export function Home() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [displayName, setDisplayName] = useState(() => readStore(PROFILE_NAME_KEY, ''));
  const [apiOrigin, setApiOriginState] = useState(getBootstrapOrigin);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [savedServers, setSavedServers] = useState<SavedServer[]>(() => loadSavedServers());
  const nameOk = isValidDisplayName(displayName);

  const requireName = (): string | null => {
    const memberName = normalizeDisplayName(displayName);
    if (!isValidDisplayName(memberName)) {
      setToast('Укажите имя: от 2 до 32 символов');
      return null;
    }
    return memberName;
  };

  const openSaved = (server: SavedServer) => {
    const memberName = requireName();
    if (!memberName) return;
    const meta = activateSavedServer(server);
    writeStore(PROFILE_NAME_KEY, memberName);
    writeStore(SERVER_KEY, {
      id: meta.roomId,
      roomId: meta.roomId,
      name: server.name,
      memberCount: 0,
      role: server.role,
      connectivityState: 'checking',
      hostName: server.hostName ?? '…',
      peerId: getPeerId(),
      inviteToken: meta.inviteToken,
      invite: meta.invite,
      roomKey: meta.roomKey,
    } satisfies Server);
    writeStore(CHANNELS_KEY, []);
    writeStore(MESSAGES_KEY, []);
    writeStore(VOICE_KEY, []);
    setLocation('/server');
  };

  const forgetSaved = (roomId: string) => {
    setSavedServers(removeSavedServer(roomId));
    setToast('Комната убрана из списка');
  };

  const createServer = async (event: FormEvent) => {
    event.preventDefault();
    const memberName = requireName();
    if (!memberName) return;
    setBusy(true);
    try {
      if (apiOrigin.trim()) setBootstrapOrigin(apiOrigin);
      const created = await createLocalRoom({
        name: name.trim() || 'Комната без названия',
        displayName: memberName,
        bootstrapOrigin: apiOrigin.trim() || undefined,
      });
      const clientState = roomStateToClientState(created.state, created.identity.peerId, created.meta.invite);
      clientState.server.inviteToken = created.meta.inviteToken;
      clientState.server.roomKey = created.meta.roomKey;
      writeStore(PROFILE_NAME_KEY, memberName);
      writeStore(SERVER_KEY, clientState.server);
      writeStore(CHANNELS_KEY, clientState.channels);
      writeStore(MESSAGES_KEY, []);
      writeStore(VOICE_KEY, clientState.voiceRooms);
      setSavedServers(loadSavedServers());
      markServerCreatedGuide(created.meta.roomId);
      setLocation('/server');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Не удалось создать комнату');
    } finally {
      setBusy(false);
    }
  };

  const joinWithInvite = async (rawInvite: string, nameOverride?: string) => {
    const memberName = normalizeDisplayName(nameOverride ?? displayName);
    if (!isValidDisplayName(memberName)) {
      setMode('join');
      setInvite(rawInvite);
      setToast('Укажите имя: от 2 до 32 символов');
      return;
    }
    const parsed = parseInvite(rawInvite);
    if (!parsed) {
      setToast('Вставьте ссылку приглашения Drift (drift://j/…)');
      return;
    }
    if (parsed.origins.every((origin) => isLocalhostOrigin(origin)) && parsed.origins.length > 0) {
      setToast('В ссылке только localhost — укажите LAN/публичный адрес или bootstrap ниже.');
    }
    setBusy(true);
    try {
      if (apiOrigin.trim()) setBootstrapOrigin(apiOrigin);
      const prepared = await prepareJoin({
        invite: rawInvite,
        displayName: memberName,
        bootstrapOrigin: apiOrigin.trim() || undefined,
      });
      writeStore(PROFILE_NAME_KEY, memberName);
      writeStore(SERVER_KEY, {
        id: prepared.meta.roomId,
        roomId: prepared.meta.roomId,
        name: 'Комната',
        memberCount: 0,
        role: 'Участник',
        connectivityState: 'checking',
        hostName: '…',
        peerId: prepared.identity.peerId,
        inviteToken: prepared.meta.inviteToken,
        invite: prepared.meta.invite,
        roomKey: prepared.meta.roomKey,
      } satisfies Server);
      writeStore(CHANNELS_KEY, []);
      writeStore(MESSAGES_KEY, []);
      writeStore(VOICE_KEY, []);
      setSavedServers(loadSavedServers());
      setLocation('/server');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Не удалось войти в комнату');
    } finally {
      setBusy(false);
    }
  };

  const joinServer = async (event: FormEvent) => {
    event.preventDefault();
    await joinWithInvite(invite);
  };

  useEffect(() => {
    const applyInvite = (raw: string) => {
      setMode('join');
      setInvite(raw);
      const stored = normalizeDisplayName(readStore(PROFILE_NAME_KEY, ''));
      if (isValidDisplayName(stored)) {
        setDisplayName(stored);
        void joinWithInvite(raw, stored);
      } else {
        setToast('Ссылка получена — укажите имя и нажмите «Войти в комнату»');
      }
    };
    const pending = takePendingInvite();
    if (pending) applyInvite(pending);
    const onPending = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === 'string' && detail) {
        takePendingInvite();
        applyInvite(detail);
      }
    };
    window.addEventListener(PENDING_INVITE_EVENT, onPending);
    return () => window.removeEventListener(PENDING_INVITE_EVENT, onPending);
    // Mount + deep-link events only; join uses name from PROFILE_NAME_KEY.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="d2-home">
      <aside className="d2-sidebar">
        <LogoMark />
        <div className="d2-sidebar-caption">Ваш круг общения</div>
        <nav aria-label="Комнаты" className="d2-room-list" data-testid="saved-servers">
          <h2>Ваши комнаты <span>{savedServers.length}</span></h2>
          {savedServers.length === 0 ? <div className="d2-empty"><MessageCircle size={24} /><p>Здесь будут ваши комнаты</p><span>Создайте свою или присоединитесь по приглашению.</span></div> : savedServers.map(server => (
            <div className="d2-room" key={server.roomId}>
              <button className="d2-room-open" onClick={() => openSaved(server)} disabled={busy} data-testid={`button-open-server-${server.roomId}`}>
                <span className="d2-avatar" style={avatarColors(server.name)}>{avatarInitials(server.name)}</span>
                <span><strong>{server.name}</strong><small>{server.role}</small></span>
              </button>
              <button className="d2-room-remove" disabled={busy} aria-label={`Убрать ${server.name} из списка`} onClick={() => forgetSaved(server.roomId)} data-testid={`button-forget-server-${server.roomId}`}><Trash2 size={15} /></button>
            </div>
          ))}
        </nav>
        <Button tone="quiet" onClick={() => setShowSettings(true)} data-testid="button-home-settings"><Settings size={16} />Настройки</Button>
        <div className="d2-sidebar-footer"><CreatorCredit /><AppVersionLabel /></div>
      </aside>
      <section className="d2-main">
        <header className="d2-page-heading"><span className="d2-eyebrow">НАЧНЁМ С РАЗГОВОРА</span><h1>Свои люди. Своя комната.</h1><p>Соберитесь вместе — для разговоров, игр и всего между ними.</p></header>
        <Panel className="d2-entry">
          <Field id="display-name" label="Как вас зовут?" hint="Это имя увидят друзья. От 2 до 32 символов.">
            <Input id="display-name" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Ваше имя" maxLength={32} minLength={2} autoComplete="nickname" aria-describedby="display-name-hint" data-testid="input-display-name" disabled={busy} />
          </Field>
          <div className="d2-mode" role="group" aria-label="Способ входа">
            <Button tone="quiet" aria-pressed={mode === 'create'} disabled={busy} onClick={() => setMode('create')} data-testid="tab-create-server"><Plus size={16} />Создать комнату</Button>
            <Button tone="quiet" aria-pressed={mode === 'join'} disabled={busy} onClick={() => setMode('join')} data-testid="tab-join-server"><Link size={16} />По приглашению</Button>
          </div>
          {mode === 'create' ? <form onSubmit={createServer} data-testid="form-create-server">
            <Field id="server-name" label="Название комнаты" hint="Приглашение для друзей появится после создания.">
              <Input id="server-name" value={name} onChange={event => setName(event.target.value)} placeholder="Например, Вечерний отряд" aria-describedby="server-name-hint" disabled={busy} data-testid="input-server-name" />
            </Field>
            <Button tone="primary" type="submit" className="d2-submit" busy={busy} disabled={!nameOk} data-testid="button-create-server">{busy ? 'Создаём комнату…' : 'Создать комнату'}{!busy && <ArrowRight size={16} />}</Button>
          </form> : <form onSubmit={joinServer} data-testid="form-join-server">
            <Field id="invite-code" label="Приглашение" hint="Вставьте ссылку, которую прислал друг.">
              <Input id="invite-code" name="drift-invite-url" value={invite} onChange={event => setInvite(event.target.value)} placeholder="https://… или drift://…" autoComplete="off" spellCheck={false} disabled={busy} aria-describedby="invite-code-hint" data-testid="input-invite-code" />
            </Field>
            <Button tone="primary" type="submit" className="d2-submit" busy={busy} disabled={!nameOk || !invite.trim()} data-testid="button-join-server">{busy ? 'Подключаемся…' : 'Присоединиться'}{!busy && <ArrowRight size={16} />}</Button>
          </form>}
          {isDesktopShell() && <details className="d2-advanced"><summary>Параметры подключения</summary><Field id="api-origin" label="Резервный адрес" hint="Необязательно. Укажите, если используете свой узел подключения."><Input id="api-origin" value={apiOrigin} onChange={event => setApiOriginState(event.target.value)} placeholder="http://192.168.0.10:5000" disabled={busy} aria-describedby="api-origin-hint" data-testid="input-api-origin" /></Field></details>}
        </Panel>
        <p className="d2-privacy"><ShieldCheck size={16} />Без аккаунта. Вход по приглашению.</p>
      </section>
      {toast && <div className="d2-notice" role="status"><span>{toast}</span><Button tone="quiet" onClick={() => setToast('')}>Закрыть</Button></div>}
      {showSettings && <div className="fixed inset-x-0 bottom-0 z-[80] overflow-auto bg-[hsl(var(--background))]" style={{ top: 'var(--app-titlebar-h, 36px)' }}><SettingsPage onClose={() => setShowSettings(false)} /></div>}
    </main>
  );
}
