import { LOGO_PIECES } from './mark'

type LogoProps = { size: number }

export const Logo = ({ size }: LogoProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="doji">
    {LOGO_PIECES.map(({ x, y, width, height, rx, fill, opacity }) => (
      <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} rx={rx} fill={fill} fillOpacity={opacity} />
    ))}
  </svg>
)
