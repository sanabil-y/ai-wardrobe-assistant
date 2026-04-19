// react + state
import React, { useState } from 'react';





// basic image + view stuff
import { Image, StyleSheet, Text, View } from 'react-native';

// props for this component
type Props = {
  uri: string;
  style?: any;

};

export default function SafeImage({ uri, style }: Props) {
  // tracks if image failed to load
  const [failed, setFailed] = useState(false);

  // if image is broken OR no uri at all, show fallback instead
  if (failed || !uri) {
    return (
      <View style={[styles.fallback, style]}>
        {/* simple message so user knows image didnt load */}
        <Text style={styles.text}>Image unavailable</Text>
      </View>
    );
  }



  return (
    <Image
      // uses the image url passed in
      source={{ uri }}
      style={style}
      resizeMode="contain" // keeps full image visible (no weird crop)
      onError={() => setFailed(true)} // if it fails, switch to fallback
    />
  );
}

// basic styles for fallback view
const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#e5e5e5', // light grey box when no image
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#666', // kinda muted text
    fontSize: 13,
  },
});