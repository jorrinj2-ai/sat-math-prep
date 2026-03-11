"use client";

// ═══════════════════════════════════════════════════════════════
//  SVG Chart Components for SAT Math Questions
//  Renders bar charts, line charts, scatter plots, and tables
//  directly inside questions — no external images needed
// ═══════════════════════════════════════════════════════════════

const COLORS = {
  bg: "#0c1421",
  grid: "#1a2744",
  axis: "#5a7a9e",
  text: "#8ba4c4",
  bar: "#f59e0b",
  bar2: "#818cf8",
  line: "#22c55e",
  dot: "#f59e0b",
  dot2: "#ef4444",
};

// ── BAR CHART ────────────────────────────────────────────────
export function BarChart({ data, title, xLabel, yLabel, width = 320, height = 200 }) {
  const pad = { top: 30, right: 20, bottom: 50, left: 45 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value)) * 1.15;
  const barW = Math.min(36, (w / data.length) * 0.6);
  const gap = w / data.length;

  return (
    <svg width={width} height={height} style={{ display: "block", margin: "12px auto", background: "#111c2e", borderRadius: 10, border: "1px solid #1a2744" }}>
      {/* Title */}
      {title && <text x={width / 2} y={18} textAnchor="middle" fill={COLORS.text} fontSize={12} fontWeight={600} fontFamily="'Outfit',sans-serif">{title}</text>}
      {/* Y axis label */}
      {yLabel && <text x={12} y={pad.top + h / 2} textAnchor="middle" fill={COLORS.axis} fontSize={10} fontFamily="'Outfit',sans-serif" transform={`rotate(-90,12,${pad.top + h / 2})`}>{yLabel}</text>}
      {/* X axis label */}
      {xLabel && <text x={pad.left + w / 2} y={height - 6} textAnchor="middle" fill={COLORS.axis} fontSize={10} fontFamily="'Outfit',sans-serif">{xLabel}</text>}
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line x1={pad.left} y1={pad.top + h * (1 - f)} x2={pad.left + w} y2={pad.top + h * (1 - f)} stroke={COLORS.grid} strokeWidth={1} />
          <text x={pad.left - 6} y={pad.top + h * (1 - f) + 4} textAnchor="end" fill={COLORS.axis} fontSize={9} fontFamily="'Outfit',sans-serif">{Math.round(max * f)}</text>
        </g>
      ))}
      {/* Axes */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + h} stroke={COLORS.axis} strokeWidth={1} />
      <line x1={pad.left} y1={pad.top + h} x2={pad.left + w} y2={pad.top + h} stroke={COLORS.axis} strokeWidth={1} />
      {/* Bars */}
      {data.map((d, i) => {
        const bh = (d.value / max) * h;
        const x = pad.left + gap * i + (gap - barW) / 2;
        const y = pad.top + h - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} fill={d.color || COLORS.bar} rx={3} opacity={0.85} />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill={COLORS.text} fontSize={9} fontWeight={600} fontFamily="'Outfit',sans-serif">{d.value}</text>
            <text x={pad.left + gap * i + gap / 2} y={pad.top + h + 14} textAnchor="middle" fill={COLORS.text} fontSize={9} fontFamily="'Outfit',sans-serif">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── LINE CHART ───────────────────────────────────────────────
export function LineChart({ data, title, xLabel, yLabel, width = 320, height = 200, showDots = true }) {
  const pad = { top: 30, right: 20, bottom: 50, left: 45 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(0, Math.min(...ys)), maxY = Math.max(...ys) * 1.1;

  const px = (v) => pad.left + ((v - minX) / (maxX - minX || 1)) * w;
  const py = (v) => pad.top + h - ((v - minY) / (maxY - minY || 1)) * h;

  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${px(d.x)},${py(d.y)}`).join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block", margin: "12px auto", background: "#111c2e", borderRadius: 10, border: "1px solid #1a2744" }}>
      {title && <text x={width / 2} y={18} textAnchor="middle" fill={COLORS.text} fontSize={12} fontWeight={600} fontFamily="'Outfit',sans-serif">{title}</text>}
      {yLabel && <text x={12} y={pad.top + h / 2} textAnchor="middle" fill={COLORS.axis} fontSize={10} fontFamily="'Outfit',sans-serif" transform={`rotate(-90,12,${pad.top + h / 2})`}>{yLabel}</text>}
      {xLabel && <text x={pad.left + w / 2} y={height - 6} textAnchor="middle" fill={COLORS.axis} fontSize={10} fontFamily="'Outfit',sans-serif">{xLabel}</text>}
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line x1={pad.left} y1={pad.top + h * (1 - f)} x2={pad.left + w} y2={pad.top + h * (1 - f)} stroke={COLORS.grid} strokeWidth={1} />
          <text x={pad.left - 6} y={pad.top + h * (1 - f) + 4} textAnchor="end" fill={COLORS.axis} fontSize={9} fontFamily="'Outfit',sans-serif">{Math.round(minY + (maxY - minY) * f)}</text>
        </g>
      ))}
      {/* X labels */}
      {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0).map((d, i) => (
        <text key={i} x={px(d.x)} y={pad.top + h + 14} textAnchor="middle" fill={COLORS.text} fontSize={9} fontFamily="'Outfit',sans-serif">{d.label || d.x}</text>
      ))}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + h} stroke={COLORS.axis} strokeWidth={1} />
      <line x1={pad.left} y1={pad.top + h} x2={pad.left + w} y2={pad.top + h} stroke={COLORS.axis} strokeWidth={1} />
      {/* Line */}
      <path d={path} fill="none" stroke={COLORS.line} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {showDots && data.map((d, i) => (
        <circle key={i} cx={px(d.x)} cy={py(d.y)} r={3.5} fill={COLORS.dot} stroke="#111c2e" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

// ── SCATTER PLOT ──────────────────────────────────────────────
export function ScatterPlot({ data, title, xLabel, yLabel, width = 320, height = 200, trendLine }) {
  const pad = { top: 30, right: 20, bottom: 50, left: 45 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(0, Math.min(...xs)), maxX = Math.max(...xs) * 1.1;
  const minY = Math.min(0, Math.min(...ys)), maxY = Math.max(...ys) * 1.1;

  const px = (v) => pad.left + ((v - minX) / (maxX - minX || 1)) * w;
  const py = (v) => pad.top + h - ((v - minY) / (maxY - minY || 1)) * h;

  return (
    <svg width={width} height={height} style={{ display: "block", margin: "12px auto", background: "#111c2e", borderRadius: 10, border: "1px solid #1a2744" }}>
      {title && <text x={width / 2} y={18} textAnchor="middle" fill={COLORS.text} fontSize={12} fontWeight={600} fontFamily="'Outfit',sans-serif">{title}</text>}
      {yLabel && <text x={12} y={pad.top + h / 2} textAnchor="middle" fill={COLORS.axis} fontSize={10} fontFamily="'Outfit',sans-serif" transform={`rotate(-90,12,${pad.top + h / 2})`}>{yLabel}</text>}
      {xLabel && <text x={pad.left + w / 2} y={height - 6} textAnchor="middle" fill={COLORS.axis} fontSize={10} fontFamily="'Outfit',sans-serif">{xLabel}</text>}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line x1={pad.left} y1={pad.top + h * (1 - f)} x2={pad.left + w} y2={pad.top + h * (1 - f)} stroke={COLORS.grid} strokeWidth={1} />
          <text x={pad.left - 6} y={pad.top + h * (1 - f) + 4} textAnchor="end" fill={COLORS.axis} fontSize={9} fontFamily="'Outfit',sans-serif">{Math.round(minY + (maxY - minY) * f)}</text>
        </g>
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <text key={`x${i}`} x={pad.left + w * f} y={pad.top + h + 14} textAnchor="middle" fill={COLORS.axis} fontSize={9} fontFamily="'Outfit',sans-serif">{Math.round(minX + (maxX - minX) * f)}</text>
      ))}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + h} stroke={COLORS.axis} strokeWidth={1} />
      <line x1={pad.left} y1={pad.top + h} x2={pad.left + w} y2={pad.top + h} stroke={COLORS.axis} strokeWidth={1} />
      {/* Trend line */}
      {trendLine && <line x1={px(trendLine.x1)} y1={py(trendLine.y1)} x2={px(trendLine.x2)} y2={py(trendLine.y2)} stroke={COLORS.line} strokeWidth={1.5} strokeDasharray="6,3" opacity={0.7} />}
      {/* Points */}
      {data.map((d, i) => (
        <circle key={i} cx={px(d.x)} cy={py(d.y)} r={4} fill={d.color || COLORS.dot} stroke="#111c2e" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

// ── DATA TABLE ───────────────────────────────────────────────
export function DataTable({ headers, rows, title }) {
  return (
    <div style={{ margin: "12px auto", maxWidth: 340 }}>
      {title && <p style={{ fontSize: 11, fontWeight: 600, color: "#8ba4c4", textAlign: "center", marginBottom: 6, fontFamily: "'Outfit',sans-serif" }}>{title}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'Outfit',sans-serif", background: "#111c2e", borderRadius: 8, overflow: "hidden", border: "1px solid #1a2744" }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "8px 10px", textAlign: "center", background: "#162033", color: "#8ba4c4", fontWeight: 600, borderBottom: "1px solid #1a2744" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "6px 10px", textAlign: "center", color: "#e2e8f0", borderBottom: ri < rows.length - 1 ? "1px solid #1a274422" : "none" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── CHART RENDERER (dispatches to correct component) ─────────
export default function QuestionChart({ chart }) {
  if (!chart) return null;

  switch (chart.type) {
    case "bar":
      return <BarChart data={chart.data} title={chart.title} xLabel={chart.xLabel} yLabel={chart.yLabel} width={chart.width} height={chart.height} />;
    case "line":
      return <LineChart data={chart.data} title={chart.title} xLabel={chart.xLabel} yLabel={chart.yLabel} width={chart.width} height={chart.height} />;
    case "scatter":
      return <ScatterPlot data={chart.data} title={chart.title} xLabel={chart.xLabel} yLabel={chart.yLabel} trendLine={chart.trendLine} width={chart.width} height={chart.height} />;
    case "table":
      return <DataTable headers={chart.headers} rows={chart.rows} title={chart.title} />;
    default:
      return null;
  }
}
