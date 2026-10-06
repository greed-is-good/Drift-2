import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Bell, Check, ChevronDown, Globe, Mic, Palette, Settings } from 'lucide-react';
import {
  checkForAppUpdate,
  currentAppVersion,
  installAppUpdate,
  getBootstrapOrigin,
  getPublicUrl,
  isDesktopShell,
  loadIceSettings,
  loadRoomMeta,
  refreshCoordinatorInvite,
  restartPublicTunnel,
  saveIceSettings,
  setBootstrapOrigin,
  setPublicUrl,
  warmIceServers,
  type AppUpdateInfo,
} from '@/lib/p2p-client';
import { getUpdatePlatform } from '@/lib/app-update';
import { getAutostartEnabled, setAutostartEnabled } from '@/lib/autostart';
import { APP_THEMES, loadTheme, saveTheme, type AppThemeId } from '@/lib/theme';
import {
  listAudioDevices,
  loadAudioInputId,
  loadAudioOutputId,
  saveAudioInputId,
  saveAudioOutputId,
} from '@/lib/audio-settings';
import {
  STARTUP_SOUND_OPTIONS,
  loadStartupSoundId,
  loadUiSoundsEnabled,
  playUiSound,
  previewStartupSound,
  saveStartupSoundId,
  saveUiSoundsEnabled,
  type StartupSoundId,
} from '@/lib/ui-sounds';
import {
  loadDesktopNotifyEnabled,
  loadFunSoundsEnabled,
  saveDesktopNotifyEnabled,
  saveFunSoundsEnabled,
} from '@/lib/notify-settings';
import {
  HOTKEY_NONE,
  isHotkeyCodeSupported,
  labelForHotkeyCode,
  loadDeafenHotkeyCode,
  loadMuteHotkeyCode,
  loadPttKeyCode,
  loadVoiceOverlayEnabled,
  loadVoiceOverlayInteractive,
  loadVoiceOverlayOpacity,
  loadVoiceTalkMode,
  hotkeyVkForCode,
  mouseButtonToHotkeyCode,
  pttVkForCode,
  saveDeafenHotkeyCode,
  saveMuteHotkeyCode,
  savePttKeyCode,
  saveVoiceOverlayEnabled,
  saveVoiceOverlayInteractive,
  saveVoiceOverlayOpacity,
  saveVoiceTalkMode,
  VOICE_OVERLAY_PAYLOAD_KEY,
  type PttKeyCode,
  type VoiceOverlayPayload,
  type VoiceTalkMode,
} from '@/lib/voice-settings';
import {
  TUNNEL_PROVIDER_OPTIONS,
  loadNgrokAuthToken,
  loadTunnelProvider,
  loadZrokToken,
  saveNgrokAuthToken,
  saveTunnelProvider,
  saveZrokToken,
  type TunnelProviderId,
} from '@/lib/tunnel-settings';
import { SERVER_KEY, readStore, writeStore, seedServer } from '@/lib/app-shared';
import { StudioCredit } from '@/components/app-brand';
import { Button } from '@/components/drift-ui';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { NetworkHealthPanel } from '@/components/network-health-panel';

function HotkeyBindControl({
  label,
  value,
  allowClear = false,
  onChange,
  testId,
}: {
  label: string;
  value: PttKeyCode;
  allowClear?: boolean;
  onChange: (code: PttKeyCode) => void;
  testId: string;
}) {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!capturing) return;
    const finish = (code: PttKeyCode) => {
      if (!isHotkeyCodeSupported(code)) {
        setError('Эту клавишу назначить нельзя');
        return;
      }
      setError('');
      onChange(code);
      setCapturing(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        setCapturing(false);
        setError('');
        return;
      }
      if (allowClear && event.code === 'Backspace') {
        setError('');
        onChange(HOTKEY_NONE);
        setCapturing(false);
        return;
      }
      finish(event.code);
    };
    const onMouseDown = (event: MouseEvent) => {
      const code = mouseButtonToHotkeyCode(event.button);
      if (!code) return;
      event.preventDefault();
      event.stopPropagation();
      finish(code);
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('mousedown', onMouseDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [allowClear, capturing, onChange]);

  return (
    <div className="mt-3" data-testid={testId}>
      <div className="field-label">{label}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <div
          className="min-w-[7rem] flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] px-3 py-2 font-mono text-xs font-semibold"
          data-testid={`${testId}-value`}
        >
          {capturing ? 'Нажмите клавишу или кнопку мыши…' : labelForHotkeyCode(value)}
        </div>
        <button
          type="button"
          className="ghost-btn text-xs"
          onClick={() => {
            setError('');
            setCapturing(true);
          }}
          data-testid={`${testId}-bind`}
        >
          {capturing ? 'Жду…' : 'Назначить'}
        </button>
        {allowClear && value && !capturing && (
          <button
            type="button"
            className="ghost-btn text-xs"
            onClick={() => {
              setError('');
              onChange(HOTKEY_NONE);
            }}
            data-testid={`${testId}-clear`}
          >
            Сброс
          </button>
        )}
        {capturing && (
          <button
            type="button"
            className="ghost-btn text-xs"
            onClick={() => {
              setCapturing(false);
              setError('');
            }}
            data-testid={`${testId}-cancel`}
          >
            Отмена
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
        {capturing
          ? allowClear
            ? 'Любая клавиша / боковая кнопка мыши. Esc — отмена, Backspace — сброс.'
            : 'Любая клавиша / боковая кнопка мыши. Esc — отмена.'
          : error || null}
      </p>
      {error && !capturing && <p className="mt-1 text-[11px] text-[hsl(var(--accent))]">{error}</p>}
    </div>
  );
}

type SettingsTabId = 'appearance' | 'audio' | 'notifications' | 'app' | 'network';
const SETTINGS_TABS = [
  { id: 'appearance', title: 'Оформление', icon: Palette },
  { id: 'audio', title: 'Звук и голос', icon: Mic },
  { id: 'notifications', title: 'Уведомления', icon: Bell },
  { id: 'app', title: 'Приложение', icon: Settings },
  { id: 'network', title: 'Подключение', icon: Globe },
] as const;

function SettingsSection({
  title,
  children,
  testId,
}: {
  title: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className="d2-settings-section" data-testid={testId}>
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

export function SettingsPage({ onClose }: { onClose?: () => void }) {
  const [, setLocation] = useLocation();
  const roomMeta = loadRoomMeta();
  const goBack = () => (onClose ? onClose() : setLocation(roomMeta?.roomId ? '/server' : '/'));
  const ice = loadIceSettings();
  const [publicUrl, setPublicUrlDraft] = useState(getPublicUrl());
  const [bootstrap, setBootstrap] = useState(getBootstrapOrigin());
  const [turnUrls, setTurnUrls] = useState(ice.turn?.urls ?? '');
  const [turnUser, setTurnUser] = useState(ice.turn?.username ?? '');
  const [turnCred, setTurnCred] = useState(ice.turn?.credential ?? '');
  const [meteredKey, setMeteredKey] = useState(ice.meteredApiKey ?? '');
  const [meteredApp, setMeteredApp] = useState(ice.meteredAppName ?? '');
  const [tunnelBusy, setTunnelBusy] = useState(false);
  const [tunnelMsg, setTunnelMsg] = useState('');
  const [saved, setSaved] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTabId>('appearance');
  const contentRef = useRef<HTMLDivElement>(null);
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const reviewNetworkRef = useRef(false);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [autostartMsg, setAutostartMsg] = useState('');
  const [autostartError, setAutostartError] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [autostartEnabled, setAutostartEnabledState] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(false);
  const [themeId, setThemeId] = useState<AppThemeId>(() => loadTheme());
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [audioInputId, setAudioInputId] = useState(() => loadAudioInputId());
  const [audioOutputId, setAudioOutputId] = useState(() => loadAudioOutputId());
  const [uiSoundsEnabled, setUiSoundsEnabled] = useState(() => loadUiSoundsEnabled());
  const [funSoundsEnabled, setFunSoundsEnabled] = useState(() => loadFunSoundsEnabled());
  const [desktopNotifyEnabled, setDesktopNotifyEnabled] = useState(() =>
    loadDesktopNotifyEnabled(),
  );
  const [startupSoundId, setStartupSoundId] = useState<StartupSoundId>(() => loadStartupSoundId());
  const [voiceTalkMode, setVoiceTalkMode] = useState<VoiceTalkMode>(() => loadVoiceTalkMode());
  const [pttKeyCode, setPttKeyCode] = useState<PttKeyCode>(() => loadPttKeyCode());
  const [muteHotkeyCode, setMuteHotkeyCode] = useState<PttKeyCode>(() => loadMuteHotkeyCode());
  const [deafenHotkeyCode, setDeafenHotkeyCode] = useState<PttKeyCode>(() =>
    loadDeafenHotkeyCode(),
  );
  const [voiceOverlayEnabled, setVoiceOverlayEnabled] = useState(() => loadVoiceOverlayEnabled());
  const [voiceOverlayOpacity, setVoiceOverlayOpacity] = useState(() => loadVoiceOverlayOpacity());
  const [voiceOverlayInteractive, setVoiceOverlayInteractive] = useState(() =>
    loadVoiceOverlayInteractive(),
  );
  const [updateProgress, setUpdateProgress] = useState<{
    loaded: number;
    total: number | null;
    phase: string;
  } | null>(null);
  const [tunnelProvider, setTunnelProvider] = useState<TunnelProviderId>(() =>
    loadTunnelProvider(),
  );
  const [ngrokToken, setNgrokToken] = useState(() => loadNgrokAuthToken());
  const [zrokToken, setZrokToken] = useState(() => loadZrokToken());

  const pushVoiceHotkeysToNative = (ptt: PttKeyCode, mute: PttKeyCode, deafen: PttKeyCode) => {
    if (!isDesktopShell()) return;
    void import('@tauri-apps/api/core').then(({ invoke }) => {
      void invoke('set_voice_hotkey_vks', {
        pttVk: pttVkForCode(ptt),
        muteVk: hotkeyVkForCode(mute),
        deafenVk: hotkeyVkForCode(deafen),
      }).catch(() => {});
    });
  };

  const networkDraft = {
    publicUrl,
    bootstrap,
    turnUrls,
    turnUser,
    turnCred,
    meteredKey,
    meteredApp,
  };
  const [savedNetwork, setSavedNetwork] = useState(networkDraft);
  const networkDirty = (Object.keys(networkDraft) as Array<keyof typeof networkDraft>).some(
    (key) => networkDraft[key] !== savedNetwork[key],
  );
  const selectTab = (id: SettingsTabId) => {
    setActiveTab(id);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  };
  const discardNetwork = () => {
    setPublicUrlDraft(savedNetwork.publicUrl);
    setBootstrap(savedNetwork.bootstrap);
    setTurnUrls(savedNetwork.turnUrls);
    setTurnUser(savedNetwork.turnUser);
    setTurnCred(savedNetwork.turnCred);
    setMeteredKey(savedNetwork.meteredKey);
    setMeteredApp(savedNetwork.meteredApp);
    setSaveError(false);
    setSaved('Несохранённые изменения отменены.');
  };
  const requestBack = () => (networkDirty ? setLeavePrompt(true) : goBack());

  useEffect(() => {
    if (activeTab === 'network' && reviewNetworkRef.current) {
      advancedRef.current?.scrollIntoView({ block: 'start' });
      advancedRef.current?.querySelector('summary')?.focus({ preventScroll: true });
      reviewNetworkRef.current = false;
    }
  }, [activeTab]);

  const pushOverlayPayloadPatch = (patch: Partial<VoiceOverlayPayload>) => {
    try {
      const raw = window.localStorage.getItem(VOICE_OVERLAY_PAYLOAD_KEY);
      const base: VoiceOverlayPayload = raw
        ? (JSON.parse(raw) as VoiceOverlayPayload)
        : {
            channelName: 'Голос',
            opacity: loadVoiceOverlayOpacity(),
            interactive: loadVoiceOverlayInteractive(),
            peers: [],
          };
      const next = { ...base, ...patch };
      window.localStorage.setItem(VOICE_OVERLAY_PAYLOAD_KEY, JSON.stringify(next));
      void import('@tauri-apps/api/event').then(({ emit }) => {
        void emit('voice-overlay-state', next);
      });
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('p2pchat-voice-settings'));
    window.dispatchEvent(new CustomEvent('p2pchat-voice-overlay-push'));
  };

  useEffect(() => {
    void currentAppVersion().then(setAppVersion);
  }, []);

  useEffect(() => {
    void getAutostartEnabled().then(setAutostartEnabledState);
  }, []);

  useEffect(() => {
    void warmIceServers();
  }, []);

  useEffect(() => {
    void listAudioDevices().then(({ inputs, outputs }) => {
      setAudioInputs(inputs);
      setAudioOutputs(outputs);
    });
  }, []);

  const retryTunnel = async () => {
    setTunnelBusy(true);
    setTunnelMsg('');
    saveTunnelProvider(tunnelProvider);
    saveNgrokAuthToken(ngrokToken);
    saveZrokToken(zrokToken);
    try {
      const info = await restartPublicTunnel();
      if (info?.publicOrigin) {
        setPublicUrlDraft(info.publicOrigin);
        setSavedNetwork((current) => ({ ...current, publicUrl: info.publicOrigin! }));
        setPublicUrl(info.publicOrigin);
        const next = await refreshCoordinatorInvite();
        if (next) {
          writeStore(SERVER_KEY, { ...readStore(SERVER_KEY, seedServer), invite: next.invite });
        }
        setTunnelMsg(
          `Туннель (${tunnelProvider}): ${info.publicOrigin}. Скопируйте новое приглашение.`,
        );
      } else {
        setTunnelMsg(info?.tunnelError || 'Не удалось поднять туннель');
      }
    } catch (error) {
      setTunnelMsg(
        error instanceof Error
          ? error.message
          : 'Не удалось обновить подключение. Попробуйте ещё раз.',
      );
    } finally {
      setTunnelBusy(false);
    }
  };

  const checkUpdates = async () => {
    setUpdateBusy(true);
    setUpdateMsg('');
    try {
      const info = await checkForAppUpdate();
      setUpdateInfo(info);
      if (info.upToDate) setUpdateMsg(`У вас актуальная версия ${info.currentVersion}`);
      else setUpdateMsg(`Доступна ${info.latestVersion} (сейчас ${info.currentVersion})`);
    } catch (error) {
      setUpdateMsg(error instanceof Error ? error.message : 'Не удалось проверить обновления');
    } finally {
      setUpdateBusy(false);
    }
  };

  const installUpdate = async () => {
    if (!updateInfo) return;
    if (!isDesktopShell() || getUpdatePlatform() !== 'windows' || !updateInfo.downloadUrl) {
      try {
        if (isDesktopShell()) {
          const { openUrl } = await import('@tauri-apps/plugin-opener');
          await openUrl(updateInfo.releaseUrl);
        } else {
          window.open(updateInfo.releaseUrl, '_blank', 'noopener,noreferrer');
        }
      } catch (error) {
        setUpdateMsg(error instanceof Error ? error.message : 'Не удалось открыть страницу релиза');
      }
      return;
    }
    if (!updateInfo.sha256) {
      setUpdateMsg(
        'В релизе нет SHA-256 — откройте страницу релиза и скачайте установщик вручную.',
      );
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(updateInfo.releaseUrl);
      } catch (error) {
        setUpdateMsg(error instanceof Error ? error.message : 'Не удалось открыть страницу релиза');
      }
      return;
    }
    setUpdateBusy(true);
    setUpdateProgress({ loaded: 0, total: null, phase: 'download' });
    setUpdateMsg(
      `Скачиваем Drift ${updateInfo.latestVersion}… Приложение закроется. Подтвердите запрос Windows (администратор) — иначе файлы в Program Files не заменятся.`,
    );
    try {
      await installAppUpdate(
        updateInfo.downloadUrl,
        (loaded, total, phase) => {
          setUpdateProgress({ loaded, total, phase });
        },
        updateInfo.sha256,
      );
    } catch (error) {
      setUpdateMsg(error instanceof Error ? error.message : String(error));
      setUpdateBusy(false);
      setUpdateProgress(null);
    }
  };

  const updateProgressPercent =
    updateProgress?.total && updateProgress.total > 0
      ? Math.min(100, Math.round((updateProgress.loaded / updateProgress.total) * 100))
      : null;

  const saveNetwork = () => {
    setSaveError(false);
    try {
      if (publicUrl.trim()) setPublicUrl(publicUrl.trim(), { manual: true });
      else setPublicUrl('');
      setBootstrapOrigin(bootstrap.trim());
      saveIceSettings({
        turn: turnUrls.trim()
          ? { urls: turnUrls.trim(), username: turnUser.trim(), credential: turnCred.trim() }
          : null,
        meteredApiKey: meteredKey.trim() || null,
        meteredAppName: meteredApp.trim() || null,
      });
      saveTunnelProvider(tunnelProvider);
      saveNgrokAuthToken(ngrokToken);
      saveZrokToken(zrokToken);
      void warmIceServers();
      void refreshCoordinatorInvite()
        .then((next) => {
          if (next) {
            writeStore(SERVER_KEY, { ...readStore(SERVER_KEY, seedServer), invite: next.invite });
          }
        })
        .catch(() => {
          setSaveError(true);
          setSaved(
            'Параметры сохранены, но приглашение не обновилось. Повторите копирование приглашения в комнате.',
          );
        });
      setSavedNetwork({ ...networkDraft });
      setSaved(
        'Параметры подключения сохранены. Если вы создали комнату, скопируйте новое приглашение друзьям.',
      );
    } catch {
      setSaveError(true);
      setSaved('Не удалось сохранить параметры. Проверьте поля и повторите попытку.');
    }
  };

  return (
    <div className="d2-settings">
      {updateProgress && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[hsl(var(--background)/.85)] backdrop-blur-sm"
          data-testid="overlay-update-progress"
        >
          <div className="mx-4 w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
            <div className="text-sm font-bold">Обновление Drift</div>
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              {updateProgress.phase === 'install'
                ? 'Запуск установщика…'
                : updateProgress.phase === 'verify'
                  ? 'Проверка SHA-256…'
                  : 'Скачивание…'}{' '}
              Не закрывайте окно.
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <div
                className="h-full bg-[hsl(var(--primary))] transition-all duration-200"
                style={{
                  width: `${updateProgressPercent ?? (updateProgress.loaded > 0 ? 8 : 0)}%`,
                }}
              />
            </div>
            <p className="mt-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
              {updateProgressPercent !== null
                ? `${updateProgressPercent}%`
                : updateProgress.loaded > 0
                  ? `${Math.round(updateProgress.loaded / 1024 / 1024)} МБ`
                  : 'Подготовка…'}
            </p>
          </div>
        </div>
      )}
      <header className="d2-settings-toolbar">
        <Button tone="quiet" onClick={requestBack} data-testid="button-settings-back">
          <ArrowLeft size={16} />
          {roomMeta?.roomId ? 'Вернуться в комнату' : 'Назад'}
        </Button>
      </header>
      <div className="d2-settings-layout">
        <aside className="d2-settings-sidebar">
          <h1>Настройки</h1>
          <nav aria-label="Разделы настроек">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? 'page' : undefined}
                aria-controls="settings-content"
                onClick={() => selectTab(tab.id)}
                data-testid={`settings-nav-${tab.id}`}
              >
                <tab.icon size={17} aria-hidden="true" />
                <span>{tab.title}</span>
                {tab.id === 'network' && networkDirty && (
                  <span
                    className="d2-settings-dirty-dot"
                    aria-label="Есть несохранённые изменения"
                  />
                )}
              </button>
            ))}
          </nav>
          <div className="d2-settings-sidebar-credit">
            <StudioCredit />
          </div>
        </aside>
        <div className="d2-settings-content" ref={contentRef} id="settings-content">
          <div className="d2-settings-content-inner">
            <div className="d2-settings-heading">
              <h2>{SETTINGS_TABS.find((tab) => tab.id === activeTab)?.title}</h2>
              <p>
                {activeTab === 'network'
                  ? 'Сервис подключения сохраняется сразу. Ручные параметры — по кнопке «Сохранить параметры».'
                  : 'Изменения сохраняются сразу.'}
              </p>
            </div>
            {activeTab === 'appearance' && (
              <>
                <SettingsSection title="Тема интерфейса" testId="settings-section-appearance">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {APP_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${themeId === theme.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.12)]' : 'border-[hsl(var(--border))]'}`}
                        onClick={() => {
                          setThemeId(theme.id);
                          saveTheme(theme.id);
                        }}
                        aria-pressed={themeId === theme.id}
                        data-testid={`button-theme-${theme.id}`}
                      >
                        <span className="d2-theme-choice-label">
                          {theme.label}
                          {themeId === theme.id && <Check size={15} aria-hidden="true" />}
                        </span>
                        {theme.id === 'patriot' && (
                          <span className="mt-1 flex items-center gap-1.5 text-[10px] font-normal text-[hsl(var(--muted-foreground))]">
                            <span className="patriot-flag-bars" aria-hidden />
                            флаг · звания
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </SettingsSection>
              </>
            )}
            {activeTab === 'audio' && (
              <>
                <SettingsSection title="Микрофон и динамики" testId="settings-section-devices">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Меняются сразу, даже если вы уже в голосовом канале.
                  </p>
                  <label className="field-label mt-3" htmlFor="audio-input">
                    Вход (микрофон)
                  </label>
                  <div className="d2-settings-select">
                    <select
                      id="audio-input"
                      className="field-input"
                      value={audioInputId}
                      onChange={(event) => {
                        const id = event.target.value;
                        setAudioInputId(id);
                        saveAudioInputId(id);
                        window.dispatchEvent(new CustomEvent('p2pchat-audio-settings'));
                      }}
                      data-testid="select-audio-input"
                    >
                      <option value="">Системный по умолчанию</option>
                      {audioInputs.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Микрофон ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </div>
                  <label className="field-label mt-3" htmlFor="audio-output">
                    Выход (динамики)
                  </label>
                  <div className="d2-settings-select">
                    <select
                      id="audio-output"
                      className="field-input"
                      value={audioOutputId}
                      onChange={(event) => {
                        const id = event.target.value;
                        setAudioOutputId(id);
                        saveAudioOutputId(id);
                        window.dispatchEvent(new CustomEvent('p2pchat-audio-settings'));
                      }}
                      data-testid="select-audio-output"
                    >
                      <option value="">Системный по умолчанию</option>
                      {audioOutputs.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Выход ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </div>
                </SettingsSection>
                <SettingsSection title="Разговор и горячие клавиши" testId="settings-section-voice">
                  <label className="field-label" htmlFor="voice-mode">
                    Режим
                  </label>
                  <div className="d2-settings-select">
                    <select
                      id="voice-mode"
                      className="field-input"
                      value={voiceTalkMode}
                      onChange={(event) => {
                        const mode = event.target.value === 'ptt' ? 'ptt' : 'vad';
                        setVoiceTalkMode(mode);
                        saveVoiceTalkMode(mode);
                        window.dispatchEvent(new CustomEvent('p2pchat-voice-settings'));
                      }}
                      data-testid="select-voice-mode"
                    >
                      <option value="vad">Активация голосом (по умолчанию)</option>
                      <option value="ptt">По нажатию клавиши (PTT)</option>
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </div>
                  {voiceTalkMode === 'ptt' && (
                    <HotkeyBindControl
                      label="Клавиша PTT"
                      value={pttKeyCode}
                      testId="hotkey-ptt"
                      onChange={(code) => {
                        setPttKeyCode(code);
                        savePttKeyCode(code);
                        pushVoiceHotkeysToNative(code, muteHotkeyCode, deafenHotkeyCode);
                        window.dispatchEvent(new CustomEvent('p2pchat-voice-settings'));
                      }}
                    />
                  )}
                  <HotkeyBindControl
                    label="Включение и отключение микрофона"
                    value={muteHotkeyCode}
                    allowClear
                    testId="hotkey-mute"
                    onChange={(code) => {
                      setMuteHotkeyCode(code);
                      saveMuteHotkeyCode(code);
                      pushVoiceHotkeysToNative(pttKeyCode, code, deafenHotkeyCode);
                      window.dispatchEvent(new CustomEvent('p2pchat-voice-settings'));
                    }}
                  />
                  <HotkeyBindControl
                    label="Включение и отключение звука"
                    value={deafenHotkeyCode}
                    allowClear
                    testId="hotkey-deafen"
                    onChange={(code) => {
                      setDeafenHotkeyCode(code);
                      saveDeafenHotkeyCode(code);
                      pushVoiceHotkeysToNative(pttKeyCode, muteHotkeyCode, code);
                      window.dispatchEvent(new CustomEvent('p2pchat-voice-settings'));
                    }}
                  />
                  <p className="mt-2 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
                    Глобальные клавиши работают в Windows, пока вы в голосовом канале. Для
                    микрофона, звука и разговора по нажатию выберите разные клавиши.
                  </p>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={voiceOverlayEnabled}
                      disabled={!isDesktopShell()}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setVoiceOverlayEnabled(next);
                        saveVoiceOverlayEnabled(next);
                        if (isDesktopShell()) {
                          void import('@tauri-apps/api/core').then(({ invoke }) => {
                            if (!next) void invoke('hide_voice_overlay').catch(() => {});
                          });
                        }
                        window.dispatchEvent(new CustomEvent('p2pchat-voice-settings'));
                      }}
                      data-testid="checkbox-voice-overlay"
                    />
                    <span>
                      <span className="block text-xs font-bold">Панель голосового канала</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
                        Показывать участников и говорящего поверх игры в оконном режиме.
                      </span>
                    </span>
                  </label>
                  {voiceOverlayEnabled && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="field-label" htmlFor="overlay-opacity">
                          Прозрачность панели · {Math.round(voiceOverlayOpacity * 100)}%
                        </label>
                        <input
                          id="overlay-opacity"
                          type="range"
                          min={15}
                          max={100}
                          value={Math.round(voiceOverlayOpacity * 100)}
                          onChange={(event) => {
                            const next = Number(event.target.value) / 100;
                            setVoiceOverlayOpacity(next);
                            saveVoiceOverlayOpacity(next);
                            pushOverlayPayloadPatch({ opacity: next });
                          }}
                          className="w-full"
                          data-testid="range-overlay-opacity"
                        />
                      </div>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={voiceOverlayInteractive}
                          disabled={!isDesktopShell()}
                          onChange={(event) => {
                            const next = event.target.checked;
                            setVoiceOverlayInteractive(next);
                            saveVoiceOverlayInteractive(next);
                            pushOverlayPayloadPatch({ interactive: next });
                          }}
                          data-testid="checkbox-voice-overlay-interactive"
                        />
                        <span>
                          <span className="block text-xs font-bold">Поменять расположение</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
                            Включите, чтобы перетаскивать панель. Когда выключено, клики проходят
                            сквозь неё к игре.
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
                </SettingsSection>
                <SettingsSection title="Звуки Drift" testId="settings-section-sounds">
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={funSoundsEnabled}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setFunSoundsEnabled(next);
                        saveFunSoundsEnabled(next);
                      }}
                      data-testid="checkbox-fun-sounds"
                    />
                    <span>
                      <span className="block text-xs font-bold">Звуки звуковой панели</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
                        Воспроизводить звуки, которые отправляют участники в чат.
                      </span>
                    </span>
                  </label>

                  <div
                    className="mt-4 rounded-lg border border-[hsl(var(--border))] p-3"
                    data-testid="startup-sound-picker"
                  >
                    <div className="text-xs font-bold">Звук запуска Drift</div>
                    <p className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
                      «Слушать» проигрывает пример. Нажмите на название, чтобы выбрать звук.
                    </p>
                    <div className="mt-3 space-y-2">
                      {STARTUP_SOUND_OPTIONS.map((option) => {
                        const selected = startupSoundId === option.id;
                        return (
                          <div
                            key={option.id}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${selected ? 'border-[hsl(var(--primary)/.55)] bg-[hsl(var(--primary)/.08)]' : 'border-[hsl(var(--border))]'}`}
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => {
                                setStartupSoundId(option.id);
                                saveStartupSoundId(option.id);
                              }}
                              aria-pressed={selected}
                              data-testid={`button-select-startup-${option.id}`}
                            >
                              <span className="flex items-center gap-1.5 text-xs font-bold">
                                {selected && <Check size={14} aria-hidden="true" />} {option.label}
                                {selected ? ' · выбран' : ''}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-[hsl(var(--muted-foreground))]">
                                {option.hint}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="ghost-btn !h-8 shrink-0 !px-2.5 text-[10px]"
                              onClick={() => {
                                previewStartupSound(option.id);
                              }}
                              data-testid={`button-preview-startup-${option.id}`}
                            >
                              Слушать
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </SettingsSection>
              </>
            )}
            {activeTab === 'notifications' && (
              <SettingsSection title="События и сообщения" testId="settings-section-notifications">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={uiSoundsEnabled}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setUiSoundsEnabled(next);
                      saveUiSoundsEnabled(next);
                      if (next) playUiSound('chat-text');
                    }}
                    data-testid="checkbox-ui-sounds"
                  />
                  <span>
                    <span className="block text-xs font-bold">Звуки событий чата</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
                      Вход участников, голос, сообщения и упоминания.
                    </span>
                  </span>
                </label>
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={desktopNotifyEnabled}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setDesktopNotifyEnabled(next);
                      saveDesktopNotifyEnabled(next);
                    }}
                    data-testid="checkbox-desktop-notify"
                  />
                  <span>
                    <span className="block text-xs font-bold">Уведомления на рабочем столе</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
                      Уведомлять о сообщениях и входе в голосовой канал, когда Drift свёрнут.
                    </span>
                  </span>
                </label>
              </SettingsSection>
            )}
            {activeTab === 'app' && (
              <>
                <SettingsSection title="Запуск и обновления" testId="settings-section-app">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold">Автозапуск с Windows</div>
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        Запускать Drift при входе в систему.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autostartEnabled}
                      aria-label="Запускать Drift при входе в систему"
                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${autostartEnabled ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}
                      disabled={autostartBusy || !isDesktopShell()}
                      onClick={() => {
                        const next = !autostartEnabled;
                        setAutostartBusy(true);
                        void setAutostartEnabled(next)
                          .then((ok) => {
                            setAutostartEnabledState(ok);
                            setAutostartError(false);
                            setAutostartMsg(ok ? 'Автозапуск включён' : 'Автозапуск выключен');
                          })
                          .catch((error) => {
                            setAutostartError(true);
                            setAutostartMsg(
                              error instanceof Error
                                ? error.message
                                : 'Не удалось изменить автозапуск',
                            );
                          })
                          .finally(() => setAutostartBusy(false));
                      }}
                      data-testid="toggle-autostart"
                    >
                      <span
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${autostartEnabled ? 'left-[22px]' : 'left-0.5'}`}
                      />
                    </button>
                  </div>
                  {autostartMsg && (
                    <p
                      className="d2-settings-feedback"
                      data-error={autostartError}
                      role={autostartError ? 'alert' : 'status'}
                      data-testid="text-autostart-status"
                    >
                      {autostartMsg}
                    </p>
                  )}
                  <div className="mt-5 border-t border-[hsl(var(--border))] pt-4">
                    <div className="text-sm font-bold">Обновления</div>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Drift {appVersion} · GitHub greed-is-good/Drift-2
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={updateBusy}
                        onClick={() => void checkUpdates()}
                        data-testid="button-check-updates"
                      >
                        {updateBusy ? 'Подождите…' : 'Проверить обновления'}
                      </button>
                      {updateInfo && !updateInfo.upToDate && (
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={updateBusy}
                          onClick={() => void installUpdate()}
                          data-testid="button-download-update"
                        >
                          {updateInfo.downloadUrl && isDesktopShell() && getUpdatePlatform() === 'windows'
                            ? `Обновить до ${updateInfo.latestVersion}`
                            : 'Открыть страницу релиза'}
                        </button>
                      )}
                    </div>
                    {updateMsg && (
                      <p
                        className="mt-2 text-xs text-[hsl(var(--muted-foreground))]"
                        data-testid="text-update-status"
                      >
                        {updateMsg}
                      </p>
                    )}
                  </div>

                  <p className="d2-settings-help">
                    Закрытие окна сворачивает Drift в трей. Для полного выхода откройте меню иконки
                    Drift в трее и выберите «Выход».
                  </p>
                </SettingsSection>
              </>
            )}
            {activeTab === 'network' && (
              <>
                <SettingsSection
                  title="Подключение из другой сети"
                  testId="settings-section-network"
                >
                  <details className="d2-settings-details">
                    <summary>
                      Состояние подключения
                      <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <NetworkHealthPanel />
                  </details>
                  <p className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
                    Чат и голос используют разные способы подключения.
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {TUNNEL_PROVIDER_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                          tunnelProvider === opt.id
                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.08)]'
                            : 'border-[hsl(var(--border))]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="tunnel-provider"
                          className="mt-1"
                          checked={tunnelProvider === opt.id}
                          onChange={() => {
                            setTunnelProvider(opt.id);
                            saveTunnelProvider(opt.id);
                          }}
                          data-testid={`radio-tunnel-${opt.id}`}
                        />
                        <span>
                          <span className="font-semibold">{opt.label}</span>
                          <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">
                            {opt.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {tunnelProvider === 'ngrok' && (
                    <div className="mt-3">
                      <label className="field-label" htmlFor="ngrok-token">
                        ngrok Authtoken
                      </label>
                      <input
                        id="ngrok-token"
                        className="field-input"
                        value={ngrokToken}
                        onChange={(e) => {
                          setNgrokToken(e.target.value);
                          saveNgrokAuthToken(e.target.value);
                        }}
                        placeholder="из dashboard.ngrok.com → Your Authtoken"
                        data-testid="input-ngrok-token"
                      />
                    </div>
                  )}
                  {tunnelProvider === 'zrok' && (
                    <div className="mt-3">
                      <label className="field-label" htmlFor="zrok-token">
                        zrok account token
                      </label>
                      <input
                        id="zrok-token"
                        className="field-input"
                        value={zrokToken}
                        onChange={(e) => {
                          setZrokToken(e.target.value);
                          saveZrokToken(e.target.value);
                        }}
                        placeholder="из zrok.io → Enable Your Environment"
                        data-testid="input-zrok-token"
                      />
                    </div>
                  )}
                  <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
                    Текущий URL:{' '}
                    {getPublicUrl() || 'ещё нет — создайте комнату или обновите подключение'}
                  </p>
                  <button
                    type="button"
                    className="primary-btn mt-3"
                    disabled={tunnelBusy || networkDirty || !isDesktopShell()}
                    onClick={() => void retryTunnel()}
                    data-testid="button-retry-tunnel"
                  >
                    {tunnelBusy ? 'Подключаем…' : 'Обновить подключение'}
                  </button>
                  {tunnelMsg && (
                    <p
                      className="mt-2 text-xs text-[hsl(var(--muted-foreground))]"
                      data-testid="text-tunnel-status"
                    >
                      {tunnelMsg}
                    </p>
                  )}

                  {networkDirty && (
                    <p className="d2-settings-help">
                      Сохраните или отмените ручные параметры перед обновлением подключения.
                    </p>
                  )}
                </SettingsSection>
                <details
                  ref={advancedRef}
                  className="d2-settings-details d2-settings-section"
                  open={advancedOpen}
                  onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
                  data-testid="settings-section-advanced"
                >
                  <summary>
                    Ручные параметры
                    <ChevronDown size={16} aria-hidden="true" />
                  </summary>
                  <div>
                    <p className="d2-settings-help">
                      Изменения в этих полях применятся после сохранения.
                    </p>
                    <form
                      className="space-y-4"
                      id="settings-network-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveNetwork();
                      }}
                      data-testid="form-network-settings"
                    >
                      <div>
                        <label className="field-label" htmlFor="public-url">
                          Публичный URL вручную
                        </label>
                        <input
                          id="public-url"
                          className="field-input"
                          value={publicUrl}
                          onChange={(e) => setPublicUrlDraft(e.target.value)}
                          placeholder="https://….trycloudflare.com"
                          data-testid="input-public-url"
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="bootstrap-url">
                          Адрес узла синхронизации
                        </label>
                        <input
                          id="bootstrap-url"
                          className="field-input"
                          value={bootstrap}
                          onChange={(e) => setBootstrap(e.target.value)}
                          placeholder="опционально"
                          data-testid="input-bootstrap-url"
                        />
                      </div>
                      <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                        <div className="text-sm font-bold">Голос через интернет (TURN)</div>
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          Опционально. В разных сетях без TURN голос часто не поднимается — можно
                          указать Metered API key или свой coturn. Без ключа остаётся бесплатный
                          Open Relay (не всегда работает).
                        </p>
                        <label className="field-label mt-3" htmlFor="metered-key">
                          Metered API key
                        </label>
                        <input
                          id="metered-key"
                          className="field-input"
                          value={meteredKey}
                          onChange={(e) => setMeteredKey(e.target.value)}
                          placeholder="из dashboard Metered"
                          data-testid="input-metered-key"
                        />
                        <label className="field-label mt-3" htmlFor="metered-app">
                          Metered app name
                        </label>
                        <input
                          id="metered-app"
                          className="field-input"
                          value={meteredApp}
                          onChange={(e) => setMeteredApp(e.target.value)}
                          placeholder="имя приложения в Metered"
                          data-testid="input-metered-app"
                        />
                      </div>
                      <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                        <div className="text-sm font-bold">Свой TURN (VPS / coturn)</div>
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          Если заполнено — имеет приоритет над Metered.
                        </p>
                        <label className="field-label mt-3" htmlFor="turn-urls">
                          TURN URL
                        </label>
                        <input
                          id="turn-urls"
                          className="field-input"
                          value={turnUrls}
                          onChange={(e) => setTurnUrls(e.target.value)}
                          placeholder="turn:your-vps:3478"
                          data-testid="input-turn-urls"
                        />
                        <label className="field-label mt-3" htmlFor="turn-user">
                          Имя пользователя
                        </label>
                        <input
                          id="turn-user"
                          className="field-input"
                          value={turnUser}
                          onChange={(e) => setTurnUser(e.target.value)}
                          data-testid="input-turn-user"
                        />
                        <label className="field-label mt-3" htmlFor="turn-cred">
                          Пароль TURN
                        </label>
                        <input
                          id="turn-cred"
                          className="field-input"
                          type="password"
                          value={turnCred}
                          onChange={(e) => setTurnCred(e.target.value)}
                          data-testid="input-turn-cred"
                        />
                      </div>
                      <div className="d2-settings-form-actions">
                        <Button
                          tone="primary"
                          type="submit"
                          disabled={!networkDirty || tunnelBusy}
                          data-testid="button-save-settings"
                        >
                          Сохранить параметры
                        </Button>
                      </div>
                    </form>
                  </div>
                </details>
                {saved && (!networkDirty || saveError) && (
                  <p
                    className="d2-settings-feedback"
                    data-error={saveError}
                    role={saveError ? 'alert' : 'status'}
                    data-testid="text-settings-saved"
                  >
                    {saved}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {networkDirty && (
        <div className="d2-settings-savebar" aria-label="Несохранённые параметры">
          <span>Есть несохранённые параметры подключения</span>
          <div>
            <Button tone="quiet" onClick={discardNetwork} data-testid="button-discard-network">
              Отменить изменения
            </Button>
            {activeTab === 'network' ? (
              <Button
                key="save-network"
                tone="primary"
                type="button"
                onClick={saveNetwork}
                disabled={tunnelBusy}
                data-testid="button-save-network-bar"
              >
                Сохранить параметры
              </Button>
            ) : (
              <Button
                key="review-network"
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  reviewNetworkRef.current = true;
                  selectTab('network');
                  setAdvancedOpen(true);
                }}
                data-testid="button-review-network"
              >
                К изменениям
              </Button>
            )}
          </div>
        </div>
      )}
      <AlertDialog open={leavePrompt} onOpenChange={setLeavePrompt}>
        <AlertDialogContent
          className="d2-settings-leave-dialog"
          overlayClassName="d2-settings-leave-overlay"
        >
          <AlertDialogTitle>Выйти без сохранения?</AlertDialogTitle>
          <AlertDialogDescription>
            Ручные параметры подключения изменены. При выходе эти изменения будут потеряны.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Продолжить настройку</AlertDialogCancel>
            <AlertDialogAction onClick={goBack}>Выйти без сохранения</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
