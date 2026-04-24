// background.js
// Handles communication with the Sentinel API to bypass CORS
// and ensures reliable fetch behavior outside of the page context.

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SENTINEL_ANALYZE_TX") {
    handleAnalyzeTransaction(request.payload)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    // Return true to indicate asynchronous response
    return true;
  }
});

async function handleAnalyzeTransaction(payload) {
  // Get API URL from storage, fallback to default
  const { apiUrl = DEFAULT_API_URL } = await chrome.storage.local.get("apiUrl");
  if (!isAllowedApiUrl(apiUrl)) {
    throw new Error("Blocked unsafe Sentinel API endpoint. Only loopback /api/analyze endpoints are allowed.");
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API returned ${response.status}: ${errText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[Sentinel Background] API Error:", error);
    throw error;
  }
}
