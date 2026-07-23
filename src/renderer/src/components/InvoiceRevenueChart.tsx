import { useState } from 'react'
import type { InvoiceMonthlyPoint } from '../../../shared/types'

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short' })
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

const CHART_HEIGHT = 140
const BAR_GAP = 6

export default function InvoiceRevenueChart({
  data
}: {
  data: InvoiceMonthlyPoint[]
}): React.JSX.Element {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.invoicedCents), 1)
  const width = 640
  const barWidth = (width - BAR_GAP * (data.length - 1)) / data.length

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT + 24}`}
        className="w-full"
        style={{ height: CHART_HEIGHT + 24 }}
      >
        <line
          x1={0}
          y1={CHART_HEIGHT}
          x2={width}
          y2={CHART_HEIGHT}
          stroke="#262626"
          strokeWidth={1}
        />
        {data.map((point, i) => {
          const x = i * (barWidth + BAR_GAP)
          const h = point.invoicedCents > 0 ? Math.max((point.invoicedCents / max) * (CHART_HEIGHT - 8), 3) : 0
          const isHovered = hovered === i
          return (
            <g
              key={point.month}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h2) => (h2 === i ? null : h2))}
            >
              {/* Invisible full-height hit target so hover works even on empty months */}
              <rect x={x} y={0} width={barWidth} height={CHART_HEIGHT} fill="transparent" />
              {h > 0 && (
                <rect
                  x={x}
                  y={CHART_HEIGHT - h}
                  width={barWidth}
                  height={h}
                  rx={4}
                  fill={isHovered ? '#fb923c' : '#f97316'}
                />
              )}
              <text
                x={x + barWidth / 2}
                y={CHART_HEIGHT + 16}
                textAnchor="middle"
                fontSize={10}
                fill="#737373"
              >
                {monthLabel(point.month)}
              </text>
            </g>
          )
        })}
      </svg>
      {hovered !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${((hovered * (barWidth + BAR_GAP) + barWidth / 2) / width) * 100}%`,
            top: 0
          }}
        >
          <div className="font-semibold text-white">{formatCents(data[hovered].invoicedCents)}</div>
          <div className="text-neutral-400">
            {data[hovered].count} invoice{data[hovered].count === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  )
}
