import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAHU5Fltk9cV-cTFMnUWeF6JzPeDu7hM8c",
  authDomain: "nawab-degital-store.firebaseapp.com",
  databaseURL: "https://nawab-degital-store-default-rtdb.firebaseio.com",
  projectId: "nawab-degital-store",
  storageBucket: "nawab-degital-store.firebasestorage.app",
  messagingSenderId: "607575142255",
  appId: "1:607575142255:web:c4815e2bffba4e67d6029a",
  measurementId: "G-4ZPPJS2BZL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const EMAILJS_CONFIG = {
  PUBLIC_KEY: "YOUR_EMAILJS_PUBLIC_KEY",
  SERVICE_ID: "YOUR_EMAILJS_SERVICE_ID",
  TEMPLATE_ID: "YOUR_EMAILJS_TEMPLATE_ID" // Variables: {{to_email}}, {{to_name}}, {{otp_code}}
};

// Hidden Admin Secret PIN
export const ADMIN_SECRET_PIN = "NAWAB@2026";
