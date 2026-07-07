import { getApps, initializeApp, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const apps = getApps();
const adminApp = apps.length === 0 
  ? initializeApp({ projectId: "climbing-transmitter-rrwfn" }) 
  : getApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp, "ai-studio-voicepipeline-5a6d4661-fdf9-4ad2-ad9f-2bc49ac07c88");
export { adminApp };
