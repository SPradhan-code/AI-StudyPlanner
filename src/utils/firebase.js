import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC1AzuwktjY71V-fM0DYo5Zjv9vAz0ZExA",
  authDomain: "ai-study-planner-5781f.firebaseapp.com",
  projectId: "ai-study-planner-5781f",
  storageBucket: "ai-study-planner-5781f.firebasestorage.app",
  messagingSenderId: "1094401951514",
  appId: "1:1094401951514:web:f9c5b4e54936e01bfb8ea3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Saves or updates user study plan data in Firestore.
 * @param {string} uid - The unique authenticated user ID
 * @param {object} data - The configuration data, subjects list, and checklist state
 */
export async function saveUserData(uid, data) {
  try {
    const userDocRef = doc(db, "users", uid);
    await setDoc(userDocRef, data, { merge: true });
  } catch (error) {
    console.error("Error saving user data to Firestore:", error);
    throw error;
  }
}

/**
 * Retrieves study plan data from Firestore.
 * @param {string} uid - The unique authenticated user ID
 * @returns {object|null} - The user document data or null if it doesn't exist
 */
export async function getUserData(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching user data from Firestore:", error);
    throw error;
  }
}
