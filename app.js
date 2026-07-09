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
    // Trigger CPM ad popunder redirection first
    window.open("https://www.effectivecpmnetwork.com/xei3hy1mp?key=d462a9b0cbb2f223b839d43232577337", "_blank");
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
    
    // Initially ONLY show image, title, and description.
    // Wrap system prompt, tags, and copy/share buttons in a collapsed container.
    card.innerHTML = `
      ${imageHTML}
      <div class="card-top">
        <h3 class="card-title">${escapeHTML(p.title)}</h3>
        <span class="card-category-tag">${escapeHTML(p.category)}</span>
      </div>
      <p class="card-description" style="margin-bottom: 12px;">${escapeHTML(p.description)}</p>
      
      <!-- Accordion Button to reveal prompt details -->
      <button class="btn-corporate toggle-prompt-btn" style="width: 100%; justify-content: center; margin-top: 5px; font-size: 0.9rem; padding: 8px 16px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        View Prompt
      </button>

      <!-- Expandable Details Area -->
      <div class="card-expanded-content" style="display: none; border-top: 1px solid var(--border-color); padding-top: 18px; margin-top: 18px;">
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
      </div>
    `;
    
    // Bind toggle buttons
    const toggleBtn = card.querySelector(".toggle-prompt-btn");
    const expandedContent = card.querySelector(".card-expanded-content");
    
    toggleBtn.addEventListener("click", () => {
      const isHidden = expandedContent.style.display === "none";
      expandedContent.style.display = isHidden ? "block" : "none";
      
      if (isHidden) {
        toggleBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
          Hide Prompt
        `;
        toggleBtn.classList.add("secondary");
      } else {
        toggleBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          View Prompt
        `;
        toggleBtn.classList.remove("secondary");
      }
    });

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
      showToast("Link Copied!");
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
// CPM REDIRECTION LOGIC (Trigger exactly every 4 copy actions)
// ---------------------------------------------------------
let copyCounter = parseInt(sessionStorage.getItem("ghor_copy_counter")) || 0;

function triggerCopyRedirection(promptText) {
  // Execute standard copy
  copyPromptToClipboard(promptText);

  // Increment counter
  copyCounter++;
  sessionStorage.setItem("ghor_copy_counter", copyCounter);

  // If threshold (4) reached, open the ad in a new tab and reset
  if (copyCounter >= 4) {
    copyCounter = 0;
    sessionStorage.setItem("ghor_copy_counter", "0");
    window.open("https://www.effectivecpmnetwork.com/xei3hy1mp?key=d462a9b0cbb2f223b839d43232577337", "_blank");
  }
}

// ---------------------------------------------------------
// CLIPBOARD COPY UTILITY
// ---------------------------------------------------------
function copyPromptToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Prompt Copied!");
  }).catch(err => {
    console.error("Clipboard copy failed:", err);
  });
}

// Run Init
window.addEventListener("DOMContentLoaded", init);
