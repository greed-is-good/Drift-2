import { Mic, MicOff, Headphones, VolumeX, Monitor, MonitorOff, PhoneOff, SlidersHorizontal, Signal } from 'lucide-react';
import type { VoiceQualitySnapshot } from '@/lib/p2p-client';
import type { VoiceTalkMode } from '@/lib/voice-settings';
import { Button } from './index';

export type VoiceControlsProps = {
  name?: string; muted?: boolean; deafened?: boolean; sharingScreen?: boolean;
  onMute: () => void; onDeafen: () => void; onLeaveVoice?: () => void; onToggleScreenShare?: () => void;
  voiceQuality?: VoiceQualitySnapshot | null; voiceTalkMode?: VoiceTalkMode; pttHeld?: boolean; pttKeyLabel?: string;
  micVolume?: number; onMicVolume?: (value: number) => void;
  noiseSuppression?: boolean; echoCancellation?: boolean; enhancedNoise?: boolean;
  onToggleNoise?: () => void; onToggleEcho?: () => void; onToggleEnhancedNoise?: () => void;
};
export function VoiceControls(props: VoiceControlsProps) {
  const { name, muted, deafened, sharingScreen, onMute, onDeafen, onLeaveVoice, onToggleScreenShare, voiceQuality, voiceTalkMode, pttHeld, pttKeyLabel, micVolume, onMicVolume } = props;
  return <section className="d2-voice-controls" aria-label="Управление голосом" data-testid="channel-voice-controls">
    <div className="d2-voice-heading"><Signal size={16} /><div><strong>{name || 'Голосовой канал'}</strong><p>{deafened ? 'Звук отключён' : muted ? 'Микрофон выключен' : voiceTalkMode === 'ptt' && !pttHeld ? 'Говорить по нажатию' : 'Микрофон включён'}</p></div></div>
    {voiceQuality && <p className="d2-voice-quality" data-testid="voice-quality-chip">{voiceQuality.level === 'ok' ? 'Хорошая связь' : voiceQuality.level === 'fair' ? 'Нестабильная связь' : 'Плохая связь'}{voiceQuality.rttMs != null && <span>{voiceQuality.rttMs} мс</span>}</p>}
    {voiceTalkMode === 'ptt' && <p className="d2-hint" data-testid="ptt-indicator">{pttHeld ? 'Говорите' : `Для разговора удерживайте ${pttKeyLabel || 'клавишу'}`}</p>}
    <div className="d2-voice-buttons">
      <Button tone="quiet" aria-pressed={Boolean(muted)} aria-label={muted ? 'Включить микрофон' : 'Выключить микрофон'} title={muted ? 'Включить микрофон' : 'Выключить микрофон'} onClick={onMute} data-testid="button-toggle-mute">{muted ? <MicOff /> : <Mic />}</Button>
      <Button tone="quiet" aria-pressed={Boolean(deafened)} aria-label={deafened ? 'Включить звук' : 'Отключить звук'} title={deafened ? 'Включить звук' : 'Отключить звук'} onClick={onDeafen} data-testid="button-toggle-deafen">{deafened ? <VolumeX /> : <Headphones />}</Button>
      {onLeaveVoice && <Button tone="quiet" className="d2-voice-leave" aria-label="Выйти из голосового канала" title="Выйти из голосового канала" onClick={onLeaveVoice} data-testid="button-leave-voice-channel"><PhoneOff /></Button>}
    </div>
    {onToggleScreenShare && <Button tone="secondary" className="d2-voice-share" aria-pressed={Boolean(sharingScreen)} onClick={onToggleScreenShare} data-testid="button-screen-share-footer">{sharingScreen ? <MonitorOff /> : <Monitor />}{sharingScreen ? 'Остановить показ' : 'Показать экран'}</Button>}
    <details className="d2-voice-options"><summary><SlidersHorizontal size={13} />Настройки звука</summary>
      {onMicVolume && micVolume !== undefined && <label className="d2-voice-slider">Громкость микрофона <output>{Math.round(micVolume * 100)}%</output><input type="range" min={0} max={100} value={Math.round(micVolume * 100)} onChange={event => onMicVolume(Number(event.target.value) / 100)} data-testid="input-mic-volume" /></label>}
      {([
        ['Шумоподавление', props.noiseSuppression, props.onToggleNoise, 'button-toggle-noise'],
        ['Подавление эха', props.echoCancellation, props.onToggleEcho, 'button-toggle-echo'],
        ['Дополнительный фильтр', props.enhancedNoise, props.onToggleEnhancedNoise, 'button-toggle-enhanced-noise'],
      ] as const).map(([label, enabled, onToggle, testId]) => onToggle && <label key={testId} className="d2-voice-option"><span>{label}</span><input type="checkbox" checked={Boolean(enabled)} onChange={onToggle} data-testid={testId} /></label>)}
    </details>
  </section>;
}
