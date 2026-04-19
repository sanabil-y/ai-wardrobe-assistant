// react stuff for context + state

import React, { createContext, useContext, useState } from 'react';



// basic shape of one wardrobe item in this context
type WardrobeItem = {
  id: string;
  itemName: string;
  category: string;
  colour: string;
  occasion: string;
};


// what this context gives to the app
type WardrobeContextType = {
  items: WardrobeItem[];
  addItem: (item: Omit<WardrobeItem, 'id'>) => void;
  removeItem: (id: string) => void;
};

// creating the context
const WardrobeContext = createContext<WardrobeContextType | undefined>(undefined);

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  // stores all wardrobe items in state
  const [items, setItems] = useState<WardrobeItem[]>([]);

  // adds a new item into the list
  const addItem = (item: Omit<WardrobeItem, 'id'>) => {
    // gives the item a simple id using current time
    const newItem: WardrobeItem = {
      id: Date.now().toString(),
      ...item,
    };

    // adds new item to the end of current list
    setItems((currentItems) => [...currentItems, newItem]);
  };



  // removes an item by its idd

  const removeItem = (id: string) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== id)
    );
  };

  return (
    // gives wardrobe data + functions to anything inside this provider
    <WardrobeContext.Provider value={{ items, addItem, removeItem }}>
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  // custom hook so using wardrobe context is easier
  const context = useContext(WardrobeContext);

  // safety check so it only works inside the provider
  if (!context) {
    throw new Error('useWardrobe must be used inside WardrobeProvider');
  }

  return context;
}