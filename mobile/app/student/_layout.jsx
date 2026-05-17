import { useState }                       from 'react';
import { Tabs }                           from 'expo-router';
import { Pressable, View }                from 'react-native';
import {
  LayoutDashboard, BookOpen, Clock,
  QrCode, Settings,
}                                         from 'lucide-react-native';

import { useTheme }                       from '../../src/theme/ThemeProvider';
import SettingsPopover                    from '../../src/components/ui/SettingsPopover';

/**
 * ═════════════════════════════════════════════════════════════════
 * Student tab layout.
 *
 * Four real tabs (Dashboard / Scan / Classes / History) plus a
 * fake "Settings" tab at the far right that doesn't navigate —
 * tapping it opens the SettingsPopover instead.
 *
 * The Settings tab is faked via tabBarButton — we override the
 * default pressable, call setSettingsOpen(true), and since we
 * never trigger navigation the router never tries to render the
 * settings.jsx file (which exists only so the route name resolves
 * during tab registration).
 *
 * Note: expo-router v6 disallows combining `href: null` with
 * `tabBarButton`, so we rely on the custom Pressable alone to
 * prevent navigation.
 * ═════════════════════════════════════════════════════════════════
 */
export default function StudentLayout() {
  const t = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor:  t.colors.topbarBg,
            borderTopColor:   t.colors.border,
            borderTopWidth:   1,
            height:           64,
            paddingTop:       6,
            paddingBottom:    8,
            elevation:        0,
          },
          tabBarActiveTintColor:   t.colors.brand,
          tabBarInactiveTintColor: t.colors.textMuted,
          tabBarLabelStyle: {
            fontSize:      10,
            fontFamily:    t.fontFamily.bodySemibold,
            letterSpacing: 0.2,
            marginTop:     2,
          },
          tabBarItemStyle: {
            paddingTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={LayoutDashboard} color={color} focused={focused} t={t} />
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={QrCode} color={color} focused={focused} t={t} />
            ),
          }}
        />
        <Tabs.Screen
          name="classes"
          options={{
            title: 'Classes',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={BookOpen} color={color} focused={focused} t={t} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={Clock} color={color} focused={focused} t={t} />
            ),
          }}
        />

        {/*
          Fake "Settings" tab. The tabBarButton override intercepts
          the press and opens the popover instead of navigating.
          The dummy `settings.jsx` file exists only so the route name
          resolves — it never actually renders.
        */}
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => (
              <TabIcon Icon={Settings} color={color} focused={settingsOpen} t={t} />
            ),
            tabBarButton: (props) => (
              <Pressable
                {...props}
                onPress={() => setSettingsOpen(true)}
                style={props.style}
              />
            ),
          }}
        />
      </Tabs>

      <SettingsPopover
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

// ─── Tab icon with focus pill ──────────────────────────────────
// Small pill appears behind the icon when focused — subtle but
// gives the active tab a bit of visual weight.
function TabIcon({ Icon, color, focused, t }) {
  return (
    <View style={{
      width:          40,
      height:         28,
      alignItems:     'center',
      justifyContent: 'center',
      borderRadius:   t.radius.pill,
      backgroundColor: focused ? t.colors.brandSubtle : 'transparent',
    }}>
      <Icon size={20} color={color} strokeWidth={2.2} />
    </View>
  );
}