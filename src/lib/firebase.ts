import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBBVR9WYekpP1F8o6hUGyY-NWPFrHOFyAs",
  authDomain: "climbing-transmitter-rrwfn.firebaseapp.com",
  projectId: "climbing-transmitter-rrwfn",
  storageBucket: "climbing-transmitter-rrwfn.firebasestorage.app",
  messagingSenderId: "536493724718",
  appId: "1:536493724718:web:59bac4047a679e5d50fbbf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-voicepipeline-5a6d4661-fdf9-4ad2-ad9f-2bc49ac07c88");
