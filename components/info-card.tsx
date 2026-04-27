import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/app-theme';

type InfoCardProps = {
  title: string;
  description: string;
};

export function InfoCard({ title, description }: InfoCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    borderRadius: 24,
    backgroundColor: palette.surface,
    padding: 18,
    shadowColor: '#182033',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  title: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
