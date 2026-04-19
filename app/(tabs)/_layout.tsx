// importing Ionicons for tab icons (from Expo vector icons library)
import { Ionicons } from '@expo/vector-icons';


// tabs component from expo-router, this is used to make the bottom tab navigation
import { Tabs } from 'expo-router';

// main layout component for the tab based navigation
export default function TabLayout() {
  return (
    <Tabs

      // screenOptions is to customise how each tab behaves and looks
      screenOptions={({ route }) => ({
        headerShown: false, // to remove the default header at the top

        tabBarShowLabel: true, // this isto show text labels under each icon

        // active vs inactive tab colours
        tabBarActiveTintColor: '#111',
        tabBarInactiveTintColor: '#888',

        // styling the tab bar container
        tabBarStyle: {
          position: 'absolute', // floating tab bar 
          left: 12,
          right: 12,

          bottom: 12,
          
          height: 74,
          borderRadius: 22, // rounded edges for a cleaner UI look
          backgroundColor: '#ffffff',

          // border styling
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: '#e5e5e5',

          // this is to add padding inside the tab bar
          paddingTop: 10,
          paddingBottom: 10,

          // adding shadow for elevation
          shadowColor: '#000',
           shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },

          // elevation for Android shadow
          elevation: 8,
        },

        // styling for tab labels (text under icons)
        tabBarLabelStyle: {
          fontSize: 11,
            fontWeight: '600',
          marginTop: 2,
        },

        // function to give out icons based on the route name
        tabBarIcon: ({ color, focused, size }) => {
          // default icon (fallback)
          let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';

          // each route gets a different icon depending on whether it's focused
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

          // returning the icon component with dynamic properties
             return <Ionicons name={iconName} size={size ?? 22} color={color} />;
        },
      })}
    >
      {/* home screen (default tab) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home', // the label shown under icon
        }}
      />

      {/*  new wardrobe items dding screen  */}

      <Tabs.Screen
        name="addItem"
        options={{
          title: 'Add Item',
        }}
      />

      {/* for displaying all wardrobe items */}
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: 'Wardrobe',
        }}
      />

      {/* AI-generated outfit suggestions */}
      <Tabs.Screen
        name="suggestions"
        options={{
          title: 'Suggestions',
        }}
      />

      {/*  outfits saved by the user */}
      <Tabs.Screen
        name="savedOutfits"
        options={{
          title: 'Saved',
        }}
      />

      {/*   outfits worn in the past (history tracking) */}
      <Tabs.Screen
        name="pastLooks"
        options={{
          title: 'Past Looks',

        }}
      />
    </Tabs>
  );



}