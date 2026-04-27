import { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '@/constants/app-theme';

type FormInputProps = {
  label: string;
} & ComponentProps<typeof TextInput>;

export function FormInput({ label, ...inputProps }: FormInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.textSubtle}
        style={styles.input}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.input,
    color: palette.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
