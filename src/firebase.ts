import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
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

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const storage = getStorage(app);
