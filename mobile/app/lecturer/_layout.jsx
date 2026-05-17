import { useState }                       from 'react';
import { Tabs }                          from 'expo-router';
import { Pressable, View }               from 'react-native';
import {
  LayoutDashboard, BookOpen, BarChart3, Settings,
}                                         from 'lucide-react-native';

import { useTheme }                       from '../../src/theme/ThemeProvider';
import SettingsPopover                    from '../../src/components/ui/SettingsPopover';

/**
 * ═════════════════════════════════════════════════════════════════
 * Lecturer tab layout.
 *
 * Tabs: Dashboard / Classes / Reports / Settings (fake).
 *
 * Class detail (/lecturer/class/[id]) and Live session view
 * (/lecturer/session/[id]) are nested routes — they don't appear
 * in the tab bar but are reachable via router.push from inside
 * the Classes tab. The tab bar stays visible while viewing them.
 *
 * Settings tab pattern (fake tab + popover) matches the student
 * layout exactly — see /mobile/app/student/_layout.jsx for the
 * full explanation.
 * ═════════════════════════════════════════════════════════════════
 */
export default function LecturerLayout() {
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
          name="classes"
          options={{
            title: 'Classes',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={BookOpen} color={color} focused={focused} t={t} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={BarChart3} color={color} focused={focused} t={t} />
            ),
          }}
        />

        {/* Fake settings tab — see student layout for the pattern */}
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

        {/* Hide nested routes from the tab bar */}
        <Tabs.Screen name="class/[id]"   options={{ href: null }} />
        <Tabs.Screen name="session/[id]" options={{ href: null }} />
      </Tabs>

      <SettingsPopover
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

function TabIcon({ Icon, color, focused, t }) {
  return (
    <View style={{
      width:           40,
      height:          28,
      alignItems:      'center',
      justifyContent:  'center',
      borderRadius:    t.radius.pill,
      backgroundColor: focused ? t.colors.brandSubtle : 'transparent',
    }}>
      <Icon size={20} color={color} strokeWidth={2.2} />
    </View>
  );
}