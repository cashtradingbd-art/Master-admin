import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// কনফিগারেশন - আপনার ফায়ারবেস কনসোল থেকে নেওয়া
// Note: In a real app, these should be environment variables.
// Based on the user's provided screenshot.
const firebaseConfig = {
  apiKey: "AIzaSyCPIqcoNsqf68rs1JkGVN5Tr5oTBIMSYRA",
  authDomain: "fast-trading-e6f04.firebaseapp.com",
  databaseURL: "https://fast-trading-e6f04-default-rtdb.firebaseio.com",
  projectId: "fast-trading-e6f04",
  storageBucket: "fast-trading-e6f04.firebasestorage.app",
  messagingSenderId: "906520113275",
  appId: "1:906520113275:web:8e1fca4c5665b5bed1b2de",
  measurementId: "G-BZXWD6SPDX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;