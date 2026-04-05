import { Platform } from 'react-native';

const tintColorLight = '#ff6b3d';
const tintColorDark = '#ff8b5e';

export const Colors = {
  light: {
    text: '#0b1722',
    background: '#f4f7fb',
    tint: tintColorLight,
    icon: '#5f6d7b',
    tabIconDefault: '#5f6d7b',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#edf3fb',
    background: '#06131f',
    tint: tintColorDark,
    icon: '#7f94a8',
    tabIconDefault: '#7f94a8',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
