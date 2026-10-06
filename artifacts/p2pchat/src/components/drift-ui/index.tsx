import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button as BaseButton } from '@/components/ui/button';
import { Input as BaseInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function Button({ tone = 'secondary', busy = false, children, className, disabled, ...props }: ComponentProps<'button'> & { tone?: 'primary' | 'secondary' | 'quiet'; busy?: boolean }) {
  return <BaseButton {...props} disabled={disabled || busy} aria-busy={busy} variant="ghost" className={cn('d2-button', `d2-button-${tone}`, className)}>{busy && <LoaderCircle className="d2-spinner" aria-hidden="true" />}{children}</BaseButton>;
}
export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(({ className, ...props }, ref) => <BaseInput {...props} ref={ref} className={cn('d2-input', className)} />);
Input.displayName = 'DriftInput';
export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return <div className="d2-field"><label htmlFor={id}>{label}</label>{children}{hint && <p id={`${id}-hint`} className="d2-hint">{hint}</p>}</div>;
}
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('d2-panel', className)}>{children}</section>;
}
