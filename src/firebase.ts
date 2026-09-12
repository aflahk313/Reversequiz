import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCy__B2cDhvJ5kEuW8IOijDZdqQ4k0E6XA",
  authDomain: "quriverse-reverse-quiz.firebaseapp.com",
  databaseURL:
    "https://quriverse-reverse-quiz-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "quriverse-reverse-quiz",
  storageBucket: "quriverse-reverse-quiz.firebasestorage.app",
  messagingSenderId: "572717113906",
  appId: "1:572717113906:web:cbf65df6189a792c1e122b",
  measurementId: "G-DPTKY9KN4X",
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
