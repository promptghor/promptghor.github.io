// app.js - Corporate Client Portal Script

import { initializeDatabase, subscribeToPrompts } from "./config.js?v=2";

// State Management
let allPrompts = [];
let filteredPrompts = [];
let activeCategory = "ALL";
let activeTag = null;
let searchQuery = "";
let dbInfo = null;

// Share Mode State
let shareModeActive = false;
let sharedPromptId = null;

// DOM Elements (Loaded on DOMContentLoaded)
let promptsGallery;
let categoryFiltersContainer;
let tagsCloudContainer;
let searchInput;
let copyBanner;
let searchSection;
let categoryNav;
let dashboardSidebar;

// Stats Elements
let statPromptCount;
let statCategoryCount;
let statConnectionState;

// Helper to escape HTML characters
function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------
// THEME SWITCHER LOGIC
// ---------------------------------------------------------
function initTheme() {
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themeIconSun = document.getElementById("theme-icon-sun");
  const themeIconMoon = document.getElementById("theme-icon-moon");
  
  if (!themeToggleBtn) return;
  
  const savedTheme = localStorage.getItem("corporate_theme") || "light";
  
  const applyTheme = (theme) => {
    if (theme === "light") {
      document.body.classList.add("light-theme");
      if (themeIconSun) themeIconSun.style.display = "inline-block";
      if (themeIconMoon) themeIconMoon.style.display = "none";
    } else {
      document.body.classList.remove("light-theme");
      if (themeIconSun) themeIconSun.style.display = "none";
      if (themeIconMoon) themeIconMoon.style.display = "inline-block";
    }
  };
  
  applyTheme(savedTheme);
  
  themeToggleBtn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-theme");
    const currentTheme = isLight ? "light" : "dark";
    localStorage.setItem("corporate_theme", currentTheme);
    applyTheme(currentTheme);
  });
}

// ---------------------------------------------------------
// CORE APP INITIALIZATION
// ---------------------------------------------------------
async function init() {
  // Bind DOM References safely
  promptsGallery = document.getElementById("prompts-gallery");
  categoryFiltersContainer = document.getElementById("category-filters-container");
  tagsCloudContainer = document.getElementById("tags-cloud-container");
  searchInput = document.getElementById("prompt-search-input");
  copyBanner = document.getElementById("copy-banner");
  statPromptCount = document.getElementById("stat-prompts-count");
  statCategoryCount = document.getElementById("stat-categories-count");
  statConnectionState = document.getElementById("stat-connection-state");
  
  // Layout wrappers to hide in share mode
  searchSection = document.getElementById("search-section");
  categoryNav = document.getElementById("category-filters-container");
  dashboardSidebar = document.getElementById("dashboard-sidebar");

  // Init theme toggle
  initTheme();
  
  // Check for shared prompt parameter in URL (?p=PROMPT_ID)
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get("p");
  if (shareId) {
    shareModeActive = true;
    sharedPromptId = shareId;
    
    // Hide standard elements for share view
    if (searchSection) searchSection.style.display = "none";
    if (categoryNav) categoryNav.style.display = "none";
    if (dashboardSidebar) dashboardSidebar.style.display = "none";
    
    // Force grid to single column layout
    const gridLayout = document.getElementById("main-grid-layout");
    if (gridLayout) {
      gridLayout.style.gridTemplateColumns = "1fr";
    }
  }
  
  // Bind search input listener
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      applyFiltersAndRender();
    });
  }

  try {
    // Connect to database (Firebase or LocalStorage fallback)
    dbInfo = await initializeDatabase((msg) => {
      console.log(`[DB Diagnostic] ${msg}`);
    });

    // Update connection indicator
    if (statConnectionState) {
      statConnectionState.textContent = dbInfo.type === "firebase" ? "Cloud Database Connected" : "Local Sandbox Active";
      statConnectionState.style.color = dbInfo.type === "firebase" ? "#10b981" : "#f59e0b";
    }

    // Subscribe to prompts in real-time
    subscribeToPrompts(dbInfo, (prompts) => {
      allPrompts = prompts;
      
      // Update UI elements
      buildFilters();
      applyFiltersAndRender();
    }, (errorMsg) => {
      console.error(`Database error: ${errorMsg}`);
    });

  } catch (err) {
    console.error("Critical initialization failure:", err);
  }
}

// ---------------------------------------------------------
// DYNAMIC FILTER GENERATOR
// ---------------------------------------------------------
function buildFilters() {
  if (shareModeActive) return; // Skip building filters in share mode
  if (!categoryFiltersContainer || !tagsCloudContainer) return;

  // Extract unique categories
  const categories = ["ALL", ...new Set(allPrompts.map(p => p.category).filter(Boolean))];
  
  // Render Category Tabs/Pills
  categoryFiltersContainer.innerHTML = "";
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `category-pill ${activeCategory === cat ? "active" : ""}`;
    btn.textContent = cat === "ALL" ? "All Prompts" : cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      
      // Update active state classes
      document.querySelectorAll(".category-pill").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      
      applyFiltersAndRender();
    });
    categoryFiltersContainer.appendChild(btn);
  });
  
  // Extract unique tags
  const tags = [...new Set(allPrompts.flatMap(p => p.tags || []).filter(Boolean))];
  
  // Render Tags Cloud
  tagsCloudContainer.innerHTML = "";
  tags.forEach(tag => {
    const chip = document.createElement("button");
    chip.className = `tag-chip ${activeTag === tag ? "active" : ""}`;
    chip.textContent = `${tag}`;
    chip.addEventListener("click", () => {
      if (activeTag === tag) {
        activeTag = null; // Toggle off
      } else {
        activeTag = tag;
      }
      applyFiltersAndRender();
    });
    tagsCloudContainer.appendChild(chip);
  });

  // Update Stats Widget values
  if (statPromptCount) statPromptCount.textContent = allPrompts.length;
  if (statCategoryCount) statCategoryCount.textContent = categories.length - 1; // subtract 'ALL'
}

// ---------------------------------------------------------
// FILTER LOGIC & RENDERING
// ---------------------------------------------------------
function applyFiltersAndRender() {
  if (shareModeActive) {
    renderSharedPrompt();
    return;
  }

  filteredPrompts = allPrompts.filter(p => {
    // Category check
    if (activeCategory !== "ALL" && p.category !== activeCategory) {
      return false;
    }
    
    // Tag check
    if (activeTag && (!p.tags || !p.tags.includes(activeTag))) {
      return false;
    }
    
    // Search query check
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title && p.title.toLowerCase().includes(q);
      const matchDesc = p.description && p.description.toLowerCase().includes(q);
      const matchPrompt = p.prompt && p.prompt.toLowerCase().includes(q);
      const matchCategory = p.category && p.category.toLowerCase().includes(q);
      const matchTags = p.tags && p.tags.some(tag => tag.toLowerCase().includes(q));
      
      if (!matchTitle && !matchDesc && !matchPrompt && !matchCategory && !matchTags) {
        return false;
      }
    }
    
    return true;
  });

  renderPrompts();
}

// Render direct shared prompt preview
function renderSharedPrompt() {
  if (!promptsGallery) return;
  promptsGallery.innerHTML = "";
  
  const p = allPrompts.find(item => item.id === sharedPromptId);
  
  if (!p) {
    promptsGallery.innerHTML = `
      <div class="no-records">
        Shared prompt not found or has been removed from database.
        <br><br>
        <button class="btn-corporate" id="btn-back-home">Go to Prompt Ghor</button>
      </div>
    `;
    document.getElementById("btn-back-home").addEventListener("click", resetToMainView);
    return;
  }
  
  // Render simplified preview card
  const card = document.createElement("article");
  card.className = "corporate-card";
  card.style.cursor = "pointer";
  card.style.padding = "40px";
  card.style.textAlign = "center";
  
  // Optional Cover image inside shared card
  let imageHTML = "";
  if (p.image) {
    imageHTML = `<img src="${p.image}" class="card-image-header" alt="${escapeHTML(p.title)} Cover" style="margin-bottom: 25px; border-radius: 8px;">`;
  } else {
    imageHTML = `
      <div style="margin-bottom: 20px; color: var(--accent-red);">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
      </div>
    `;
  }
  
  card.innerHTML = `
    ${imageHTML}
    <h2 class="card-title" style="font-size: 1.8rem; margin-bottom: 15px;">${escapeHTML(p.title)}</h2>
    <p class="card-description" style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 30px; line-height: 1.6;">${escapeHTML(p.description)}</p>
    <button class="btn-corporate" style="font-size: 1rem; padding: 12px 30px;">Reveal Full Prompt & Copy</button>
  `;
  
  card.addEventListener("click", () => {
    // Highlight and show this exact prompt in main view
    resetToMainView(p.id);
  });
  
  promptsGallery.appendChild(card);
}

function resetToMainView(targetId = null) {
  shareModeActive = false;
  sharedPromptId = null;
  
  // Restore layout elements display
  if (searchSection) searchSection.style.display = "block";
  if (categoryNav) categoryNav.style.display = "flex";
  if (dashboardSidebar) dashboardSidebar.style.display = "flex";
  
  const gridLayout = document.getElementById("main-grid-layout");
  if (gridLayout) {
    gridLayout.style.gridTemplateColumns = ""; // restore grid split
  }
  
  // Clean URL query parameters
  window.history.pushState({}, document.title, window.location.pathname);
  
  // If target prompt was passed, filter to highlight it specifically
  if (typeof targetId === "string") {
    const targetPrompt = allPrompts.find(item => item.id === targetId);
    if (targetPrompt) {
      searchQuery = targetPrompt.title;
      if (searchInput) searchInput.value = targetPrompt.title;
    }
  }
  
  buildFilters();
  applyFiltersAndRender();
}

// Render cards to gallery
function renderPrompts() {
  if (!promptsGallery) return;
  promptsGallery.innerHTML = "";
  
  if (filteredPrompts.length === 0) {
    promptsGallery.innerHTML = `
      <div class="no-records">
        No prompts match your search query. Try another keyword.
      </div>
    `;
    return;
  }
  
  filteredPrompts.forEach(p => {
    const card = document.createElement("article");
    card.className = "corporate-card";
    
    // Format Tags
    const tagsHTML = (p.tags || []).map(tag => `
      <span class="tag-badge" data-tag="${tag}">${tag}</span>
    `).join("");
    
    // Optional Image header
    let imageHTML = "";
    if (p.image) {
      imageHTML = `<img src="${p.image}" class="card-image-header" alt="${escapeHTML(p.title)} Cover">`;
    }
    
    card.innerHTML = `
      ${imageHTML}
      <div class="card-top">
        <h3 class="card-title">${escapeHTML(p.title)}</h3>
        <span class="card-category-tag">${escapeHTML(p.category)}</span>
      </div>
      <p class="card-description">${escapeHTML(p.description)}</p>
      
      <div class="card-content-block">
        <pre class="card-prompt-text" id="prompt-text-${p.id}">${escapeHTML(p.prompt)}</pre>
      </div>
      
      <div class="card-footer">
        <div class="tags-container">
          ${tagsHTML}
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-corporate secondary share-button" data-id="${p.id}" style="padding: 6px 14px; font-size: 0.85rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share
          </button>
          <button class="btn-corporate secondary copy-button" data-id="${p.id}" style="padding: 6px 14px; font-size: 0.85rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            Copy
          </button>
        </div>
      </div>
    `;
    
    // Add Click listeners for tags inside the card
    card.querySelectorAll(".tag-badge").forEach(badge => {
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        const tag = badge.dataset.tag;
        activeTag = (activeTag === tag) ? null : tag;
        applyFiltersAndRender();
      });
    });
    
    // Add Copy listener
    const copyBtn = card.querySelector(".copy-button");
    copyBtn.addEventListener("click", () => {
      triggerCopyRedirection(p.prompt);
    });

    // Add Share listener
    const shareBtn = card.querySelector(".share-button");
    shareBtn.addEventListener("click", () => {
      executeSharePrompt(p);
    });
    
    promptsGallery.appendChild(card);
  });

  // Re-sync visual tag cloud states
  document.querySelectorAll(".tag-chip").forEach(chip => {
    if (chip.textContent.trim() === activeTag) {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });
}

// ---------------------------------------------------------
// SHARE UTILITY (WEB SHARE API WITH CLIPBOARD FALLBACK)
// ---------------------------------------------------------
function executeSharePrompt(prompt) {
  const shareUrl = `${window.location.origin}${window.location.pathname}?p=${prompt.id}`;
  const shareData = {
    title: `Prompt: ${prompt.title}`,
    text: prompt.description,
    url: shareUrl
  };
  
  // Check if Native browser share is supported and available
  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    navigator.share(shareData)
      .then(() => console.log("Successful native share!"))
      .catch((error) => {
        // user cancelled or failed, fallback to clipboard silently
        console.log("Native share failed/cancelled:", error);
      });
  } else {
    // Fallback to Clipboard Copy
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast("Share link copied to clipboard!");
    }).catch(err => {
      console.error("Share link copy failed:", err);
    });
  }
}

// ---------------------------------------------------------
// TOAST BANNER UTILITY
// ---------------------------------------------------------
function showToast(message) {
  if (copyBanner) {
    const originalContent = copyBanner.innerHTML;
    copyBanner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>${message}`;
    copyBanner.classList.add("visible");
    setTimeout(() => {
      copyBanner.classList.remove("visible");
      setTimeout(() => {
        copyBanner.innerHTML = originalContent;
      }, 300);
    }, 2500);
  }
}

// ---------------------------------------------------------
// CPM REDIRECTION LOGIC
// ---------------------------------------------------------
let copyCounter = parseInt(sessionStorage.getItem("ghor_copy_counter")) || 0;
let redirectThreshold = parseInt(sessionStorage.getItem("ghor_redirect_threshold")) || (Math.random() < 0.5 ? 2 : 3);

function triggerCopyRedirection(promptText) {
  // Execute standard copy
  copyPromptToClipboard(promptText);

  // Increment counter
  copyCounter++;
  sessionStorage.setItem("ghor_copy_counter", copyCounter);

  // If threshold reached, open the ad in a new tab and reset
  if (copyCounter >= redirectThreshold) {
    copyCounter = 0;
    sessionStorage.setItem("ghor_copy_counter", "0");
    
    // Choose new threshold: randomly 2 or 3
    const nextThreshold = Math.random() < 0.5 ? 2 : 3;
    sessionStorage.setItem("ghor_redirect_threshold", nextThreshold);

    // Open target redirection link
    window.open("https://www.effectivecpmnetwork.com/xei3hy1mp?key=d462a9b0cbb2f223b839d43232577337", "_blank");
  }
}

// ---------------------------------------------------------
// CLIPBOARD COPY UTILITY
// ---------------------------------------------------------
function copyPromptToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Prompt successfully copied to clipboard!");
  }).catch(err => {
    console.error("Clipboard copy failed:", err);
  });
}

// Run Init
window.addEventListener("DOMContentLoaded", init);
