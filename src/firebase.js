// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAikW-opcIzFdyCyOkY9LXfWm0JHRzOc10",
  authDomain: "voyo-554e7.firebaseapp.com",
  projectId: "voyo-554e7",
  storageBucket: "voyo-554e7.firebasestorage.app",
  messagingSenderId: "410880500289",
  appId: "1:410880500289:web:16bfff93d4357585059cc0",
  measurementId: "G-Y20DLNGMQQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);