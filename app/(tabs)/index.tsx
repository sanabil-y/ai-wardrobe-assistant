// this helps know when the screen is currently focused
import { useFocusEffect } from '@react-navigation/native';

// used to move between screens

import { router } from 'expo-router';

// react stuff
import React, { useCallback, useEffect } from 'react';

// ui parts for this screen
import { Pressable, StyleSheet, Text, View } from 'react-native';

// gets settings like contrast mode, bigger text and voice first mode
import { useAppSettings } from '../../context/appSettingsContext';

// gets voice assistant functions
import { useVoiceAssistant } from '../../context/voiceAssistantContext';

export default function HomeScreen() {
  // these are used so the voice assistant knows this screen and what it can do
  const { registerScreen, registerScreenActions, registerScreenState } =
    useVoiceAssistant();

  // app settings used to change screen look / behaviour
  const { highContrastMode, largerTextEnabled, voiceFirstMode } =
    useAppSettings();



  // when user comes onto this page, register it as home screen
  useFocusEffect(
    useCallback(() => {
      registerScreen('home');
    }, [registerScreen])
  );

  useEffect(() => {
    // this lets the voice assistant navigate to another route from home
    registerScreenActions('home', {
      navigateToRoute: async (route: string) => {
        router.push(route as any);
      },
    });
  }, [registerScreenActions]);


  useEffect(() => {
    // giving some info about this page to the voice assistant
    registerScreenState('home', {
      screenTitle: 'AI Wardrobe Assistant',
      availableRoutes: [
        '/(tabs)',
        '/(tabs)/addItem',
        '/(tabs)/wardrobe',
        '/(tabs)/suggestions',
        '/(tabs)/savedOutfits',
        '/(tabs)/pastLooks',
      ],
      primaryAction: 'Get Outfit Suggestion',
    });
  }, [registerScreenState]);

  // these style vars change if high contrast mode is turned on
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

  const settingsButtonDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const titleLineDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000' }
    : null;

    const textDynamicStyle = highContrastMode ? { color: '#000000' } : null;

  // bigger text if that setting is on

  const largeTitleStyle = largerTextEnabled ? { fontSize: 26 } : null;
  const largeHeroStyle = largerTextEnabled ? { fontSize: 20, lineHeight: 28 } : null;
  const largeCardTitleStyle = largerTextEnabled ? { fontSize: 17 } : null;
  const largeBodyStyle = largerTextEnabled ? { fontSize: 14, lineHeight: 20 } : null;
  const largeSmallTitleStyle = largerTextEnabled ? { fontSize: 16 } : null;
  const largeSettingsIconStyle = largerTextEnabled ? { fontSize: 18 } : null;

  return (
    <View style={[styles.screen, screenDynamicStyle]}>
      <View style={[styles.outerFrame, outerFrameDynamicStyle]}>
        <View style={[styles.innerFrame, innerFrameDynamicStyle]}>
          <View style={styles.headerRow}>
            {/* this empty bit helps keep the title looking centred */}
            <View style={styles.headerSpacer} />

            <View style={styles.titleWrapper}>
              <Text style={[styles.title, textDynamicStyle, largeTitleStyle]}>
                AI Wardrobe Assistant
              </Text>
              <View style={[styles.titleLine, titleLineDynamicStyle]} />
            </View>

            {/* settings button takes user to accessibility page */}
            <Pressable
              style={[styles.settingsButton, settingsButtonDynamicStyle]}
              onPress={() => router.push({ pathname: '/accessibility' as any })}
            >
              <Text
                style={[
                  styles.settingsIcon,
                  textDynamicStyle,
                  largeSettingsIconStyle,
                ]}
              >

                ⚙
              </Text>
            </Pressable>
          </View>

          {/* main question box on the home page */}
          <View style={[styles.heroBox, cardDynamicStyle]}>
            <Text style={[styles.heroText, textDynamicStyle, largeHeroStyle]}>
              What should I wear today?
            </Text>
          </View>

          <Text style={[styles.helperText, textDynamicStyle, largeBodyStyle]}>
            Based on your wardrobe, weather and preferences
          </Text>

          {/* only shows this if voice first mode is on */}
          {voiceFirstMode ? (
            <Text style={[styles.voiceHintText, textDynamicStyle, largeBodyStyle]}>
              Voice-first mode is on. You can use the microphone to move through
              the app and ask for outfit help.
            </Text>
          ) : null}

          <View style={styles.actionsWrapper}>
            {/* main button/card for getting outfit suggestions */}
            <Pressable
              style={[styles.card, styles.primaryCard, cardDynamicStyle]}
              onPress={() => router.push('/(tabs)/suggestions')}
            >
              <Text
                style={[
                  styles.primaryCardTitle,

                  textDynamicStyle,
                  largeCardTitleStyle,
                ]}
              >
                Get Outfit Suggestion
              </Text>
              <Text
                style={[
                  styles.primaryCardText,
                  textDynamicStyle,
                  largeBodyStyle,
                ]}
              >
                Generate outfit ideas based on your wardrobe
              </Text>
            </Pressable>

            <View style={styles.cardGrid}>
              {/* takes user to add item page */}
              <Pressable
                style={[styles.smallCard, cardDynamicStyle]}
                onPress={() => router.push('/(tabs)/addItem')}
              >
                <Text
                  style={[
                    styles.smallCardTitle,
                    textDynamicStyle,
                    largeSmallTitleStyle,
                  ]}
                >
                  Add Item
                </Text>
                <Text
                  style={[
                    styles.smallCardText,
                    textDynamicStyle,
                    largeBodyStyle,
                  ]}
                >
                  Upload and analyse a clothing item
                </Text>
              </Pressable>

              {/* opens wardrobe page */}
              <Pressable
                style={[styles.smallCard, cardDynamicStyle]}
                onPress={() => router.push('/(tabs)/wardrobe')}
              >

                <Text
                  style={[
                    styles.smallCardTitle,
                    textDynamicStyle,
                    largeSmallTitleStyle,
                  ]}
                >
                  My Wardrobe
                </Text>
                <Text
                  style={[
                    styles.smallCardText,
                    textDynamicStyle,
                    largeBodyStyle,
                  ]}
                >
                  View all saved clothing items
                </Text>
              </Pressable>

              {/* goes to saved outfit suggestions */}
              <Pressable
                style={[styles.smallCard, cardDynamicStyle]}
                onPress={() => router.push('/(tabs)/savedOutfits')}
              >
                <Text
                  style={[
                    styles.smallCardTitle,
                    textDynamicStyle,
                    largeSmallTitleStyle,
                  ]}
                >
                  Saved Outfits
                </Text>
                <Text
                  style={[
                    styles.smallCardText,
                    textDynamicStyle,
                    largeBodyStyle,
                  ]}
                >
                  View favourite outfit suggestions
                </Text>
              </Pressable>

              {/* opens the page with older outfit looks */}


              <Pressable
                style={[styles.smallCard, cardDynamicStyle]}
                onPress={() => router.push('/(tabs)/pastLooks')}
              >
                <Text
                  style={[
                    styles.smallCardTitle,
                    textDynamicStyle,
                    largeSmallTitleStyle,
                  ]}
                >
                  Past Looks
                </Text>
                <Text
                  style={[
                    styles.smallCardText,
                    textDynamicStyle,
                    largeBodyStyle,
                  ]}
                >
                  View previously generated outfit suggestions
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );



}

// styles for home page
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
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#cfd4da',
    borderRadius: 22,
    backgroundColor: '#f7f7f7',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 130,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  headerSpacer: {
    width: 34,
  },
  titleWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2b3440',
    textAlign: 'center',
  },
  titleLine: {
    width: 34,
    height: 2,
    backgroundColor: '#7f8791',
    marginTop: 10,
    borderRadius: 10,
  },
  settingsButton: {
    width: 34,
    height: 34,
    borderWidth: 1.5,
    borderColor: '#aab1b9',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  settingsIcon: {
    fontSize: 16,
    color: '#2b3440',
  },
  heroBox: {
    borderWidth: 2,
    borderColor: '#2d3847',
    backgroundColor: '#fbfbfb',
    minHeight: 82,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 14,
  },
  heroText: {
    fontSize: 17,
    color: '#2b3440',
    textAlign: 'center',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 13,
    color: '#6b727a',
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  voiceHintText: {
    fontSize: 13,
    color: '#6b727a',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 18,
    marginBottom: 22,
  },
  actionsWrapper: {
    flex: 1,
  },
  primaryCard: {
    borderWidth: 2,
    borderColor: '#2d3847',
    backgroundColor: '#fdfdfd',
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  primaryCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2933',
    textAlign: 'center',
    marginBottom: 6,
  },
  primaryCardText: {
    fontSize: 13,
    color: '#66707a',
    textAlign: 'center',
    lineHeight: 18,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: 4,
  },
  smallCard: {
    width: '48.2%',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d5d9de',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    minHeight: 110,
    justifyContent: 'center',
  },
  smallCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2933',
    textAlign: 'center',
    marginBottom: 5,
  },
  smallCardText: {
    fontSize: 12,
    color: '#6b727a',
    textAlign: 'center',
    lineHeight: 16,
  },
});