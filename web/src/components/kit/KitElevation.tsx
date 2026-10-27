import type { CalculatorResult } from '@/lib/kitCalculator'

const SCALE = 44
const MARGIN = { top: 52, right: 56, bottom: 46, left: 72 }

export function KitElevation({ result }: { result: CalculatorResult }) {
  const { bays, levels } = result
  const width = bays * 1.5 * SCALE
  const height = levels * LEVEL * SCALE

  const viewWidth = width + MARGIN.left + MARGIN.right
  const viewHeight = height + MARGIN.top + MARGIN.bottom

  const originX = MARGIN.left
  const originY = MARGIN.top + height

  const x = (meter: number) => originX + meter * SCALE
  const y = (meter: number) => originY - meter * SCALE

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      role="img"
      aria-label={`Elevação da torre: ${levels} níveis por ${bays} vãos`}
      className="h-full w-full"
    >
      <rect x="0" y="0" width={viewWidth} height={viewHeight} fill="transparent" />

      <g stroke="var(--rule)" strokeWidth="1">
        <line x1={MARGIN.left - 24} y1={originY} x2={viewWidth - MARGIN.right + 16} y2={originY} strokeWidth="1.5" stroke="var(--foreground)" strokeOpacity="0.7" />
        {Array.from({ length: Math.round(width / 8) + 6 }).map((_, index) => (
          <line
            key={index}
            x1={MARGIN.left - 24 + index * 8}
            y1={originY}
            x2={MARGIN.left - 30 + index * 8}
            y2={originY + 7}
            stroke="var(--foreground)"
            strokeOpacity="0.35"
          />
        ))}
      </g>

      <g>
        {Array.from({ length: bays }).map((_, bay) => {
          const left = x(bay * 1.5)
          const right = x((bay + 1) * 1.5)
          const centerPanelLeft = left + 6
          const centerPanelRight = right - 6

          return (
            <g key={bay}>
              <rect
                x={centerPanelLeft}
                y={y(levels * LEVEL) + 6}
                width={centerPanelRight - centerPanelLeft}
                height={height - 12}
                fill="color-mix(in oklab, var(--status-active) 12%, transparent)"
                stroke="color-mix(in oklab, var(--status-active) 45%, transparent)"
                strokeWidth="1"
              />

              {Array.from({ length: levels }).map((_, level) => {
                const bottom = y(level * LEVEL)
                const top = y((level + 1) * LEVEL)
                const reversed = (bay + level) % 2 === 1
                return (
                  <g key={level}>
                    <line
                      x1={reversed ? centerPanelRight : centerPanelLeft}
                      y1={top + 6}
                      x2={reversed ? centerPanelLeft : centerPanelRight}
                      y2={bottom - 6}
                      stroke="var(--primary)"
                      strokeWidth="2"
                    />
                    <rect
                      x={centerPanelLeft}
                      y={bottom - 5}
                      width={centerPanelRight - centerPanelLeft}
                      height="6"
                      fill="color-mix(in oklab, var(--muted-foreground) 55%, transparent)"
                    />
                  </g>
                )
              })}

              {[left, right].map((postX, index) => (
                <g key={index}>
                  <line
                    x1={postX}
                    y1={y(levels * LEVEL)}
                    x2={postX}
                    y2={originY}
                    stroke="var(--foreground)"
                    strokeOpacity="0.75"
                    strokeWidth="2.5"
                  />
                  {result.lines.some((line) => line.role === 'base') ? (
                    <path
                      d={`M ${postX - 12} ${originY + 2} L ${postX + 12} ${originY + 2} L ${postX + 5} ${originY - 10} L ${postX - 5} ${originY - 10} Z`}
                      fill="var(--foreground)"
                      fillOpacity="0.7"
                    />
                  ) : (
                    <circle cx={postX} cy={originY + 6} r="7" fill="none" stroke="var(--status-late)" strokeWidth="2.5" />
                  )}
                </g>
              ))}
            </g>
          )
        })}
      </g>

      <g>
        {Array.from({ length: levels }).map((_, level) => (
          <text
            key={level}
            x={originX - 16}
            y={y(level * LEVEL) - LEVEL * SCALE * 0.5 + 4}
            textAnchor="end"
            className="label-caps"
            fontSize="9"
            fill="var(--muted-foreground)"
          >
            N{level + 1}
          </text>
        ))}
      </g>

      <g stroke="var(--foreground)" strokeOpacity="0.5" strokeWidth="1">
        <line x1={originX} y1={y(levels * LEVEL) - 26} x2={x(result.facadeLength)} y2={y(levels * LEVEL) - 26} />
        <line x1={originX} y1={y(levels * LEVEL) - 32} x2={originX} y2={y(levels * LEVEL) - 20} />
        <line x1={x(result.facadeLength)} y1={y(levels * LEVEL) - 32} x2={x(result.facadeLength)} y2={y(levels * LEVEL) - 20} />

        <line x1={MARGIN.left - 40} y1={originY} x2={MARGIN.left - 40} y2={y(levels * LEVEL)} />
        <line x1={MARGIN.left - 46} y1={originY} x2={MARGIN.left - 34} y2={originY} />
        <line x1={MARGIN.left - 46} y1={y(levels * LEVEL)} x2={MARGIN.left - 34} y2={y(levels * LEVEL)} />
      </g>

      <text
        x={(originX + x(result.facadeLength)) / 2}
        y={y(levels * LEVEL) - 34}
        textAnchor="middle"
        className="metric"
        fontSize="11"
        fill="var(--foreground)"
      >
        {result.facadeLength.toFixed(2)} m de fachada
      </text>
      <text
        x={MARGIN.left - 50}
        y={y(levels * LEVEL) + height / 2}
        textAnchor="middle"
        className="metric"
        fontSize="11"
        fill="var(--foreground)"
        transform={`rotate(-90 ${MARGIN.left - 50} ${y(levels * LEVEL) + height / 2})`}
      >
        {result.towerHeight.toFixed(2)} m
      </text>
    </svg>
  )
}

const LEVEL = 1.5
