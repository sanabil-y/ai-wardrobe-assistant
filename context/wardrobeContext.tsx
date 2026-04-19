import React, { createContext, useContext, useState } from 'react';

type WardrobeItem = {
  id: string;
  itemName: string;
  category: string;
  colour: string;
  occasion: string;
};

type WardrobeContextType = {
  items: WardrobeItem[];
  addItem: (item: Omit<WardrobeItem, 'id'>) => void;
  removeItem: (id: string) => void;
};

const WardrobeContext = createContext<WardrobeContextType | undefined>(undefined);

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WardrobeItem[]>([]);

  const addItem = (item: Omit<WardrobeItem, 'id'>) => {
    const newItem: WardrobeItem = {
      id: Date.now().toString(),
      ...item,
    };

    setItems((currentItems) => [...currentItems, newItem]);
  };

  const removeItem = (id: string) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== id)
    );
  };

  return (
    <WardrobeContext.Provider value={{ items, addItem, removeItem }}>
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  const context = useContext(WardrobeContext);

  if (!context) {
    throw new Error('useWardrobe must be used inside WardrobeProvider');
  }

  return context;
}