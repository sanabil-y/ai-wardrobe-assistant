// router is used to go back or move to another page
import { router } from 'expo-router';

// react
import React from 'react';





// ui parts for this screen
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

// gets all saved accessibility/app settings
import { useAppSettings } from '../context/appSettingsContext';

// gets voice assistant state too
import { useVoiceAssistant } from '../context/voiceAssistantContext';

export default function AccessibilityScreen() {
  // settings from app settings context
  const {
    voiceFirstMode,
    highContrastMode,
    audioDescriptionsEnabled,
    largerTextEnabled,
    updateSetting,
  } = useAppSettings();



  // voice on/off comes from voice assistant context
  const { voiceEnabled, setVoiceEnabled } = useVoiceAssistant();

  // these styles change when high contrast mode is on
  const screenDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff' }
    : null;

  const frameDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const innerDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const cardDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const buttonDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000', borderColor: '#000000' }
    : null;


  const textDynamicStyle = highContrastMode ? { color: '#000000' } : null;

  const darkButtonTextStyle = highContrastMode ? { color: '#ffffff' } : null;

  // these make text bigger if larger text setting is on
  const largeTitleStyle = largerTextEnabled ? { fontSize: 26 } : null;
  const largeLabelStyle = largerTextEnabled ? { fontSize: 16 } : null;
  const largeBodyStyle = largerTextEnabled ? { fontSize: 14, lineHeight: 20 } : null;
  const largeBackStyle = largerTextEnabled ? { fontSize: 20 } : null;

  return (
    <View style={[styles.screen, screenDynamicStyle]}>
      <View style={[styles.outerFrame, frameDynamicStyle]}>
        <ScrollView
          contentContainerStyle={[styles.innerFrame, innerDynamicStyle]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            {/* back button to previous screen */}
            <Pressable style={[styles.backButton, cardDynamicStyle]} onPress={() => router.back()}>
              <Text style={[styles.backButtonText, textDynamicStyle, largeBackStyle]}>←</Text>
            </Pressable>

            <View style={styles.titleWrapper}>
              <Text style={[styles.title, textDynamicStyle, largeTitleStyle]}>
                Accessibility Settings
              </Text>
              <View
                style={[
                  styles.titleLine,
                  highContrastMode ? { backgroundColor: '#000000' } : null,
                ]}
              />
            </View>

            {/* this blank space helps keep title centred */}
            <View style={styles.headerSpacer} />
          </View>

          {/* voice chat toggle */}
          <View style={[styles.card, cardDynamicStyle]}>
            <View style={styles.row}>
              <View style={styles.textWrap}>
                <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
                  Voice chat
                </Text>
                <Text style={[styles.sub, textDynamicStyle, largeBodyStyle]}>
                  Turn the voice assistant on or off across the app
                </Text>
              </View>



              <Switch
                value={voiceEnabled}
                onValueChange={setVoiceEnabled}
                trackColor={{ false: '#bfc5cc', true: '#253041' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* voice first mode toggle */}
          <View style={[styles.card, cardDynamicStyle]}>
            <View style={styles.row}>
              <View style={styles.textWrap}>
                <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
                  Voice-first interaction
                </Text>
                <Text style={[styles.sub, textDynamicStyle, largeBodyStyle]}>
                  Prioritise voice-friendly interaction in the app
                </Text>
              </View>

              <Switch
                value={voiceFirstMode}
                onValueChange={(value) => updateSetting('voiceFirstMode', value)}
                trackColor={{ false: '#bfc5cc', true: '#253041' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* contrast mode toggle */}
          <View style={[styles.card, cardDynamicStyle]}>
            <View style={styles.row}>
              <View style={styles.textWrap}>
                <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
                  High contrast mode
                </Text>
                <Text style={[styles.sub, textDynamicStyle, largeBodyStyle]}>
                  Stronger contrast for easier visibility
                </Text>
              </View>

              <Switch
                value={highContrastMode}
                onValueChange={(value) => updateSetting('highContrastMode', value)}
                trackColor={{ false: '#bfc5cc', true: '#253041' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* audio descriptions toggle */}
          <View style={[styles.card, cardDynamicStyle]}>
            <View style={styles.row}>
              <View style={styles.textWrap}>
                <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
                  Audio descriptions
                </Text>
                <Text style={[styles.sub, textDynamicStyle, largeBodyStyle]}>
                  Enable or disable spoken item and outfit descriptions
                </Text>
              </View>

              <Switch
                value={audioDescriptionsEnabled}
                onValueChange={(value) =>
                  updateSetting('audioDescriptionsEnabled', value)
                }
                trackColor={{ false: '#bfc5cc', true: '#253041' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* bigger text toggle */}
          <View style={[styles.card, cardDynamicStyle]}>
            <View style={styles.row}>
              <View style={styles.textWrap}>
                <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
                  Larger text support
                </Text>
                <Text style={[styles.sub, textDynamicStyle, largeBodyStyle]}>
                  Increase text size in supported UI areas
                </Text>
              </View>

              <Switch
                value={largerTextEnabled}
                onValueChange={(value) => updateSetting('largerTextEnabled', value)}
                trackColor={{ false: '#bfc5cc', true: '#253041' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* goes to privacy page */}
          <Pressable
            style={[styles.privacyButton, buttonDynamicStyle]}
            onPress={() => router.push({ pathname: '/privacy' as any })}
          >
            <Text
              style={[
                styles.privacyButtonText,
                darkButtonTextStyle,
                largeLabelStyle,
              ]}
            >
              Privacy & Data Control →
            </Text>
          </Pressable>

          {/* little info box at bottom */}
          <View style={[styles.infoBox, cardDynamicStyle]}>
            <Text style={[styles.infoTitle, textDynamicStyle, largeLabelStyle]}>
              Built to support more independent use
            </Text>
            <Text style={[styles.infoText, textDynamicStyle, largeBodyStyle]}>
              These settings persist and can now affect real app behaviour and
              interface presentation across supported areas.
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
  
}

// styles for accessibility screen
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
  privacyButton: {
    borderWidth: 2,
    borderColor: '#2d3847',
    backgroundColor: '#253041',
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  privacyButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  infoBox: {
    borderWidth: 1.2,
    borderColor: '#cfd4da',
    backgroundColor: '#fbfbfb',
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2b3440',
    marginBottom: 6,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#6e7780',
    lineHeight: 18,
    textAlign: 'center',
  },
});