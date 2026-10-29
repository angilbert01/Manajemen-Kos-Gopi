import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, PolarAngleAxis, RadialBar, RadialBarChart, XAxis, YAxis } from 'recharts';
import { rupiah } from './api';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { prefersReducedMotion, useCountUp } from '@/lib/motion';
import type { BucketBulan } from '@/lib/tren';

// Satu aksen (--chart-1) untuk nilai yang dibahas, abu-abu (--chart-muted) untuk sisa/kosong.
// Setiap grafik tetap disertai angka teks agar warna bukan satu-satunya penanda.

const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function HunianMeter({ terisi, total }: { terisi: number; total: number }) {
  const pct = pctOf(terisi, total);
  const config = { hunian: { label: 'Hunian', color: 'var(--chart-1)' } } satisfies ChartConfig;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-full max-w-[220px]">
        <ChartContainer config={config} className="aspect-square w-full">
          <RadialBarChart data={[{ name: 'hunian', value: pct, fill: 'var(--color-hunian)' }]} innerRadius="72%" outerRadius="100%" startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
            <RadialBar dataKey="value" background cornerRadius={8} isAnimationActive={!prefersReducedMotion()} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel formatter={() => `${terisi} terisi dari ${total} kamar (${pct}%)`} />}
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{Math.round(useCountUp(pct))}%</span>
          <span className="text-xs text-muted-foreground">terisi</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{terisi}</span> terisi ·{' '}
        <span className="font-medium text-foreground">{Math.max(0, total - terisi)}</span> kosong dari {total} kamar
      </p>
    </div>
  );
}

export function TrenMasukChart({ data }: { data: BucketBulan[] }) {
  const total = data.reduce((s, b) => s + b.jumlah, 0);
  const config = { jumlah: { label: 'Penghuni masuk', color: 'var(--chart-1)' } } satisfies ChartConfig;
  return (
    <div className="relative">
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="isiTren" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-jumlah)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-jumlah)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} domain={[0, (max: number) => Math.max(2, max)]} />
          <ChartTooltip cursor content={<ChartTooltipContent indicator="line" />} />
          <Area
            dataKey="jumlah"
            type="monotone"
            stroke="var(--color-jumlah)"
            strokeWidth={2}
            fill="url(#isiTren)"
            dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
            activeDot={{ r: 5 }}
            isAnimationActive={!prefersReducedMotion()}
          />
        </AreaChart>
      </ChartContainer>
      {total === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Belum ada penghuni masuk dalam 6 bulan terakhir.
        </p>
      )}
    </div>
  );
}

export function OkupansiTipeChart({ stats }: { stats: { tipe: string; total: number; occ: number }[] }) {
  const data = stats.map((t) => ({ tipe: `Tipe ${t.tipe}`, terisi: t.occ, kosong: t.total - t.occ }));
  const config = {
    terisi: { label: 'Terisi', color: 'var(--chart-1)' },
    kosong: { label: 'Kosong', color: 'var(--chart-muted)' },
  } satisfies ChartConfig;
  const animate = !prefersReducedMotion();
  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-1" aria-hidden /> Terisi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-muted" aria-hidden /> Kosong
        </span>
      </div>
      <ChartContainer config={config} className="aspect-auto h-40 w-full">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="tipe" tickLine={false} axisLine={false} width={96} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="terisi" stackId="a" fill="var(--color-terisi)" stroke="var(--card)" strokeWidth={2} radius={[4, 0, 0, 4]} isAnimationActive={animate}>
            <LabelList dataKey="terisi" position="center" className="fill-white text-xs font-medium" formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')} />
          </Bar>
          <Bar dataKey="kosong" stackId="a" fill="var(--color-kosong)" stroke="var(--card)" strokeWidth={2} radius={[0, 4, 4, 0]} isAnimationActive={animate}>
            <LabelList dataKey="kosong" position="center" className="fill-foreground text-xs font-medium" formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function SewaMeter({ aktif, potensi }: { aktif: number; potensi: number }) {
  const pct = pctOf(aktif, potensi);
  const shown = useCountUp(pct);
  return (
    <div className="space-y-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Realisasi sewa terhadap potensi">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Sewa aktif vs potensi</span>
        <span className="font-semibold tabular-nums">{Math.round(shown)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-chart-muted">
        <div className="h-full rounded-full bg-chart-1" style={{ width: `${shown}%` }} />
      </div>
      <div className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span>
          <span className="font-medium text-foreground">{rupiah(aktif)}</span> aktif
        </span>
        <span>potensi {rupiah(potensi)}</span>
      </div>
    </div>
  );
}
