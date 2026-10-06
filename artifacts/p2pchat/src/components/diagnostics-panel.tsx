import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Activity, ArrowLeft, Check, ChevronDown, Clipboard, Download, Globe, Info, Mic, Settings, Trash2, TriangleAlert, Wifi } from 'lucide-react';
import { getPublicUrl, getActiveVoiceMesh } from '@/lib/p2p-client';
import { getLastVoiceNatReport, iceConfigFlags } from '@/lib/voice-diagnostics';
import type { SessionStatus } from '@workspace/p2p-room';
import { clearDebugLogs, copyDebugReport, debugLog, downloadDebugReport, getDebugLogs, subscribeDebugLogs } from '@/lib/debug-log';
import { type Server, SERVER_KEY, CONNECTION_KEY, readStore, seedServer } from '@/lib/app-shared';
import { StudioCredit } from '@/components/app-brand';
import { Button } from '@/components/drift-ui';

type StatusTone = 'ok' | 'warning' | 'neutral';

function StatusRow({ title, state, description, tone, icon, action, testId }: {
  title: string; state: string; description: string; tone: StatusTone;
  icon: ReactNode; action?: ReactNode; testId: string;
}) {
  return <div className="d2-diagnostic-row" data-testid={testId}>
    <span className="d2-diagnostic-icon" aria-hidden="true">{icon}</span>
    <div className="d2-diagnostic-content">
      <div className="d2-diagnostic-row-heading"><h2>{title}</h2><span className="d2-diagnostic-state" data-tone={tone}>
        {tone === 'ok' ? <Check size={14} aria-hidden="true" /> : tone === 'warning' ? <TriangleAlert size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}{state}
      </span></div>
      <p>{description}</p>
    </div>
    {action && <div className="d2-diagnostic-row-action">{action}</div>}
  </div>;
}

export function Diagnostics({ onClose, onSettings }: { onClose?: () => void; onSettings?: () => void }) {
  const [, setLocation] = useLocation();
  const server = readStore<Server>(SERVER_KEY, seedServer);
  const goBack = () => (onClose ? onClose() : setLocation(server.roomId ? '/server' : '/'));
  const openSettings = () => (onSettings ? onSettings() : setLocation('/settings'));
  const [logTick, setLogTick] = useState(0);
  const [logAction, setLogAction] = useState('');
  const [actionError, setActionError] = useState(false);
  const [natBusy, setNatBusy] = useState(false);
  const natBusyRef = useRef(false);
  const [copying, setCopying] = useState(false);
  const copyingRef = useRef(false);
  const connectionStatus = readStore<SessionStatus>(CONNECTION_KEY, 'offline');
  const connectionLabel = connectionStatus === 'connected' ? 'Подключён' : connectionStatus === 'reconnecting' ? 'Переподключение…' : connectionStatus === 'connecting' ? 'Подключение…' : 'Нет соединения';
  const voiceActive = Boolean(getActiveVoiceMesh());
  const iceFlags = iceConfigFlags();
  const publicUrl = getPublicUrl();
  const logs = getDebugLogs();
  const lastVoiceReport = getLastVoiceNatReport();
  const iceLabel = iceFlags.customTurn ? 'Свой TURN' : iceFlags.meteredConfigured ? 'Metered' : 'Резервная конфигурация';

  useEffect(() => subscribeDebugLogs(() => setLogTick(n => n + 1)), []);

  const reportExtra = () => ({
    serverRole: server.role,
    hostName: server.hostName,
    roomId: server.roomId,
    connectionStatus,
    logCount: logs.length,
    iceFlags: iceConfigFlags(),
    voiceNat: getLastVoiceNatReport(),
  });
  const showResult = (text: string, error = false) => {
    setActionError(error);
    setLogAction(text);
  };
  const copyLogs = async () => {
    if (copyingRef.current) return;
    copyingRef.current = true;
    setCopying(true);
    try {
      const ok = await copyDebugReport({ ...reportExtra(), logTick });
      showResult(ok ? 'Отчёт скопирован.' : 'Не удалось скопировать отчёт. Попробуйте скачать файл.', !ok);
      debugLog('diagnostics', ok ? 'report copied' : 'copy failed');
    } catch {
      showResult('Не удалось скопировать отчёт. Попробуйте скачать файл.', true);
    } finally {
      copyingRef.current = false;
      setCopying(false);
    }
  };
  const downloadLogs = () => {
    downloadDebugReport(reportExtra());
    showResult('Отчёт подготовлен для сохранения в файл .txt.');
    debugLog('diagnostics', 'report downloaded');
  };
  const snapshotNat = async () => {
    if (natBusyRef.current) return;
    natBusyRef.current = true;
    setNatBusy(true);
    try {
      const mesh = getActiveVoiceMesh();
      if (mesh) {
        const report = await mesh.collectNatReport();
        showResult(report.peers.length
          ? 'Статистика голоса собрана. Теперь скачайте или скопируйте отчёт.'
          : 'В голосовом канале нет подключённых собеседников. Отчёт содержит состояние комнаты и журнал событий.');
      } else {
        showResult('Отчёт содержит состояние комнаты и журнал событий. Для статистики голоса войдите в канал с другом и повторите сбор.');
        debugLog('voice-nat', 'no active mesh', { hadLast: Boolean(getLastVoiceNatReport()), iceFlags: iceConfigFlags() });
      }
    } catch {
      showResult('Не удалось собрать статистику голоса. Попробуйте снова. Журнал событий можно скачать отдельно.', true);
    } finally {
      natBusyRef.current = false;
      setNatBusy(false);
    }
  };

  return <div className="d2-diagnostics">
    <header className="d2-diagnostics-toolbar">
      <Button tone="quiet" onClick={goBack} data-testid="button-back-to-server"><ArrowLeft size={16} />{server.roomId ? 'Вернуться в комнату' : 'Назад'}</Button>
    </header>
    <main className="d2-diagnostics-main">
      <div className="d2-diagnostics-heading"><h1>Состояние комнаты</h1><p>{server.name}</p></div>

      <section className="d2-diagnostics-card" aria-label="Подключение">
        <StatusRow title="Чат" state={connectionLabel} tone={connectionStatus === 'connected' ? 'ok' : connectionStatus === 'offline' ? 'warning' : 'neutral'} icon={<Wifi size={19} />} description={connectionStatus === 'connected' ? 'Соединение с комнатой установлено.' : 'Подключение к комнате требуется для обмена сообщениями.'} testId="diagnostic-row-0" />
        <StatusRow title="Голос" state={voiceActive ? 'Вы в голосовом канале' : 'Вы не в голосовом канале'} tone="neutral" icon={<Mic size={19} />} description={voiceActive ? 'Если звук не слышен, соберите отчёт, оставаясь в канале с другом.' : 'Для проверки передачи звука нужно войти в голосовой канал с другом.'} testId="diagnostic-row-1" />
        <StatusRow title="Публичный адрес" state={publicUrl ? 'Указан' : 'Отсутствует'} tone="neutral" icon={<Globe size={19} />} description={publicUrl ? 'Адрес указан. Его доступность из другой сети здесь не проверяется.' : 'Публичный адрес для подключения из другой сети не задан.'} action={<Button tone="quiet" onClick={openSettings} data-testid="button-diagnostics-settings"><Settings size={15} />Настройки</Button>} testId="diagnostic-row-2" />
      </section>

      <section className="d2-diagnostics-card d2-diagnostics-report" aria-labelledby="diagnostics-report-title">
        <div><h2 id="diagnostics-report-title">Отчёт о подключении</h2><p>Если что-то не работает, соберите отчёт и передайте его разработчику. Для проблемы со звуком оставайтесь в голосовом канале с другом.</p></div>
        <div className="d2-diagnostics-actions">
          <Button tone="primary" busy={natBusy} onClick={() => void snapshotNat()} data-testid="button-nat-snapshot">{!natBusy && <Activity size={16} />}{natBusy ? 'Собираем…' : 'Собрать отчёт'}</Button>
          <Button disabled={natBusy} onClick={downloadLogs} data-testid="button-download-debug-log"><Download size={16} />Скачать .txt</Button>
          <Button tone="quiet" busy={copying} disabled={natBusy} onClick={() => void copyLogs()} data-testid="button-copy-debug-log">{!copying && <Clipboard size={16} />}{copying ? 'Копируем…' : 'Скопировать'}</Button>
        </div>
        {logAction && <p className="d2-diagnostics-result" data-error={actionError} role={actionError ? 'alert' : 'status'} data-testid="text-log-action">{logAction}</p>}
      </section>

      <details className="d2-diagnostics-card d2-diagnostics-disclosure" data-testid="section-technical-details">
        <summary data-testid="button-reveal-diagnostics"><span>Технические детали</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="d2-diagnostics-disclosure-body">
          <dl className="d2-diagnostics-facts">
            <div><dt>Роль в комнате</dt><dd>{server.role ?? 'Участник'}</dd></div>
            <div><dt>Координатор</dt><dd>{server.hostName}</dd></div>
            <div><dt>Подключение чата</dt><dd>{connectionLabel} · WebSocket</dd></div>
            <div><dt>Публичный адрес</dt><dd>{publicUrl || 'Не задан'}</dd></div>
            <div><dt>Конфигурация голоса</dt><dd>{iceLabel}</dd></div>
            <div><dt>Источник ICE</dt><dd>{iceFlags.iceSource || 'Не определён'}</dd></div>
            <div><dt>Последний снимок голоса</dt><dd>{lastVoiceReport ? new Date(lastVoiceReport.at).toLocaleString('ru-RU') : 'Ещё не собран'}</dd></div>
          </dl>
          {lastVoiceReport && <pre className="d2-diagnostics-nat-summary">{lastVoiceReport.summary}</pre>}
          <p>Наличие конфигурации TURN не подтверждает передачу звука. Снимок голоса относится к моменту его сбора.</p>
        </div>
      </details>

      <details className="d2-diagnostics-card d2-diagnostics-disclosure" data-testid="section-debug-logs">
        <summary><span>Журнал событий <span className="d2-diagnostics-count">{logs.length}</span></span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="d2-diagnostics-disclosure-body">
          <div className="d2-diagnostics-log-heading"><p>Последние 120 записей. В файл отчёта попадёт весь доступный журнал.</p><Button tone="quiet" onClick={() => { clearDebugLogs(); showResult('Журнал событий очищен.'); }} data-testid="button-clear-debug-log"><Trash2 size={15} />Очистить</Button></div>
          <pre className="d2-diagnostics-log" data-testid="pre-debug-log">{logs.length === 0 ? 'В журнале пока нет событий.' : logs.slice(-120).map(entry => `${entry.ts.slice(11, 19)} ${entry.level[0]} [${entry.scope}] ${entry.message}`).join('\n')}</pre>
        </div>
      </details>

      <footer className="d2-diagnostics-footer"><span>Обратная связь: <a href="mailto:maximrus96@gmail.com">maximrus96@gmail.com</a></span><StudioCredit /></footer>
    </main>
  </div>;
}
