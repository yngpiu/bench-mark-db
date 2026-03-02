"use client";

interface SparkLineProps {
  data: number[];
  color?: string;
  height?: number;
  showDots?: boolean;
}

export function SparkLine({
  data,
  color = "rgb(59,130,246)",
  height = 50,
  showDots = true,
}: SparkLineProps) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 400;
  const padX = 8;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = data.map((v, i) => ({
    x: padX + (i / Math.max(data.length - 1, 1)) * innerW,
    y: padY + ((max - v) / range) * innerH,
    v,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  // Fill area under line
  const fillD =
    `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${padX} ${(padY + innerH).toFixed(1)} Z`;

  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  const avgY = padY + ((max - avg) / range) * innerH;

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {/* Avg reference line */}
        <line
          x1={padX}
          y1={avgY}
          x2={width - padX}
          y2={avgY}
          stroke={color}
          strokeWidth={0.8}
          strokeDasharray="4 3"
          opacity={0.4}
        />
        {/* Fill */}
        <path d={fillD} fill={color} opacity={0.08} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} />
        {/* Dots */}
        {showDots &&
          points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} opacity={0.85} />
          ))}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-1">
        <span>Min: {min.toFixed(2)} ms</span>
        <span>TB: {avg.toFixed(2)} ms</span>
        <span>Max: {max.toFixed(2)} ms</span>
      </div>
    </div>
  );
}
