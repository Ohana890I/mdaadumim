import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDo7XiejY9SVDAsB-gd7lCt3dHFChWIEXg",
  authDomain: "mdaadumim.firebaseapp.com",
  projectId: "mdaadumim",
  storageBucket: "mdaadumim.firebasestorage.app",
  messagingSenderId: "283751706364",
  appId: "1:283751706364:web:a59288a426eb7f8aee7179",
  measurementId: "G-LWVQC14K64"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;