import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { FluidInk } from './src/components/FluidInk';

export default function App() {
  return (
    <View style={styles.container}>
      <FluidInk />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a12',
  },
});
