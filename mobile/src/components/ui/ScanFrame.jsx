import { View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

/**
 * ═════════════════════════════════════════════════════════════════
 * ScanFrame — the Roll Call signature on mobile.
 *
 * Four rounded corner brackets from the AttendX mark, sitting just
 * outside whatever they wrap. Use once per screen, on the thing the
 * screen is for: the live session you should mark, the scanner.
 *
 *   <ScanFrame color={t.colors.greenFill}>…</ScanFrame>
 * ═════════════════════════════════════════════════════════════════
 */
export default function ScanFrame({
  children,
  color,
  size   = 18,
  inset  = -7,
  radius = 10,
  width  = 2,
  style,
}) {
  const t = useTheme();
  const c = color ?? t.colors.brand;
  const corner = {
    position:    'absolute',
    width:       size,
    height:      size,
    borderColor: c,
  };
  return (
    <View style={[{ position: 'relative' }, style]}>
      {children}
      <View pointerEvents="none" style={[corner, { top: inset, left: inset,  borderTopWidth: width, borderLeftWidth: width,  borderTopLeftRadius: radius }]} />
      <View pointerEvents="none" style={[corner, { top: inset, right: inset, borderTopWidth: width, borderRightWidth: width, borderTopRightRadius: radius }]} />
      <View pointerEvents="none" style={[corner, { bottom: inset, left: inset,  borderBottomWidth: width, borderLeftWidth: width,  borderBottomLeftRadius: radius }]} />
      <View pointerEvents="none" style={[corner, { bottom: inset, right: inset, borderBottomWidth: width, borderRightWidth: width, borderBottomRightRadius: radius }]} />
    </View>
  );
}
