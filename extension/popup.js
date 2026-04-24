// popup.js
const DEFAULT_API_URL = "http://localhost:3000/api/analyze";
const ALLOWED_API_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isAllowedApiUrl(value) {
  try {
    const parsed = new URL(value);
    const normalizedHost = parsed.hostname === "::1" ? "[::1]" : parsed.hostname;
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.pathname === "/api/analyze" &&
      ALLOWED_API_HOSTS.has(normalizedHost)
    );
  } catch {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const apiUrlInput = document.getElementById("apiUrl");
  const saveBtn = document.getElementById("saveBtn");

  // Load existing setting
  const { apiUrl = DEFAULT_API_URL } = await chrome.storage.local.get("apiUrl");
  apiUrlInput.value = apiUrl;

  // Save new setting
  saveBtn.addEventListener("click", async () => {
    let newUrl = apiUrlInput.value.trim();
    if (!newUrl) {
      newUrl = DEFAULT_API_URL;
    }

    if (!isAllowedApiUrl(newUrl)) {
      saveBtn.textContent = "Invalid API URL";
      saveBtn.style.background = "#ef4444";
      saveBtn.style.color = "white";
      setTimeout(() => {
        saveBtn.textContent = "Save";
        saveBtn.style.background = "white";
        saveBtn.style.color = "black";
      }, 1500);
      return;
    }

    await chrome.storage.local.set({ apiUrl: newUrl });
    
    // Provide visual feedback
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saved!";
    saveBtn.style.background = "#22c55e";
    saveBtn.style.color = "white";

    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = "white";
      saveBtn.style.color = "black";
    }, 1500);
  });
});
