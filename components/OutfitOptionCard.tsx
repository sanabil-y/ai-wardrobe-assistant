import * as Speech from 'expo-speech';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppSettings } from '../context/appSettingsContext';
import SafeImage from './SafeImage';

type WardrobeItem = {
  id: string;
  itemName: string;
  category: string;
  colour: string;
  imageUrl: string;
};

type OutfitOption = {
  title: string;
  reason: string;
  confidence: number;
  selectedItems: WardrobeItem[];
  isSaved: boolean;
  onSave: () => void;
  saving: boolean;
  feedback?: 'like' | 'dislike' | '';
  onLike: () => void;
  onDislike: () => void;
  explanationTags?: string[];
};

export default function OutfitOptionCard({
  title,
  reason,
  confidence,
  selectedItems,
  isSaved,
  onSave,
  saving,
  feedback = '',
  onLike,
  onDislike,
  explanationTags = [],
}: OutfitOption) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const { highContrastMode, largerTextEnabled, audioDescriptionsEnabled } =
    useAppSettings();

  const getConfidenceColor = (value: number) => {
    if (highContrastMode) {
      return '#000000';
    }

    if (value >= 80) return '#2d6a4f';
    if (value >= 60) return '#b7791f';
    return '#b00020';
  };

  const groupItems = (category: string) =>
    selectedItems.filter((item) => item.category.toLowerCase() === category);

  const handleReadAloud = () => {
    if (!audioDescriptionsEnabled) {
      return;
    }

    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    const itemsText = selectedItems
      .map((item) => `${item.itemName}, ${item.colour}, ${item.category}`)
      .join('. ');

    const tagsText = explanationTags.length
      ? `Key reasons: ${explanationTags.join('. ')}. `
      : '';

    const speechText = `${title}. ${confidence}% match. ${tagsText}This outfit includes: ${itemsText}. Why this works: ${reason}`;

    Speech.speak(speechText, {
      rate: 0.95,
      pitch: 1,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });

    setIsSpeaking(true);
  };

  const orderedCategories = ['top', 'bottom', 'shoes', 'outerwear', 'dress'];

  const cardDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const softCardDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const imageFrameDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const buttonDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const activeButtonDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000', borderColor: '#000000' }
    : null;

  const tagDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const titleLineDynamicText = highContrastMode ? { color: '#000000' } : null;
  const invertedTextStyle = { color: '#ffffff' };

  const largeTitleStyle = largerTextEnabled ? { fontSize: 20 } : null;
  const largeBodyStyle = largerTextEnabled ? { fontSize: 15, lineHeight: 22 } : null;
  const largeSmallStyle = largerTextEnabled ? { fontSize: 13, lineHeight: 18 } : null;
  const largeButtonStyle = largerTextEnabled ? { fontSize: 14 } : null;

  return (
    <View style={[styles.card, cardDynamicStyle]}>
      <View style={styles.headerBlock}>
        <Text style={[styles.title, titleLineDynamicText, largeTitleStyle]}>
          {title}
        </Text>

        <View
          style={[
            styles.badge,
            { backgroundColor: getConfidenceColor(confidence || 0) },
          ]}
        >
          <Text style={[styles.badgeText, largeSmallStyle]}>
            {confidence || 0}% match
          </Text>
        </View>
      </View>

      {explanationTags.length > 0 ? (
        <View style={styles.tagsRow}>
          {explanationTags.map((tag) => (
            <View key={tag} style={[styles.tagPill, tagDynamicStyle]}>
              <Text style={[styles.tagText, titleLineDynamicText, largeSmallStyle]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.mainOutfitBox, softCardDynamicStyle]}>
        {orderedCategories.map((cat) => {
          const items = groupItems(cat);
          if (items.length === 0) return null;

          return (
            <View key={cat} style={[styles.groupBox, softCardDynamicStyle]}>
              <Text style={[styles.groupTitle, titleLineDynamicText, largeSmallStyle]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>

              {items.map((item) => (
                <View key={item.id} style={styles.itemBox}>
                  <View style={[styles.imageFrame, imageFrameDynamicStyle]}>
                    <SafeImage uri={item.imageUrl} style={styles.image} />
                  </View>
                  <Text style={[styles.itemName, titleLineDynamicText, largeBodyStyle]}>
                    {item.itemName}
                  </Text>
                  <Text style={[styles.itemMeta, titleLineDynamicText, largeSmallStyle]}>
                    {item.colour}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        <View style={styles.actionsOuterRow}>
          <Pressable
            style={[
              styles.actionButton,
              styles.likeButton,
              buttonDynamicStyle,
              feedback === 'like' && styles.actionButtonActive,
              feedback === 'like' && activeButtonDynamicStyle,
            ]}
            onPress={onLike}
          >
            <Text
              style={[
                styles.actionButtonText,
                titleLineDynamicText,
                largeButtonStyle,
                feedback === 'like' && styles.actionButtonTextActive,
                feedback === 'like' && invertedTextStyle,
              ]}
            >
              👍 Like
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              styles.dislikeButton,
              buttonDynamicStyle,
              feedback === 'dislike' && styles.actionButtonActive,
              feedback === 'dislike' && activeButtonDynamicStyle,
            ]}
            onPress={onDislike}
          >
            <Text
              style={[
                styles.actionButtonText,
                titleLineDynamicText,
                largeButtonStyle,
                feedback === 'dislike' && styles.actionButtonTextActive,
                feedback === 'dislike' && invertedTextStyle,
              ]}
            >
              👎 Dislike
            </Text>
          </Pressable>
        </View>

        <View style={styles.actionsOuterRow}>
          <Pressable
            style={[
              styles.actionButton,
              styles.saveButton,
              buttonDynamicStyle,
              isSaved && styles.saveButtonActive,
              isSaved && activeButtonDynamicStyle,
            ]}
            onPress={onSave}
          >
            <Text
              style={[
                styles.actionButtonText,
                titleLineDynamicText,
                largeButtonStyle,
                isSaved && styles.actionButtonTextActive,
                isSaved && invertedTextStyle,
              ]}
            >
              {saving ? 'Saving...' : isSaved ? '♥ Saved' : '♡ Save'}
            </Text>
          </Pressable>

          {audioDescriptionsEnabled ? (
            <Pressable
              style={[styles.actionButton, styles.readButton, buttonDynamicStyle]}
              onPress={handleReadAloud}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  styles.readButtonText,
                  titleLineDynamicText,
                  largeButtonStyle,
                ]}
              >
                {isSpeaking ? '⏹ Stop' : '🔊 Read'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.reasonBlock}>
        <Text style={[styles.subtitle, titleLineDynamicText, largeButtonStyle]}>
          Why this works
        </Text>
        <Text style={[styles.reason, titleLineDynamicText, largeBodyStyle]}>
          {reason}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f7f7f7',
    borderWidth: 2,
    borderColor: '#2d3847',
    padding: 10,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2b3440',
    textAlign: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignSelf: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 12,
  },
  tagPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cfd4da',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4d5661',
  },
  mainOutfitBox: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#fbfbfb',
    padding: 8,
  },
  groupBox: {
    borderWidth: 1.2,
    borderColor: '#b9c0c8',
    backgroundColor: '#f4f5f7',
    padding: 8,
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6f7780',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  itemBox: {
    alignItems: 'center',
  },
  imageFrame: {
    width: '100%',
    backgroundColor: '#e2e5e9',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: 110,
    backgroundColor: '#d9dde2',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2b3440',
    textAlign: 'center',
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 12,
    color: '#5f6872',
    textAlign: 'center',
    marginBottom: 2,
  },
  actionsOuterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  likeButton: {
    backgroundColor: '#ffffff',
  },
  dislikeButton: {
    backgroundColor: '#ffffff',
  },
  saveButton: {
    backgroundColor: '#ffffff',
  },
  saveButtonActive: {
    backgroundColor: '#2d3847',
    borderColor: '#2d3847',
  },
  readButton: {
    backgroundColor: '#ffffff',
  },
  readButtonText: {
    color: '#2b3440',
  },
  actionButtonActive: {
    backgroundColor: '#2d3847',
    borderColor: '#2d3847',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2b3440',
    textAlign: 'center',
  },
  actionButtonTextActive: {
    color: '#ffffff',
  },
  reasonBlock: {
    marginTop: 12,
    paddingTop: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2b3440',
    marginBottom: 6,
  },
  reason: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4b5560',
  },
});