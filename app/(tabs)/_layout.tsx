import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#111',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          height: 74,
          borderRadius: 22,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: '#e5e5e5',
          paddingTop: 10,
          paddingBottom: 10,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIcon: ({ color, focused, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';

          if (route.name === 'index') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'addItem') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'wardrobe') {
            iconName = focused ? 'shirt' : 'shirt-outline';
          } else if (route.name === 'suggestions') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'savedOutfits') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'pastLooks') {
            iconName = focused ? 'time' : 'time-outline';
          }

          return <Ionicons name={iconName} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="addItem"
        options={{
          title: 'Add Item',
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: 'Wardrobe',
        }}
      />
      <Tabs.Screen
        name="suggestions"
        options={{
          title: 'Suggestions',
        }}
      />
      <Tabs.Screen
        name="savedOutfits"
        options={{
          title: 'Saved',
        }}
      />
      <Tabs.Screen
        name="pastLooks"
        options={{
          title: 'Past Looks',
        }}
      />
    </Tabs>
  );
}