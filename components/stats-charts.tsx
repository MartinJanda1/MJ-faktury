"use client";

import { formatStatsHours, formatStatsMoney, type StatsPoint } from "@/lib/invoice-stats";

const BRAND = "#00b5c8";
const PALETTE = ["#0d9488", "#0284c7", "#7c3aed", "#d97706", "#e11d48", "#16a34a", "#0891b2", "#4f46e5"];

/** SVG bar chart — pixel geometry, no CSS %/flex height traps. */
export function RevenueBars({ points, title }: { points: StatsPoint[]; title: string }) {
  const max = Math.max(1, ...points.map((point) => point.total));
  const width = 720;
  const height = 288;
  const padTop = 12;
  const padBottom = 28;
  const padX = 8;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;
  const gap = points.length > 8 ? 4 : 8;
  const barW = Math.max(6, (chartW - gap * Math.max(0, points.length - 1)) / Math.max(1, points.length));

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10 lg:col-span-3">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {points.length === 0 ? (
        <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">Žádná data</p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-72 w-full"
          role="img"
          aria-label={title}
          data-testid="revenue-bars"
        >
          {points.map((point, index) => {
            const barHeight =
              point.total > 0 ? Math.max(6, Math.round((point.total / max) * chartH)) : 2;
            const x = padX + index * (barW + gap);
            const y = padTop + chartH - barHeight;
            const tip = `${point.fullLabel || point.label}: ${formatStatsMoney(point.total)} Kč · ${point.count} faktur · ${formatStatsHours(point.hours)} h`;
            return (
              <g key={point.key}>
                <title>{tip}</title>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barHeight}
                  rx={2}
                  fill={BRAND}
                  data-total={point.total}
                  data-bar-height={barHeight}
                />
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: points.length > 10 ? 10 : 12 }}
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function CustomerDonut({ points }: { points: StatsPoint[] }) {
  const total = points.reduce((sum, point) => sum + point.total, 0);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const slices = points.map((point, index) => {
    const value = total > 0 ? point.total / total : 0;
    const length = value * circumference;
    const slice = {
      ...point,
      color: PALETTE[index % PALETTE.length],
      dash: `${length} ${circumference - length}`,
      offset,
      pct: Math.round(value * 100),
    };
    offset -= length;
    return slice;
  });

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10 lg:col-span-2">
      <h2 className="mb-4 text-sm font-semibold">Podíl odběratelů</h2>
      {points.length === 0 || total <= 0 ? (
        <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">Žádná data</p>
      ) : (
        <div className="grid h-72 content-center gap-4">
          <svg viewBox="0 0 160 160" className="mx-auto h-40 w-40" aria-label="Graf odběratelů">
            <g transform="translate(80 80) rotate(-90)">
              {slices.map((slice) => (
                <circle
                  key={slice.key}
                  r={radius}
                  cx="0"
                  cy="0"
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth="28"
                  strokeDasharray={slice.dash}
                  strokeDashoffset={slice.offset}
                >
                  <title>
                    {slice.label}: {formatStatsMoney(slice.total)} Kč ({slice.pct} %)
                  </title>
                </circle>
              ))}
            </g>
          </svg>
          <div className="max-h-24 space-y-1 overflow-y-auto text-xs">
            {slices.slice(0, 8).map((slice) => (
              <div key={slice.key} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} />
                  <span className="truncate">{slice.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{slice.pct} %</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
