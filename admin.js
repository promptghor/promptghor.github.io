// admin.js - Corporate Admin Panel Script

import { initializeDatabase, subscribeToPrompts, pushPrompt, updatePrompt, deletePrompt } from "./config.js";

// State Management
let allPrompts = [];
let dbInfo = null;
let editingPromptId = null;

// DOM Elements (Loaded on DOMContentLoaded)
let promptCrudForm;
let idField;
let titleField;
let categoryField;
let tagsField;
let descField;
let contentField;
let submitBtn;
let clearBtn;
let formWidgetTitle;
let promptsTbody;
let categoriesDatalist;

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
// WORKSPACE INITIALIZATION
// ---------------------------------------------------------
async function initAdminWorkspace() {
  try {
    dbInfo = await initializeDatabase((msg) => {
      console.log(`[DB Diagnostic] ${msg}`);
    });

    // Subscribe to DB updates
    subscribeToPrompts(dbInfo, (prompts) => {
      allPrompts = prompts;
      renderPromptsTable();
      populateCategoryDatalist();
    }, (errorMsg) => {
      console.error(`Database subscription error: ${errorMsg}`);
    });

  } catch (err) {
    console.error("Workspace initialization failure:", err);
  }
}

// DOM Ready Handler
window.addEventListener("DOMContentLoaded", () => {
  // Bind elements safely
  promptCrudForm = document.getElementById("prompt-crud-form");
  idField = document.getElementById("prompt-id-field");
  titleField = document.getElementById("prompt-title-field");
  categoryField = document.getElementById("prompt-category-field");
  tagsField = document.getElementById("prompt-tags-field");
  descField = document.getElementById("prompt-desc-field");
  contentField = document.getElementById("prompt-content-field");
  submitBtn = document.getElementById("prompt-submit-btn");
  clearBtn = document.getElementById("prompt-clear-btn");
  formWidgetTitle = document.getElementById("form-widget-title");
  promptsTbody = document.getElementById("admin-prompts-tbody");
  categoriesDatalist = document.getElementById("existing-categories");

  // Init themes
  initTheme();
  
  // Directly load active database admin workspace
  initAdminWorkspace();

  // Setup form submit
  if (promptCrudForm) {
    promptCrudForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const id = idField.value;
      const title = titleField.value.trim();
      const category = categoryField.value.trim();
      const rawTags = tagsField.value;
      const description = descField.value.trim();
      const promptText = contentField.value.trim();
      
      const tags = rawTags
        .split(",")
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);
        
      const promptData = {
        title,
        category,
        tags,
        description,
        prompt: promptText
      };

      try {
        if (id) {
          // EDIT MODE
          await updatePrompt(dbInfo, id, promptData, (msg) => console.log(msg));
        } else {
          // CREATE MODE
          await pushPrompt(dbInfo, promptData, (msg) => console.log(msg));
        }
        resetForm();
      } catch (err) {
        console.error("Database operation failed:", err);
      }
    });
  }

  // Setup clear button
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      resetForm();
    });
  }
});

function resetForm() {
  if (idField) idField.value = "";
  if (titleField) titleField.value = "";
  if (categoryField) categoryField.value = "";
  if (tagsField) tagsField.value = "";
  if (descField) descField.value = "";
  if (contentField) contentField.value = "";
  
  editingPromptId = null;
  if (submitBtn) submitBtn.textContent = "Inject Prompt";
  if (formWidgetTitle) formWidgetTitle.textContent = "Inject Cognitive Asset";
}

// ---------------------------------------------------------
// TABLE & DATALIST RENDER
// ---------------------------------------------------------

function renderPromptsTable() {
  if (!promptsTbody) return;
  promptsTbody.innerHTML = "";
  
  if (allPrompts.length === 0) {
    promptsTbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 40px;">
          No active prompts in database. Create one using the form.
        </td>
      </tr>
    `;
    return;
  }
  
  allPrompts.forEach(p => {
    const tr = document.createElement("tr");
    
    // Format Tags
    const tagsHTML = (p.tags || []).map(tag => `
      <span class="table-tag-badge">${tag}</span>
    `).join(" ");

    tr.innerHTML = `
      <td>
        <div class="table-prompt-title">${escapeHTML(p.title)}</div>
        <div class="table-prompt-desc">${escapeHTML(p.description)}</div>
      </td>
      <td>${escapeHTML(p.category)}</td>
      <td><div class="tags-container">${tagsHTML}</div></td>
      <td>
        <div class="action-btns-group">
          <button class="btn-corporate btn-edit" data-id="${p.id}" style="padding: 6px 12px; font-size: 0.8rem;">Edit</button>
          <button class="btn-corporate danger btn-delete" data-id="${p.id}" style="padding: 6px 12px; font-size: 0.8rem;">Delete</button>
        </div>
      </td>
    `;
    
    // Wire Edit Button
    tr.querySelector(".btn-edit").addEventListener("click", () => {
      loadPromptToForm(p);
    });
    
    // Wire Delete Button
    tr.querySelector(".btn-delete").addEventListener("click", () => {
      confirmAndPurgePrompt(p.id, p.title);
    });
    
    promptsTbody.appendChild(tr);
  });
}

function loadPromptToForm(prompt) {
  if (idField) idField.value = prompt.id;
  if (titleField) titleField.value = prompt.title;
  if (categoryField) categoryField.value = prompt.category;
  if (tagsField) tagsField.value = (prompt.tags || []).join(", ");
  if (descField) descField.value = prompt.description;
  if (contentField) contentField.value = prompt.prompt;
  
  editingPromptId = prompt.id;
  if (submitBtn) submitBtn.textContent = "Update Prompt";
  if (formWidgetTitle) formWidgetTitle.textContent = "Modify Cognitive Asset";
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function confirmAndPurgePrompt(id, title) {
  const confirmText = `Are you sure you want to permanently delete the prompt:\n"${title}"?`;
  if (confirm(confirmText)) {
    try {
      await deletePrompt(dbInfo, id, (msg) => console.log(msg));
      if (editingPromptId === id) {
        resetForm();
      }
    } catch (err) {
      console.error("Purge failed:", err);
    }
  }
}

function populateCategoryDatalist() {
  if (!categoriesDatalist) return;
  categoriesDatalist.innerHTML = "";
  const categories = [...new Set(allPrompts.map(p => p.category).filter(Boolean))];
  
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    categoriesDatalist.appendChild(opt);
  });
}
