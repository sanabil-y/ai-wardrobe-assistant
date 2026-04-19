import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCAL_WARDROBE_KEY = 'local_wardrobe_items_v1';

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
  localOnly: true;
};

export async function getLocalWardrobeItems(): Promise<LocalWardrobeItem[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_WARDROBE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Failed to load local wardrobe items:', error);
    return [];
  }
}

export async function saveLocalWardrobeItems(items: LocalWardrobeItem[]) {
  try {
    await AsyncStorage.setItem(LOCAL_WARDROBE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save local wardrobe items:', error);
  }
}

export async function addLocalWardrobeItem(item: LocalWardrobeItem) {
  const existing = await getLocalWardrobeItems();
  const updated = [item, ...existing];
  await saveLocalWardrobeItems(updated);
}

export async function updateLocalWardrobeItem(
  id: string,
  updates: Partial<LocalWardrobeItem>
) {
  const existing = await getLocalWardrobeItems();

  const updated = existing.map((item) =>
    item.id === id ? { ...item, ...updates } : item
  );

  await saveLocalWardrobeItems(updated);
}

export async function deleteLocalWardrobeItem(id: string) {
  const existing = await getLocalWardrobeItems();
  const updated = existing.filter((item) => item.id !== id);
  await saveLocalWardrobeItems(updated);
}