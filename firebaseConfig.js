import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCIweb0w-5hzfaUz4ZoVjnPQdfwvB8aSrY",
  authDomain: "ai-wardrobe-assistant-5811b.firebaseapp.com",
  projectId: "ai-wardrobe-assistant-5811b",
  storageBucket: "ai-wardrobe-assistant-5811b.firebasestorage.app",
  messagingSenderId: "315095065340",
  appId: "1:315095065340:web:2aab7e185c2418b1846d79",
  measurementId: "G-M5LR1BF6MS"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);