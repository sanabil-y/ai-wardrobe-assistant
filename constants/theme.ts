// used to check what platform the app is running on (ios, android, web)
import { Platform } from 'react-native';

// main accent colours for light and dark mode
const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

// all colours used in the app (split into light + dark mode)
export const Colors = {
  light: {
    text: '#11181C', // main text colour
    background: '#fff', // screen background
    tint: tintColorLight, // main accent colour (buttons, highlights)
    icon: '#687076', // default icon colour
    tabIconDefault: '#687076', // tab icons when not selected
    tabIconSelected: tintColorLight, // tab icon when active
  },
  dark: {
    text: '#ECEDEE', // lighter text for dark mode
    background: '#151718', // dark background
    tint: tintColorDark, // accent for dark mode
    icon: '#9BA1A6', // icons in dark mode
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// font setup depending on platform
export const Fonts = Platform.select({
  ios: {
    // system fonts on ios (so it feels native)
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    // fallback fonts (android mostly)
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    // web font stacks (basically tries multiple fonts in order)
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});