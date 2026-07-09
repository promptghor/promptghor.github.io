// config.js - Application Configurations and Database Bridge

// ---------------------------------------------------------
// FIREBASE CONFIGURATION
// ---------------------------------------------------------
export const firebaseConfig = {
  apiKey: "AIzaSyDLbRRLR0AQuQI1kKjhiZ6mLlPsDl24yDM",
  authDomain: "prompt-library-2050.firebaseapp.com",
  projectId: "prompt-library-2050",
  storageBucket: "prompt-library-2050.firebasestorage.app",
  messagingSenderId: "421767204063",
  appId: "1:421767204063:web:8b805df8116ad6a81a6d6a",
  measurementId: "G-WG3Y0QLZQ6",
  databaseURL: "https://prompt-library-2050-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// ---------------------------------------------------------
// ADMIN SECURITY CONFIGURATION
// ---------------------------------------------------------
// SHA-256 hash of password "Husain2002h" to prevent plaintext exposure
export const ADMIN_HASH = "98db456d318d0c215068cb8776c2c71d6b6aaf26910b0dc722389031ae7179b3";

// ---------------------------------------------------------
// DEFAULT SEED PROMPTS
// ---------------------------------------------------------
// Set to empty array to ensure database starts completely fresh with no pre-loaded prompts
export const DEFAULT_PROMPTS = [];

// ---------------------------------------------------------
// DATABASE BRIDGE (FIREBASE / LOCALSTORAGE DETECTOR)
// ---------------------------------------------------------
let isFirebaseInitialized = false;
let databaseInstance = null;
let fbApp = null;

// New local storage key to force clear old cached hacker prompts from browser storage
const LOCAL_STORAGE_KEY = "prompt_ghor_db";

export async function initializeDatabase(logCallback) {
  if (firebaseConfig.databaseURL && firebaseConfig.databaseURL.trim() !== "") {
    try {
      logCallback("[CONNECTING] Initializing Firebase Handshake...");
      
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js");
      const { getDatabase } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js");

      fbApp = initializeApp(firebaseConfig);
      databaseInstance = getDatabase(fbApp);
      isFirebaseInitialized = true;
      
      logCallback("[OK] Database connection established: FIREBASE REALTIME_DB");
      return { type: "firebase", db: databaseInstance };
    } catch (error) {
      console.error("Firebase init failed, switching to LocalStorage", error);
      logCallback("[WARN] Firebase connection failed. Reverting to LOCAL_STORAGE...");
    }
  }

  // Fallback to LocalStorage
  logCallback("[OK] Database connection established: LOCAL_STORAGE");
  
  if (!localStorage.getItem(LOCAL_STORAGE_KEY)) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_PROMPTS));
    logCallback("[INFO] Local database empty.");
  }
  
  return { type: "local" };
}

// Subscribe to real-time changes
export async function subscribeToPrompts(dbInfo, callback, logCallback) {
  if (dbInfo.type === "firebase") {
    const { ref, onValue } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js");
    const promptsRef = ref(dbInfo.db, "prompts");
    
    // Listen for data
    onValue(promptsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      
      const promptList = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      
      promptList.sort((a, b) => b.createdAt - a.createdAt);
      callback(promptList);
    }, (error) => {
      logCallback(`[ERROR] Firebase Read Failed: ${error.message}`);
    });
  } else {
    // LocalStorage subscription
    const getLocalPrompts = () => {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.sort((a, b) => b.createdAt - a.createdAt);
      return list;
    };
    
    callback(getLocalPrompts());
    
    window.addEventListener("storage_update", () => {
      callback(getLocalPrompts());
    });
  }
}

// Add a new prompt
export async function pushPrompt(dbInfo, promptData, logCallback) {
  const newPrompt = {
    ...promptData,
    createdAt: Date.now()
  };

  if (dbInfo.type === "firebase") {
    const { ref, push, set } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js");
    const promptsRef = ref(dbInfo.db, "prompts");
    const newRef = push(promptsRef);
    await set(newRef, newPrompt);
    logCallback(`[OK] Prompt "${promptData.title}" pushed to Firebase.`);
  } else {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    newPrompt.id = "local-" + Date.now();
    list.push(newPrompt);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    logCallback(`[OK] Prompt "${promptData.title}" saved locally.`);
    window.dispatchEvent(new Event("storage_update"));
  }
}

// Update a prompt
export async function updatePrompt(dbInfo, promptId, promptData, logCallback) {
  if (dbInfo.type === "firebase") {
    const { ref, update } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js");
    const promptRef = ref(dbInfo.db, `prompts/${promptId}`);
    await update(promptRef, promptData);
    logCallback(`[OK] Prompt "${promptData.title}" updated in Firebase.`);
  } else {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    let list = raw ? JSON.parse(raw) : [];
    list = list.map(item => {
      if (item.id === promptId) {
        return { ...item, ...promptData };
      }
      return item;
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    logCallback(`[OK] Prompt "${promptData.title}" updated locally.`);
    window.dispatchEvent(new Event("storage_update"));
  }
}

// Delete a prompt
export async function deletePrompt(dbInfo, promptId, logCallback) {
  if (dbInfo.type === "firebase") {
    const { ref, remove } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js");
    const promptRef = ref(dbInfo.db, `prompts/${promptId}`);
    await remove(promptRef);
    logCallback(`[OK] Prompt removed from Firebase.`);
  } else {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    let list = raw ? JSON.parse(raw) : [];
    list = list.filter(item => item.id !== promptId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    logCallback(`[OK] Prompt removed locally.`);
    window.dispatchEvent(new Event("storage_update"));
  }
}
