import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCUIfXeUqW-H60F3dPIfdmzlQbnl1TXWME",
  authDomain: "movigo-adee1.firebaseapp.com",
  projectId: "movigo-adee1",
  storageBucket: "movigo-adee1.firebasestorage.app",
  messagingSenderId: "1098160094657",
  appId: "1:1098160094657:web:7df6bc543423ecd539c340"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);