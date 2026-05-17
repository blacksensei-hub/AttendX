import { useState }                        from 'react';
import { Text, View }                      from 'react-native';
import {
  Mail, Lock, QrCode, ArrowRight, Plus, Trash2,
}                                          from 'lucide-react-native';

import Screen                              from '../src/components/ui/Screen';
import Card                                from '../src/components/ui/Card';
import Button                              from '../src/components/ui/Button';
import Input                               from '../src/components/ui/Input';
import StatusPill                          from '../src/components/ui/StatusPill';
import IconTile                            from '../src/components/ui/IconTile';
import Header                              from '../src/components/ui/Header';
import { useTheme, useThemeMode }          from '../src/theme/ThemeProvider';

export default function PrimitivesTest() {
  const t = useTheme();
  const { mode, setMode } = useThemeMode();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const cycleMode = () => setMode(
    mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system'
  );

  return (
    <Screen>
      <Header
        title="UI primitives"
        subtitle={`Theme mode: ${mode}`}
        action={
          <Button label="Toggle" size="sm" variant="secondary" onPress={cycleMode} />
        }
      />

      <Card accent="brand" accentIntensity="bold">
        <IconTile icon={QrCode} tone="brand" size="lg" shadow />
        <View style={{ height: t.spacing.sm }} />
        <Input
          label="Email"
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          placeholder="you@university.edu"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <View style={{ height: t.spacing.sm }} />
        <Input
          label="Password"
          icon={Lock}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          error={password.length > 0 && password.length < 6 ? 'At least 6 characters' : null}
        />
        <View style={{ height: t.spacing.md }} />
        <Button
          label="Sign in"
          iconRight={ArrowRight}
          fullWidth
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1500);
          }}
        />
      </Card>

      <Card>
        <SectionLabel t={t}>Status pills</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <StatusPill status="present" />
          <StatusPill status="late" />
          <StatusPill status="absent" />
          <StatusPill status="live" />
          <StatusPill status="scheduled" />
          <StatusPill status="approved" />
          <StatusPill status="pending" />
          <StatusPill status="rejected" />
        </View>
      </Card>

      <Card>
        <SectionLabel t={t}>Icon tiles</SectionLabel>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <IconTile icon={Mail}   tone="brand"  size="md" />
          <IconTile icon={Lock}   tone="green"  size="md" />
          <IconTile icon={QrCode} tone="amber"  size="md" />
          <IconTile icon={Plus}   tone="violet" size="md" />
          <IconTile icon={Trash2} tone="red"    size="md" />
        </View>
      </Card>

      <Card>
        <SectionLabel t={t}>Button variants</SectionLabel>
        <View style={{ gap: t.spacing.xs }}>
          <Button label="Primary"   variant="primary"   icon={Plus}   fullWidth onPress={() => {}} />
          <Button label="Secondary" variant="secondary" icon={Plus}   fullWidth onPress={() => {}} />
          <Button label="Success"   variant="success"   icon={Plus}   fullWidth onPress={() => {}} />
          <Button label="Danger"    variant="danger"    icon={Trash2} fullWidth onPress={() => {}} />
          <Button label="Ghost"     variant="ghost"                   fullWidth onPress={() => {}} />
        </View>
      </Card>
    </Screen>
  );
}

function SectionLabel({ children, t }) {
  return (
    <Text style={{
      color:         t.colors.textSecondary,
      fontSize:      t.fontSize.xs,
      fontFamily:    t.fontFamily.bodySemibold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom:  t.spacing.sm,
    }}>
      {children}
    </Text>
  );
}