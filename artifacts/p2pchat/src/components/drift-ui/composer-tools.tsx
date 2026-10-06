import { useState } from 'react';
import { AlarmClock, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FUN_SOUNDS, type FunSoundId } from '@/lib/fun-sounds';
import { formatAlarmCooldown } from '@/lib/agent-alarm-cooldown';
import { Button } from './index';

export function ComposerTools({ onPlaySound, onAlarm, cooldown = 0 }: { onPlaySound?: (id: FunSoundId) => void; onAlarm?: () => void; cooldown?: number }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button type="button" className="icon-btn shrink-0" aria-label="Звуки и развлечения" aria-expanded={open} data-testid="button-soundboard"><Sparkles size={18} /></button></PopoverTrigger><PopoverContent side="top" align="start" className="d2-composer-tools">
    <h2>Звуки и развлечения</h2>
    {onAlarm && <Button tone="secondary" disabled={cooldown > 0} onClick={() => { onAlarm(); setOpen(false); }} data-testid="button-agent-alarm"><AlarmClock size={16} />{cooldown > 0 ? `Будильник через ${formatAlarmCooldown(cooldown * 1000)}` : 'Будильник для всех'}</Button>}
    {onPlaySound && <div className="d2-sound-grid" data-testid="soundboard-panel">{FUN_SOUNDS.map(sound => <button key={sound.id} type="button" onClick={() => { onPlaySound(sound.id); setOpen(false); }} data-testid={`button-sfx-${sound.id}`}><span aria-hidden="true">{sound.emoji}</span><span>{sound.label}</span></button>)}</div>}
  </PopoverContent></Popover>;
}
