import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  uri: string;
  style?: any;
};

export default function SafeImage({ uri, style }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed || !uri) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.text}>Image unavailable</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#666',
    fontSize: 13,
  },
});