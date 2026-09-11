import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, spacing, typography } from '../../../design/theme';

type Props = {
  label: string;
};

function DaySeparatorComponent({ label }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  label: {
    ...typography.caption,
    color: palette.inkMuted,
  },
});

export const DaySeparator = memo(DaySeparatorComponent);
