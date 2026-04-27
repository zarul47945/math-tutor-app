import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { InfoCard } from '@/components/info-card';
import { palette } from '@/constants/app-theme';

export default function ModuleScreen() {
  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Module placeholder screen</Text>
        <Text style={styles.subtitle}>
          This route can later hold lesson content, question prompts, and guided practice for each
          tutoring session.
        </Text>
      </View>

      <InfoCard
        title="Module area"
        description="You can later plug in curriculum units, worked examples, and progress tracking here."
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingVertical: 20,
  },
  header: {
    gap: 10,
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
});
