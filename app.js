// app.js - Corporate Client Portal Script

import { initializeDatabase, subscribeToPrompts } from "./config.js";

// State Management
let allPrompts = [];
let filteredPrompts = [];
let activeCategory = "ALL";
let activeTag = null;
let searchQuery = "";
let dbInfo = null;

// DOM Elements (Loaded on DOMContentLoaded)
let promptsGallery;
let categoryFiltersContainer;
let tagsCloudContainer;
let searchInput;
let copyBanner;

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
  
  const savedTheme = localStorage.getItem("corporate_theme") || "dark";
  
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
  
  // Apply initial theme
  applyTheme(savedTheme);
  
  // Bind click listener
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

  // Init theme toggle
  initTheme();
  
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
      statConnectionState.textContent = dbInfo.type === "firebase" ? "Firebase Database Connected" : "Local Sandbox Active";
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
    
    card.innerHTML = `
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
        <button class="btn-corporate secondary copy-button" data-id="${p.id}" style="padding: 6px 14px; font-size: 0.85rem;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          Copy Prompt
        </button>
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
      copyPromptToClipboard(p.prompt);
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
// CLIPBOARD COPY UTILITY
// ---------------------------------------------------------
function copyPromptToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    if (copyBanner) {
      // Show corporate toast notification banner
      copyBanner.classList.add("visible");
      setTimeout(() => {
        copyBanner.classList.remove("visible");
      }, 2500);
    }
  }).catch(err => {
    console.error("Clipboard copy failed:", err);
  });
}

// Run Init
window.addEventListener("DOMContentLoaded", init);
