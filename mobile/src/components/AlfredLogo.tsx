import Svg, { Path } from 'react-native-svg'
import { colors } from '../theme/mobile-theme'

type Props = {
  size?: number
  color?: string
}

export function AlfredLogo({ size = 24, color = colors.textPrimary }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Path
        fill={color}
        fillRule="evenodd"
        d="M111 52h34l66 152h-38l-13-32H96l-13 32H45L111 52Zm17 43-21 51h42l-21-51Z"
      />
    </Svg>
  )
}
