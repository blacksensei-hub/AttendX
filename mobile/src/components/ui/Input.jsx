import { useState, useEffect, useRef }     from 'react';
import {
  View, TextInput, Text, Pressable,
}                                          from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
}                                          from 'react-native-reanimated';

import { useTheme }                        from '../../theme/ThemeProvider';
import { shake }                           from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Input — text input with animated states.
 *
 * Features:
 *   • Optional leading icon
 *   • Optional trailing icon/action (password show/hide, clear, etc.)
 *   • Label above the input
 *   • Error state — shakes horizontally, border turns red
 *   • Focus state — border brightens to brand colour
 *   • Hint text (muted, below the input)
 * ═════════════════════════════════════════════════════════════════
 */
export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  icon:      Icon,
  iconRight: IconRight,
  onIconRightPress,
  error,
  hint,
  secureTextEntry = false,
  keyboardType    = 'default',
  autoCapitalize  = 'sentences',
  autoComplete,
  autoFocus       = false,
  editable        = true,
  multiline       = false,
  numberOfLines   = 1,
  maxLength,
  mono            = false,
  style,
  ...rest
}) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  // Shake whenever the error transitions from falsy -> truthy
  const prevError = usePrevious(error);
  useEffect(() => {
    if (error && !prevError) {
      shakeX.value = shake();
    }
  }, [error, prevError, shakeX]);

  const borderColor = error   ? t.colors.red
                    : focused ? t.colors.brand
                    :           t.colors.border;

  const iconColor   = error   ? t.colors.red
                    : focused ? t.colors.brandText
                    :           t.colors.textMuted;

  return (
    <View style={[{ gap: 6 }, style]}>
      {label && (
        <Text style={{
          color:      t.colors.textSecondary,
          fontSize:   t.fontSize.xs,
          fontFamily: t.fontFamily.bodySemibold,
        }}>
          {label}
        </Text>
      )}

      <Animated.View style={shakeStyle}>
        <View style={{
          flexDirection:     'row',
          alignItems:        multiline ? 'flex-start' : 'center',
          backgroundColor:   t.colors.bgCard,
          borderWidth:       1,
          borderColor,
          borderRadius:      t.radius.atomic,
          paddingHorizontal: 12,
          paddingVertical:   multiline ? 10 : 0,
          minHeight:         multiline ? 80 : 44,
        }}>
          {Icon && (
            <Icon
              size={16}
              color={iconColor}
              strokeWidth={2.2}
              style={{ marginRight: 10, marginTop: multiline ? 3 : 0 }}
            />
          )}

          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={t.colors.textMuted}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            editable={editable}
            multiline={multiline}
            numberOfLines={multiline ? numberOfLines : 1}
            maxLength={maxLength}
            onFocus={() => setFocused(true)}
            onBlur={()  => setFocused(false)}
            selectionColor={t.colors.brand}
            style={{
              flex:              1,
              color:             t.colors.textPrimary,
              fontFamily:        mono ? t.fontFamily.mono : t.fontFamily.body,
              fontSize:          t.fontSize.md,
              padding:           0,
              textAlignVertical: multiline ? 'top' : 'center',
            }}
            {...rest}
          />

          {IconRight && (
            <Pressable
              onPress={onIconRightPress}
              hitSlop={t.hitSlop.medium}
              style={{ marginLeft: 10, marginTop: multiline ? 3 : 0 }}
            >
              <IconRight size={16} color={iconColor} strokeWidth={2.2} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {(error || hint) && (
        <Text style={{
          color:      error ? t.colors.red : t.colors.textMuted,
          fontSize:   11,
          fontFamily: error ? t.fontFamily.mono : t.fontFamily.body,
          marginTop:  2,
        }}>
          {error || hint}
        </Text>
      )}
    </View>
  );
}

// ─── Tiny hook for detecting state transitions ────────────────
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}