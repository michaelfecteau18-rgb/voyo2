import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAikW-opcIzFdyCyOkY9LXfWm0JHRzOc10",
  authDomain: "voyo-554e7.firebaseapp.com",
  projectId: "voyo-554e7",
  storageBucket: "voyo-554e7.firebasestorage.app",
  messagingSenderId: "410880500289",
  appId: "1:410880500289:web:16bfff93d4357585059cc0",
  measurementId: "G-Y20DLNGMQQ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

const analytics =
  typeof window !== "undefined"
    ? getAnalytics(app)
    : null;

export { app, analytics };