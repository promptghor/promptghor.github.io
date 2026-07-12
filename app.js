// app.js - Corporate Client Portal Script

import { initializeDatabase, subscribeToPrompts } from "./config.js?v=2";

// State Management
let allPrompts = [];
let filteredPrompts = [];
let activeCategory = "ALL";
let activeTag = null;
let searchQuery = "";
let dbInfo = null;

// Pagination State
let currentPage = 1;
const CARDS_PER_PAGE = 6;

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
let paginationContainer;
let recentViewedPanel;
let recentViewedList;

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
  
  // Neutral light theme default, dark theme toggled
  const savedTheme = localStorage.getItem("corporate_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
  
  const applyTheme = (theme) => {
    if (theme === "dark") {
      document.body.classList.add("dark-theme");
      if (themeIconSun) themeIconSun.style.display = "inline-block";
      if (themeIconMoon) themeIconMoon.style.display = "none";
    } else {
      document.body.classList.remove("dark-theme");
      if (themeIconSun) themeIconSun.style.display = "none";
      if (themeIconMoon) themeIconMoon.style.display = "inline-block";
    }
  };
  
  applyTheme(initialTheme);
  
  themeToggleBtn.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-theme");
    const currentTheme = isDark ? "dark" : "light";
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
  paginationContainer = document.getElementById("pagination-container");
  recentViewedPanel = document.getElementById("recent-viewed-panel");
  recentViewedList = document.getElementById("recent-viewed-list");
  
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
    if (recentViewedPanel) recentViewedPanel.style.display = "none";
    
    // Force grid to single column layout
    const gridLayout = document.getElementById("main-grid-layout");
    if (gridLayout) {
      gridLayout.style.gridTemplateColumns = "1fr";
    }
    
    // Log recently viewed
    trackRecentlyViewed(shareId);
  }
  
  // Bind search input listener
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      currentPage = 1; // Reset to page 1 on search
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
      renderRecentlyViewedRow();
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
// RECENTLY VIEWED TRACKING (LocalStorage, Not Firebase)
// ---------------------------------------------------------
function trackRecentlyViewed(promptId) {
  try {
    let recent = JSON.parse(localStorage.getItem("recently_viewed_prompts")) || [];
    // Remove if already exists to push it to top
    recent = recent.filter(id => id !== promptId);
    recent.unshift(promptId);
    // Limit to 5 items
    if (recent.length > 5) {
      recent.pop();
    }
    localStorage.setItem("recently_viewed_prompts", JSON.stringify(recent));
  } catch (err) {
    console.error("Failed to update recently viewed:", err);
  }
}

function renderRecentlyViewedRow() {
  if (shareModeActive || !recentViewedPanel || !recentViewedList) return;
  
  try {
    const recentIds = JSON.parse(localStorage.getItem("recently_viewed_prompts")) || [];
    if (recentIds.length === 0) {
      recentViewedPanel.style.display = "none";
      return;
    }
    
    recentViewedList.innerHTML = "";
    let count = 0;
    
    recentIds.forEach(id => {
      const p = allPrompts.find(item => item.id === id);
      if (p) {
        count++;
        const card = document.createElement("a");
        card.className = "recent-card";
        card.href = `?p=${p.id}`;
        card.innerHTML = `
          <div style="font-size: 0.72rem; color: var(--accent-color); font-weight: 600; margin-bottom: 4px; text-transform: uppercase;">
            ${escapeHTML(p.category)}
          </div>
          <div class="recent-card-title">${escapeHTML(p.title)}</div>
        `;
        recentViewedList.appendChild(card);
      }
    });
    
    if (count > 0) {
      recentViewedPanel.style.display = "block";
    } else {
      recentViewedPanel.style.display = "none";
    }
  } catch (err) {
    console.error("Error rendering recently viewed:", err);
    recentViewedPanel.style.display = "none";
  }
}

// ---------------------------------------------------------
// DYNAMIC FILTER GENERATOR
// ---------------------------------------------------------
function buildFilters() {
  if (shareModeActive) return; // Skip building filters in share mode
  if (!categoryFiltersContainer) return;

  // Extract unique categories
  const categories = ["ALL", ...new Set(allPrompts.map(p => p.category).filter(Boolean))];
  
  // Render Category Tabs/Pills
  categoryFiltersContainer.innerHTML = "";
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `category-pill ${activeCategory === cat ? "active" : ""}`;
    btn.textContent = cat === "ALL" ? "সকল প্রম্পট (All)" : cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      currentPage = 1; // Reset to page 1 on category change
      
      // Update active state classes
      document.querySelectorAll(".category-pill").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      
      applyFiltersAndRender();
    });
    categoryFiltersContainer.appendChild(btn);
  });
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
  renderPaginationControls();
}

// ---------------------------------------------------------
// PAGE 3: SHARE / PROMPT DETAIL PAGE VIEW
// ---------------------------------------------------------
function renderSharedPrompt() {
  if (!promptsGallery) return;
  promptsGallery.innerHTML = "";
  if (paginationContainer) paginationContainer.innerHTML = "";
  
  const p = allPrompts.find(item => item.id === sharedPromptId);
  
  if (!p) {
    promptsGallery.innerHTML = `
      <div class="no-records">
        দুঃখিত, প্রম্পটটি পাওয়া যায়নি অথবা ডাটাবেস থেকে মুছে ফেলা হয়েছে।
        <br><br>
        <button class="btn-corporate" id="btn-back-home">প্রধান পাতায় ফিরে যান</button>
      </div>
    `;
    document.getElementById("btn-back-home").addEventListener("click", resetToMainView);
    return;
  }
  
  // Format Model Badge
  const model = (p.model || "").trim().toLowerCase();
  let badgeClass = "model-badge-generic";
  let badgeLabel = p.model || "Unknown";
  if (model.includes("chatgpt") || model.includes("gpt")) {
    badgeClass = "model-badge-chatgpt";
    badgeLabel = "ChatGPT";
  } else if (model.includes("gemini")) {
    badgeClass = "model-badge-gemini";
    badgeLabel = "Gemini";
  } else if (model.includes("claude")) {
    badgeClass = "model-badge-claude";
    badgeLabel = "Claude";
  }
  
  const mockViews = Math.floor(((p.createdAt || Date.now()) % 890) + 110) + " views";
  
  // Cover image check
  let imageHTML = "";
  if (p.image) {
    imageHTML = `<img src="${p.image}" class="detail-header-image" alt="${escapeHTML(p.title)} Cover">`;
  }
  
  // Explanation block (fallback check if missing in database)
  const explanation = p.whyWorks || "এই প্রম্পটটি এআই মডেলের সাথে নিখুঁত ইন্টারেকশন নিশ্চিত করার জন্য কাঠামোগতভাবে সাজানো হয়েছে। এটি সঠিক নির্দেশনা দিতে সাহায্য করবে।";
  
  const container = document.createElement("div");
  container.className = "prompt-detail-container";
  
  container.innerHTML = `
    <article class="prompt-detail-card">
      ${imageHTML}
      <div class="detail-meta-row">
        <span class="model-badge ${badgeClass}">${badgeLabel}</span>
        <span class="view-count">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
          ${mockViews}
        </span>
      </div>
      <h2 class="detail-title">${escapeHTML(p.title)}</h2>
      <p class="detail-desc">${escapeHTML(p.description)}</p>
      
      <!-- Primary Copyable block -->
      <div class="detail-prompt-block">
        <pre class="detail-prompt-text" id="detail-prompt-body">${escapeHTML(p.prompt)}</pre>
      </div>
      
      <!-- Action buttons below prompt -->
      <div class="detail-actions">
        <button class="btn-corporate" id="detail-copy-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          কপি করুন (Copy)
        </button>
        <button class="btn-corporate secondary btn-square" id="detail-share-btn" aria-label="Share Prompt">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
      
      <!-- Inline Ad Placement - Never interrupting the prompt content itself -->
      <div style="margin: 25px 0; border-top: 1px solid var(--border-color); padding-top: 20px;">
        <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 10px;">Sponsored Advertisement</span>
        <div style="display: flex; justify-content: center; align-items: center; background-color: var(--bg-tertiary); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
          <!-- Reuse Banner 300x250 ad container or iframe loader -->
          <div style="width: 300px; height: 100px; background-color: var(--border-color); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: var(--text-muted); border-radius: 4px;">SPONSORED AD SLOT</div>
        </div>
      </div>
    </article>
    
    <!-- Related Prompts Grid Section at the bottom as traffic driver -->
    <section class="related-prompts-section">
      <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">সম্পর্কিত অন্যান্য প্রম্পট (Related Prompts)</h3>
      <div class="prompts-list" id="related-prompts-grid">
        <!-- Rendered dynamically -->
      </div>
    </section>
  `;
  
  // Bind Detail actions
  container.querySelector("#detail-copy-btn").addEventListener("click", () => {
    triggerCopyRedirection(p.prompt);
  });
  
  container.querySelector("#detail-share-btn").addEventListener("click", () => {
    executeSharePrompt(p);
  });
  
  promptsGallery.appendChild(container);
  
  // Render Related Prompts Grid
  renderRelatedPrompts(p);
}

function renderRelatedPrompts(currentPrompt) {
  const grid = document.getElementById("related-prompts-grid");
  if (!grid) return;
  grid.innerHTML = "";
  
  // Filter prompts from the same category, excluding current one
  let related = allPrompts.filter(item => item.category === currentPrompt.category && item.id !== currentPrompt.id);
  // Fallback to general list if not enough category matches
  if (related.length < 3) {
    related = allPrompts.filter(item => item.id !== currentPrompt.id);
  }
  
  // Slice to max 3 related suggestions
  related = related.slice(0, 3);
  
  if (related.length === 0) {
    grid.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">কোন সম্পর্কিত প্রম্পট পাওয়া যায়নি।</div>`;
    return;
  }
  
  related.forEach(item => {
    const card = document.createElement("article");
    card.className = "corporate-card";
    
    const model = (item.model || "").trim().toLowerCase();
    let badgeClass = "model-badge-generic";
    let badgeLabel = item.model || "Unknown";
    if (model.includes("chatgpt") || model.includes("gpt")) {
      badgeClass = "model-badge-chatgpt";
      badgeLabel = "ChatGPT";
    } else if (model.includes("gemini")) {
      badgeClass = "model-badge-gemini";
      badgeLabel = "Gemini";
    } else if (model.includes("claude")) {
      badgeClass = "model-badge-claude";
      badgeLabel = "Claude";
    }
    
    card.innerHTML = `
      <div class="card-top-row">
        <span class="model-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <a href="?p=${item.id}" class="card-title-link">
        <h4 class="card-title" style="font-size: 0.98rem; min-height: auto; margin-bottom: 6px;">${escapeHTML(item.title)}</h4>
      </a>
      <p class="card-description" style="font-size: 0.8rem; margin-bottom: 12px; min-height: auto; -webkit-line-clamp: 2;">${escapeHTML(item.description)}</p>
      
      <button class="btn-corporate" style="height: 38px; font-size: 0.82rem;" onclick="window.location.href='?p=${item.id}'">
        ভিউ প্রম্পট (View)
      </button>
    `;
    grid.appendChild(card);
  });
}

function executeSharePrompt(prompt) {
  const url = new URL(window.location.href);
  url.search = `?p=${encodeURIComponent(prompt.id)}`;
  url.hash = "";
  const text = `${prompt.title}\n\n${prompt.description || ""}`.trim();
  const shareData = { title: prompt.title, text, url: url.toString() };

  if (navigator.share) {
    navigator.share(shareData).catch((error) => {
      if (error.name !== "AbortError") console.error("Sharing failed:", error);
    });
    return;
  }

  navigator.clipboard.writeText(`${text}\n\n${shareData.url}`).then(() => {
    showToast("বর্ণনাসহ শেয়ার লিংক কপি করা হয়েছে!");
  });
}
function resetToMainView(targetId = null) {
  shareModeActive = false;
  sharedPromptId = null;
  
  // Restore layout elements display
  if (searchSection) searchSection.style.display = "block";
  if (categoryNav) categoryNav.style.display = "flex";
  if (dashboardSidebar) dashboardSidebar.style.display = "flex";
  if (recentViewedPanel) renderRecentlyViewedRow();
  
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

// ---------------------------------------------------------
// RENDERING FEED GRID & AD INJECTIONS EVERY 6 CARDS
// ---------------------------------------------------------
function renderPrompts() {
  if (!promptsGallery) return;
  promptsGallery.innerHTML = "";
  
  if (filteredPrompts.length === 0) {
    promptsGallery.innerHTML = `
      <div class="no-records">
        খুঁজে পাওয়া যায়নি। অন্য কীওয়ার্ড দিয়ে সার্চ করার চেষ্টা করুন।
      </div>
    `;
    return;
  }
  
  // Pagination slice
  const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const pagePrompts = filteredPrompts.slice(startIndex, endIndex);
  
  pagePrompts.forEach((p, index) => {
    const card = document.createElement("article");
    card.className = "corporate-card";
    
    // Format Model Badge
    const model = (p.model || "").trim().toLowerCase();
    let badgeClass = "model-badge-generic";
    let badgeLabel = p.model || "Unknown";
    if (model.includes("chatgpt") || model.includes("gpt")) {
      badgeClass = "model-badge-chatgpt";
      badgeLabel = "ChatGPT";
    } else if (model.includes("gemini")) {
      badgeClass = "model-badge-gemini";
      badgeLabel = "Gemini";
    } else if (model.includes("claude")) {
      badgeClass = "model-badge-claude";
      badgeLabel = "Claude";
    }
    
    const mockViews = Math.floor(((p.createdAt || Date.now()) % 890) + 110) + " views";
    
    // Optional Image header
    let imageHTML = "";
    if (p.image) {
      imageHTML = `<img src="${p.image}" class="card-image-header" alt="${escapeHTML(p.title)} Cover">`;
    }
    
    card.innerHTML = `
      <div>
        ${imageHTML}
        <div class="card-top-row">
          <span class="model-badge ${badgeClass}">${badgeLabel}</span>
          <span class="view-count">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
            ${mockViews}
          </span>
        </div>
        <a href="?p=${p.id}" class="card-title-link">
          <h3 class="card-title">${escapeHTML(p.title)}</h3>
        </a>
        <p class="card-description">${escapeHTML(p.description)}</p>
      </div>
      
      <!-- Actions Row at bottom: Copy primary full-width + Share icon -->
      <div class="card-actions">
        <button class="btn-corporate copy-button" data-id="${p.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          কপি করুন (Copy)
        </button>
        <button class="btn-corporate secondary btn-square share-button" data-id="${p.id}" aria-label="Share">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
    `;
    
    // Bind Copy listener
    card.querySelector(".copy-button").addEventListener("click", (e) => {
      e.stopPropagation();
      trackRecentlyViewed(p.id);
      triggerCopyRedirection(p.prompt);
    });

    // Bind Share listener
    card.querySelector(".share-button").addEventListener("click", (e) => {
      e.stopPropagation();
      executeSharePrompt(p);
    });
    
    // Bind card link action for detailed views
    card.querySelector(".card-title-link").addEventListener("click", (e) => {
      e.preventDefault();
      window.history.pushState({}, "", `?p=${p.id}`);
      sharedPromptId = p.id;
      shareModeActive = true;
      
      // Hide standard layers
      if (searchSection) searchSection.style.display = "none";
      if (categoryNav) categoryNav.style.display = "none";
      if (dashboardSidebar) dashboardSidebar.style.display = "none";
      if (recentViewedPanel) recentViewedPanel.style.display = "none";
      
      const gridLayout = document.getElementById("main-grid-layout");
      if (gridLayout) gridLayout.style.gridTemplateColumns = "1fr";
      
      trackRecentlyViewed(p.id);
      renderSharedPrompt();
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
// DYNAMIC PAGINATION CONTROLLER
// ---------------------------------------------------------
function renderPaginationControls() {
  if (!paginationContainer || shareModeActive) return;
  paginationContainer.innerHTML = "";
  
  const totalPages = Math.ceil(filteredPrompts.length / CARDS_PER_PAGE);
  if (totalPages <= 1) return;
  
  // Previous button
  const prevBtn = document.createElement("button");
  prevBtn.className = "pagination-btn";
  prevBtn.innerHTML = `&laquo;`;
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener("click", () => {
    currentPage--;
    applyFiltersAndRender();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  paginationContainer.appendChild(prevBtn);
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.className = `pagination-btn ${currentPage === i ? "active" : ""}`;
    pageBtn.textContent = i;
    pageBtn.addEventListener("click", () => {
      currentPage = i;
      applyFiltersAndRender();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    paginationContainer.appendChild(pageBtn);
  }
  
  // Next button
  const nextBtn = document.createElement("button");
  nextBtn.className = "pagination-btn";
  nextBtn.innerHTML = `&raquo;`;
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener("click", () => {
    currentPage++;
    applyFiltersAndRender();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  paginationContainer.appendChild(nextBtn);
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
// CLIPBOARD COPY UTILITY
// ---------------------------------------------------------
let copyCounter = parseInt(sessionStorage.getItem("ghor_copy_counter")) || 0;

function triggerCopyRedirection(promptText) {
  copyPromptToClipboard(promptText);
  copyCounter++;
  sessionStorage.setItem("ghor_copy_counter", copyCounter);
  if (copyCounter >= 4) {
    copyCounter = 0;
    sessionStorage.setItem("ghor_copy_counter", "0");
    window.open("https://www.effectivecpmnetwork.com/xei3hy1mp?key=d462a9b0cbb2f223b839d43232577337", "_blank");
  }
}

function copyPromptToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("প্রম্পট কপি করা হয়েছে!");
  }).catch(err => {
    console.error("Clipboard copy failed:", err);
  });
}

// Run Init
window.addEventListener("DOMContentLoaded", init);



