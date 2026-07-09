// config.js - Application Configurations and Database Bridge

// ---------------------------------------------------------
// FIREBASE CONFIGURATION
// ---------------------------------------------------------
// Linked directly to your Firebase Project "prompt-library-2050"
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
export const ADMIN_PASSCODE = "admin1337";

// ---------------------------------------------------------
// DEFAULT SEED PROMPTS
// ---------------------------------------------------------
// These prompts will seed the database if it is empty.
export const DEFAULT_PROMPTS = [
  {
    id: "seed-1",
    title: "SQL Injection Guard",
    description: "Generates code reviews to identify SQL injection vulnerabilities in backend code snippets.",
    prompt: "You are an expert Cyber Security Auditor. Analyze the following backend code snippet for SQL Injection vulnerabilities. Detail how an attacker could exploit it, provide a proof of concept exploit payload, and rewrite the code using prepared statements or parameterized queries to fix the flaw. Here is the code:\n\n[INSERT CODE HERE]",
    category: "Coding",
    tags: ["security", "sql-injection", "audit", "backend"],
    createdAt: Date.now() - 3600000 * 24
  },
  {
    id: "seed-2",
    title: "Social Engineering Sandbox Simulator",
    description: "Set up an interactive phishing awareness simulator to train employees against social engineering.",
    prompt: "I want you to act as a simulated phishing target. You will play the role of an average corporate employee who is busy, slightly distracted, and not tech-savvy. I will play the role of a phishing attacker attempting to trick you into clicking a link, downloading a file, or giving up credentials. Start the simulation by saying 'System Ready. Awaiting initial contact.' Do not break character. React realistically based on how suspicious or urgent my messages are. Give me feedback at the end on how I did.",
    category: "Social Engineering",
    tags: ["phishing", "training", "simulator", "education"],
    createdAt: Date.now() - 3600000 * 12
  },
  {
    id: "seed-3",
    title: "Cyberpunk Hacker Portrait Generator",
    description: "Midjourney/Stable Diffusion prompt for generating high-tech neon hacker avatars.",
    prompt: "Cinematic portrait of a cyberpunk hacker wearing a glowing visor, sitting in front of complex computer screens showing red code, retro-futuristic mechanical keyboard, dark atmosphere with volumetric smoke, neon red and crimson backlighting, ultra-detailed, Unreal Engine 5 render, 8k resolution, aspect ratio 16:9 --ar 16:9 --v 6.0",
    category: "Graphics",
    tags: ["midjourney", "cyberpunk", "art", "avatar"],
    createdAt: Date.now() - 3600000 * 6
  },
  {
    id: "seed-4",
    title: "Nmap Terminal Assistant",
    description: "Translates high-level network scanning objectives into precise, optimized Nmap command lines.",
    prompt: "You are a master network security administrator. I will describe a network scan objective, and you will output the exact nmap command syntax. For each command, explain exactly what each flag does (e.g. -sS, -T4, -p-, -sV), why you chose it, and outline the safety/stealth implications of the scan. My first scan objective: I need to scan a target network range 192.168.1.0/24 to find only active web servers running on ports 80, 443, or 8080 as quickly and stealthily as possible.",
    category: "Network Scanning",
    tags: ["nmap", "commands", "recon", "stealth"],
    createdAt: Date.now() - 3600000 * 2
  }
];

// ---------------------------------------------------------
// DATABASE BRIDGE (FIREBASE / LOCALSTORAGE DETECTOR)
// ---------------------------------------------------------
let isFirebaseInitialized = false;
let databaseInstance = null;
let fbApp = null;

// Dynamic imports are done inside initialize to handle situations where script runs directly
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
  
  if (!localStorage.getItem("hacker_prompts")) {
    localStorage.setItem("hacker_prompts", JSON.stringify(DEFAULT_PROMPTS));
    logCallback("[INFO] Local database empty. Seeded default data.");
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
        logCallback("[INFO] Firebase DB is empty. Seeding default corporate prompts...");
        DEFAULT_PROMPTS.forEach(p => {
          pushPrompt(dbInfo, p, () => {});
        });
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
      const raw = localStorage.getItem("hacker_prompts");
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
    const raw = localStorage.getItem("hacker_prompts");
    const list = raw ? JSON.parse(raw) : [];
    newPrompt.id = "local-" + Date.now();
    list.push(newPrompt);
    localStorage.setItem("hacker_prompts", JSON.stringify(list));
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
    const raw = localStorage.getItem("hacker_prompts");
    let list = raw ? JSON.parse(raw) : [];
    list = list.map(item => {
      if (item.id === promptId) {
        return { ...item, ...promptData };
      }
      return item;
    });
    localStorage.setItem("hacker_prompts", JSON.stringify(list));
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
    const raw = localStorage.getItem("hacker_prompts");
    let list = raw ? JSON.parse(raw) : [];
    list = list.filter(item => item.id !== promptId);
    localStorage.setItem("hacker_prompts", JSON.stringify(list));
    logCallback(`[OK] Prompt removed locally.`);
    window.dispatchEvent(new Event("storage_update"));
  }
}
