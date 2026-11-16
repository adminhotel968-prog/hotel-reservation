import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
  apiKey: "AIzaSyCzydINVn-Gio9P13K4vsYEBAljbiiRLeg",
  authDomain: "hotel-reservation-d7595.firebaseapp.com",
  projectId: "hotel-reservation-d7595",
  storageBucket: "hotel-reservation-d7595.firebasestorage.app",
  messagingSenderId: "334749495050",
  appId: "1:334749495050:web:55d0df445b5ef6e38914f3",
  measurementId: "G-8W0WVFZJPG"
};


const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
export const db = getFirestore(app);