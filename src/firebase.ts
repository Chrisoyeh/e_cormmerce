import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  projectId: "nazareth-e739f",
  appId: "1:28927657947:web:21d87c093bc7bf997b09fe",
  storageBucket: "nazareth-e739f.firebasestorage.app",
  apiKey: "AIzaSyBuSuuJkRBMjyiJbfw5X2ehU7Fo8syeBqo",
  authDomain: "nazareth-e739f.firebaseapp.com",
  messagingSenderId: "28927657947",
  measurementId: "G-6DFXGX64ZF"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

