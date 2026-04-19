// async storage used to store wardrobe locally on device
import AsyncStorage from '@react-native-async-storage/async-storage';

// key used for storing wardrobe items
export const LOCAL_WARDROBE_KEY = 'local_wardrobe_items_v1';

// type for each item saved locally
export type LocalWardrobeItem = {
  id: string;
  itemName: string;
  category: string;
  colour: string;
  occasion: string;
  mood: string;
  description: string;
  imageUrl: string;
  createdAt: string;
  localOnly: true; // just marks it as local (not cloud)
};

// gets all saved wardrobe items from storage
export async function getLocalWardrobeItems(): Promise<LocalWardrobeItem[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_WARDROBE_KEY);

    // if nothing saved, return empty list
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Failed to load local wardrobe items:', error);
    return [];
  }
}

// saves full list of wardrobe items
export async function saveLocalWardrobeItems(items: LocalWardrobeItem[]) {
  try {
    await AsyncStorage.setItem(LOCAL_WARDROBE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save local wardrobe items:', error);
  }
}

// adds a new item to the start of the list (so newest shows first)
export async function addLocalWardrobeItem(item: LocalWardrobeItem) {
  const existing = await getLocalWardrobeItems();

  const updated = [item, ...existing]; // puts new item at top

  await saveLocalWardrobeItems(updated);
}

// updates one item by id
export async function updateLocalWardrobeItem(
  id: string,
  updates: Partial<LocalWardrobeItem>
) {
  const existing = await getLocalWardrobeItems();

  const updated = existing.map((item) =>
    item.id === id ? { ...item, ...updates } : item // only update matching item
  );

  await saveLocalWardrobeItems(updated);
}

// deletes item by id
export async function deleteLocalWardrobeItem(id: string) {
  const existing = await getLocalWardrobeItems();

  const updated = existing.filter((item) => item.id !== id); // removes it

  await saveLocalWardrobeItems(updated);
}