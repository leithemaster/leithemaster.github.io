import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { FluidView } from '../fluid/config';

type Props = {
  view?: FluidView;
  style?: StyleProp<ViewStyle>;
};

/**
 * Native placeholder. The site runs FluidInk.web.tsx.
 * To bring the ink to iOS/Android, render an expo-gl GLView here and pass
 * its gl to createFluid() with onFrameEnd: () => gl.endFrameEXP().
 */
export function FluidInk({ style }: Props) {
  return <View style={[styles.container, style]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a12',
  },
});
