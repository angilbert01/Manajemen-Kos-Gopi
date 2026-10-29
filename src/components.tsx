import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useCountUp, useTilt } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Kelas <select> native yang meniru tampilan Input shadcn (value "" tetap didukung, picker native di HP). */
export const selectClass =
  'border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive';

/** Kartu statistik. `value` angka akan beranimasi naik (count-up) lalu ditampilkan lewat `format`. */
export function Stat({
  title,
  value,
  format = (n) => n,
  hint,
  progress = 75,
  progressLabel,
}: {
  title: string;
  value: ReactNode;
  format?: (n: number) => ReactNode;
  hint: ReactNode;
  progress?: number;
  progressLabel?: ReactNode;
}) {
  const pct = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0;
  const shownPct = Math.round(useCountUp(pct));
  const counted = Math.round(useCountUp(typeof value === 'number' ? value : 0));
  const tilt = useTilt<HTMLDivElement>();
  return (
    <Card {...tilt} className="tilt gap-3 py-5">
      <CardContent className="space-y-3 px-5">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{typeof value === 'number' ? format(counted) : value}</div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Progress value={shownPct} className="h-1.5" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progressLabel ?? 'Bulan ini'}</span>
          <span className="tabular-nums">{shownPct}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function IconWidget({
  Icon,
  title,
  subtitle,
  onClick,
}: {
  Icon: LucideIcon;
  title: ReactNode;
  subtitle: ReactNode;
  onClick?: () => void;
}) {
  const tiltButton = useTilt<HTMLButtonElement>();
  const tiltDiv = useTilt<HTMLDivElement>();
  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
      </span>
    </>
  );
  const cls = 'tilt flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm';
  return onClick ? (
    <button
      type="button"
      {...tiltButton}
      onClick={onClick}
      className={cn(cls, 'hover:bg-accent active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50')}
    >
      {body}
    </button>
  ) : (
    <div {...tiltDiv} className={cls}>{body}</div>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <Label className="grid gap-1.5 font-normal">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-sm text-destructive" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </Label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Modal dibuka tanpa DialogTrigger, jadi kembalikan fokus manual ke elemen pemicu saat ditutup.
  const returnTo = useRef(document.activeElement as HTMLElement | null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnTo.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function StatusPill({ status }: { status: 'Kosong' | 'Terisi' }) {
  return status === 'Kosong' ? (
    <Badge variant="outline" className="gap-1.5">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      Kosong
    </Badge>
  ) : (
    <Badge variant="secondary">Terisi</Badge>
  );
}
