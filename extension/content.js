// content.js
// Runs in the isolated extension context.
// Injects the provider wrapper into the main page context and handles UI overlay (Shadow DOM).

function injectScript() {
  try {
    const container = document.head || document.documentElement;
    const scriptTag = document.createElement("script");
    scriptTag.src = chrome.runtime.getURL("injected.js");
    scriptTag.onload = function () {
      this.remove();
    };
    container.insertBefore(scriptTag, container.children[0]);
    console.log("[Sentinel Content] Injected provider wrapper.");
  } catch (e) {
    console.error("[Sentinel Content] Injection failed.", e);
  }
}

// Ensure execution happens as early as possible
injectScript();

// Listen for messages from the injected script
window.addEventListener("message", (event) => {
  // Only accept messages from the same frame
  if (event.source !== window) return;

  if (event.data && event.data.type === "SENTINEL_PROXY_ANALYZE") {
    const { messageId, payload } = event.data;
    
    // Show UI Overlay
    showOverlay("Analyzing transaction...");

    // Send to background script
    chrome.runtime.sendMessage(
      { type: "SENTINEL_ANALYZE_TX", payload },
      (response) => {
        if (response.success) {
          handleAnalysisResult(messageId, response.data);
        } else {
          hideOverlay();
          // Reply with error so the original request can fail or proceed
          window.postMessage({
            type: "SENTINEL_PROXY_RESPONSE",
            messageId,
            error: response.error,
          }, "*");
        }
      }
    );
  }
  
  if (event.data && event.data.type === "SENTINEL_PROXY_HIDE_UI") {
    hideOverlay();
  }
});

// ─── Shadow DOM UI Overlay (Prevents dApp from tampering/styling) ───

let overlayContainer = null;
let shadowRoot = null;

function createOverlayHost() {
  if (overlayContainer) return;

  overlayContainer = document.createElement("div");
  overlayContainer.id = "sentinel-ai-host";
  // Max z-index to stay above everything
  overlayContainer.style.position = "fixed";
  overlayContainer.style.top = "0";
  overlayContainer.style.left = "0";
  overlayContainer.style.width = "100vw";
  overlayContainer.style.height = "100vh";
  overlayContainer.style.zIndex = "2147483647";
  overlayContainer.style.pointerEvents = "none";
  overlayContainer.style.display = "none";

  shadowRoot = overlayContainer.attachShadow({ mode: "closed" });

  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("styles.css");
  shadowRoot.appendChild(styleLink);

  const uiWrapper = document.createElement("div");
  uiWrapper.id = "sentinel-ui-wrapper";
  uiWrapper.style.pointerEvents = "auto";
  shadowRoot.appendChild(uiWrapper);

  document.body.appendChild(overlayContainer);
}

function showOverlay(message) {
  createOverlayHost();
  const wrapper = shadowRoot.getElementById("sentinel-ui-wrapper");
  wrapper.innerHTML = `
    <div class="sentinel-backdrop"></div>
    <div class="sentinel-panel loading">
      <div class="sentinel-header">
        <img src="data:image/svg+xml;utf8,<svg width='24' height='24' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M16 6L6 10.4444V16.6667C6 22.3889 10.2857 27.6667 16 30C21.7143 27.6667 26 22.3889 26 16.6667V10.4444L16 6Z' stroke='%233b82f6' stroke-width='2' stroke-linejoin='round'/></svg>" width="24" height="24" alt="Logo" />
        <span>Sentinel AI</span>
      </div>
      <div class="sentinel-body">
        <div class="sentinel-spinner"></div>
        <p>${message}</p>
      </div>
    </div>
  `;
  overlayContainer.style.display = "block";
}

function handleAnalysisResult(messageId, result) {
  const wrapper = shadowRoot.getElementById("sentinel-ui-wrapper");
  const { severity, verdict, score, findings, summary } = result;

  // If low risk, just proceed automatically
  if (severity === "low") {
    hideOverlay();
    replyToInjected(messageId, { action: "proceed" });
    return;
  }

  const isCritical = severity === "critical";
  const colorClass = isCritical ? "critical" : severity === "high" ? "high" : "medium";

  let findingsHtml = findings.slice(0, 3).map(f => `
    <div class="finding-item">
      <strong>${f.title}</strong>
      <p>${f.description}</p>
    </div>
  `).join("");

  wrapper.innerHTML = `
    <div class="sentinel-backdrop"></div>
    <div class="sentinel-panel ${colorClass}">
      <div class="sentinel-header">
        <img src="data:image/svg+xml;utf8,<svg width='24' height='24' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M16 6L6 10.4444V16.6667C6 22.3889 10.2857 27.6667 16 30C21.7143 27.6667 26 22.3889 26 16.6667V10.4444L16 6Z' stroke='%233b82f6' stroke-width='2' stroke-linejoin='round'/></svg>" width="24" height="24" alt="Logo" />
        <span>Sentinel AI Security Alert</span>
      </div>
      <div class="sentinel-body">
        <h2 class="verdict">${verdict}</h2>
        <p class="summary">${summary}</p>
        
        <div class="findings-list">
          ${findingsHtml}
        </div>
      </div>
      <div class="sentinel-footer">
        <button id="sentinel-btn-reject" class="btn primary reject">Reject Transaction</button>
        <button id="sentinel-btn-proceed" class="btn secondary">Proceed Anyway</button>
      </div>
    </div>
  `;

  shadowRoot.getElementById("sentinel-btn-reject").addEventListener("click", () => {
    hideOverlay();
    replyToInjected(messageId, { action: "reject" });
  });

  shadowRoot.getElementById("sentinel-btn-proceed").addEventListener("click", () => {
    hideOverlay();
    replyToInjected(messageId, { action: "proceed" });
  });
}

function hideOverlay() {
  if (overlayContainer) {
    overlayContainer.style.display = "none";
    const wrapper = shadowRoot.getElementById("sentinel-ui-wrapper");
    if (wrapper) wrapper.innerHTML = "";
  }
}

function replyToInjected(messageId, payload) {
  window.postMessage({
    type: "SENTINEL_PROXY_RESPONSE",
    messageId,
    payload,
  }, "*");
}
