import React from 'react';
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useAppSettings } from '../context/appSettingsContext';

export default function PrivacyScreen() {
  const {
    approveImagesBeforeAI,
    localStorageOnly,
    voiceDataProcessingEnabled,
    highContrastMode,
    largerTextEnabled,
    updateSetting,
  } = useAppSettings();

  const screenDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff' }
    : null;

  const outerFrameDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const innerFrameDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const cardDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const reassuranceDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const messageBoxDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const backButtonDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const titleLineDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000' }
    : null;

  const textDynamicStyle = highContrastMode ? { color: '#000000' } : null;

  const largeTitleStyle = largerTextEnabled ? { fontSize: 24 } : null;
  const largeLabelStyle = largerTextEnabled ? { fontSize: 16 } : null;
  const largeBodyStyle = largerTextEnabled ? { fontSize: 14, lineHeight: 20 } : null;
  const largeArrowStyle = largerTextEnabled ? { fontSize: 20 } : null;

  return (
    <View style={[styles.screen, screenDynamicStyle]}>
      <View style={[styles.outerFrame, outerFrameDynamicStyle]}>
        <ScrollView
          contentContainerStyle={[styles.innerFrame, innerFrameDynamicStyle]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              style={[styles.backButton, backButtonDynamicStyle]}
              onPress={() => router.back()}
            >
              <Text
                style={[styles.backButtonText, textDynamicStyle, largeArrowStyle]}
              >
                ←
              </Text>
            </Pressable>

            <View style={styles.titleWrapper}>
              <Text style={[styles.title, textDynamicStyle, largeTitleStyle]}>
                Privacy & Data Control
              </Text>
              <View style={[styles.titleLine, titleLineDynamicStyle]} />
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <View style={[styles.card, cardDynamicStyle]}>
            <View style={styles.row}>
              <View style={styles.textWrap}>
                <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
                  Approve each image use
                </Text>
                <Text style={[styles.sub, textDynamicStyle, largeBodyStyle]}>
                  Manually approve before AI analyses any photo
                </Text>
              </View>

              <Switch
                value={approveImagesBeforeAI}
                onValueChange={(value) =>
                  updateSetting('approveImagesBeforeAI', value)
                }
                trackColor={{ false: '#bfc5cc', true: '#253041' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.card, cardDynamicStyle]}>
            <View style={styles.row}>
              <View style={styles.textWrap}>
                <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
                  Store data locally
                </Text>
                <Text style={[styles.sub, textDynamicStyle, largeBodyStyle]}>
                  New wardrobe items will save on this device instead of cloud
                </Text>
              </View>

              <Switch
                value={localStorageOnly}
                onValueChange={(value) =>
                  updateSetting('localStorageOnly', value)
                }
                trackColor={{ false: '#bfc5cc', true: '#253041' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.card, cardDynamicStyle]}>
            <View style={styles.row}>
              <View style={styles.textWrap}>
                <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
                  Enable voice data processing
                </Text>
                <Text style={[styles.sub, textDynamicStyle, largeBodyStyle]}>
                  Turn voice assistant processing on or off
                </Text>
              </View>

              <Switch
                value={voiceDataProcessingEnabled}
                onValueChange={(value) =>
                  updateSetting('voiceDataProcessingEnabled', value)
                }
                trackColor={{ false: '#bfc5cc', true: '#253041' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.reassuranceBox, reassuranceDynamicStyle]}>
            <Text
              style={[
                styles.reassuranceTitle,
                textDynamicStyle,
                largeLabelStyle,
              ]}
            >
              Your data is always under your control
            </Text>
          </View>

          <View style={[styles.messageBox, messageBoxDynamicStyle]}>
            <Text
              style={[styles.messageBullet, textDynamicStyle, largeBodyStyle]}
            >
              • No data shared with third parties
            </Text>
            <Text
              style={[styles.messageBullet, textDynamicStyle, largeBodyStyle]}
            >
              • Voice processing can be switched off
            </Text>
            <Text
              style={[styles.messageBullet, textDynamicStyle, largeBodyStyle]}
            >
              • New wardrobe items can be saved locally
            </Text>
            <Text
              style={[styles.messageBullet, textDynamicStyle, largeBodyStyle]}
            >
              • You can require approval before AI image use
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    padding: 10,
  },
  outerFrame: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#253041',
    borderRadius: 26,
    padding: 8,
    backgroundColor: '#f4f4f4',
  },
  innerFrame: {
    flexGrow: 1,
    borderWidth: 1.5,
    borderColor: '#cfd4da',
    borderRadius: 22,
    backgroundColor: '#f7f7f7',
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    width: 34,
    height: 34,
    borderWidth: 1.5,
    borderColor: '#aab1b9',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  backButtonText: {
    fontSize: 18,
    color: '#2b3440',
    fontWeight: '600',
  },
  titleWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#2b3440',
  },
  titleLine: {
    width: 34,
    height: 2,
    backgroundColor: '#7f8791',
    marginTop: 10,
    borderRadius: 10,
  },
  headerSpacer: {
    width: 34,
  },
  card: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  textWrap: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2b3440',
  },
  sub: {
    fontSize: 12,
    color: '#6e7780',
    marginTop: 4,
    lineHeight: 16,
  },
  reassuranceBox: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#f8f9fb',
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginTop: 2,
    alignItems: 'center',
  },
  reassuranceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2b3440',
    textAlign: 'center',
  },
  messageBox: {
    borderWidth: 1,
    borderColor: '#cfd4da',
    backgroundColor: '#fbfbfb',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  messageBullet: {
    fontSize: 12,
    color: '#6e7780',
    marginBottom: 6,
    lineHeight: 17,
  },
});