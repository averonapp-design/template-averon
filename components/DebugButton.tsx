import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useLogger } from '@/utils/logger';

export const DebugButton = () => {
  const logger = useLogger('DebugButton');
  const handlePress = () => {
    const logs = logger.getLogs();
    Alert.alert('Debug Logs', logs.join('\n'));
  };
  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Text style={styles.text}>DEBUG</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#ff5555',
    padding: 8,
    borderRadius: 4,
    zIndex: 9999,
  },
  text: { color: '#fff', fontWeight: 'bold' },
});
