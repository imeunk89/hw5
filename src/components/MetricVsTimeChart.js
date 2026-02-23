import { useState, useRef, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const LINE_COLOR = '#818cf8';
const GRID_COLOR = 'rgba(255,255,255,0.07)';

function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const formatted = typeof val === 'number' && val >= 1000
    ? val.toLocaleString()
    : String(val);
  return (
    <div style={{
      background: 'rgba(15, 15, 35, 0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: '0.65rem 0.9rem',
      fontSize: '0.82rem',
      fontFamily: 'Inter, sans-serif',
      color: '#e2e8f0',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <p style={{ margin: '0 0 0.3rem', fontWeight: 600, color: '#fff' }}>{label}</p>
      <p style={{ margin: 0, color: LINE_COLOR }}>{metric}: <strong>{formatted}</strong></p>
    </div>
  );
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function MetricVsTimeChart({ data, metric = 'view_count' }) {
  const [modalOpen, setModalOpen] = useState(false);
  const chartRef = useRef(null);

  const metricLabel = metric.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const exportSvg = useCallback(() => {
    const el = chartRef.current;
    if (!el) return;
    const svg = el.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const str = serializer.serializeToString(svg);
    const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, `metric-vs-time-${metric}.svg`);
  }, [metric]);

  const exportPng = useCallback(() => {
    const el = chartRef.current;
    if (!el) return;
    const svg = el.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    let str = serializer.serializeToString(svg);
    const w = svg.getAttribute?.('width') ? parseInt(svg.getAttribute('width'), 10) : svg.getBBox?.()?.width || 800;
    const h = svg.getAttribute?.('height') ? parseInt(svg.getAttribute('height'), 10) : svg.getBBox?.()?.height || 450;
    if (!str.includes('width=')) {
      str = str.replace('<svg', `<svg width="${w}" height="${h}"`);
    }
    const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f0f23';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) downloadBlob(pngBlob, `metric-vs-time-${metric}.png`);
      }, 'image/png');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [metric]);

  if (!data?.length) return null;

  const chartContent = (height, ref) => (
    <div ref={ref} className="metric-vs-time-chart-inner">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'Inter,sans-serif' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'Inter,sans-serif' }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v)}
          />
          <Tooltip content={<CustomTooltip metric={metricLabel} />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={LINE_COLOR}
            strokeWidth={2}
            dot={{ fill: LINE_COLOR, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, fill: LINE_COLOR, stroke: '#fff', strokeWidth: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <>
      <div
        className="metric-vs-time-chart-wrap"
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setModalOpen(true)}
        aria-label="Click to enlarge chart"
      >
        <p className="metric-vs-time-chart-label">{metricLabel} over time</p>
        {chartContent(220, null)}
      </div>

      {modalOpen && (
        <div className="metric-vs-time-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="metric-vs-time-modal" onClick={(e) => e.stopPropagation()}>
            <div className="metric-vs-time-modal-header">
              <h3>{metricLabel} over time</h3>
              <button className="metric-vs-time-modal-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="metric-vs-time-modal-chart" ref={chartRef}>
              {chartContent(400, chartRef)}
            </div>
            <div className="metric-vs-time-modal-actions">
              <button type="button" onClick={exportPng}>Download PNG</button>
              <button type="button" onClick={exportSvg}>Download SVG</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
