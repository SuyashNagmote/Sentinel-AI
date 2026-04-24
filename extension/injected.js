// injected.js
// This script runs directly in the dApp's execution context.
// It intercepts window.ethereum safely using Property Descriptors to avoid race conditions
// and caching bypasses.

(function () {
  const SCRIPT_ID = "SENTINEL_AI_PROVIDER_HOOK";
  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  console.log("[Sentinel Injected] Initializing Web3 security hook...");

  // Generate unique IDs for message correlation
  let msgIdCounter = 0;
  const pendingRequests = new Map();

  // Listen for responses from content.js
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;

    if (event.data.type === "SENTINEL_PROXY_RESPONSE") {
      const { messageId, payload, error } = event.data;
      const pending = pendingRequests.get(messageId);
      
      if (pending) {
        pendingRequests.delete(messageId);
        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(payload); // payload has { action: 'proceed' | 'reject' }
        }
      }
    }
  });

  // The actual intercept logic
  async function handleRpcRequest(args, originalRequest, provider) {
    const method = args.method;
    const params = args.params || [];

    // Only intercept transactions
    if (method !== "eth_sendTransaction") {
      return originalRequest.apply(provider, [args]);
    }

    const txParams = params[0];
    if (!txParams) {
      return originalRequest.apply(provider, [args]);
    }

    // Format for Sentinel API
    let chainIdStr = "1";
    try {
      // Try to get current chainId sync if available, else assume 1
      chainIdStr = provider.chainId || await originalRequest.apply(provider, [{ method: "eth_chainId" }]);
    } catch (e) {
      // ignore
    }
    const chainId = parseInt(chainIdStr, 16) || parseInt(chainIdStr) || 1;

    const sentinelPayload = {
      chainId,
      from: txParams.from,
      to: txParams.to,
      value: txParams.value || "0",
      data: txParams.data || "0x",
      trusted: false, // Extension context is inherently untrusted
      metadata: {
        source: window.location.origin,
        dappName: document.title || window.location.hostname,
        url: window.location.href,
        intent: "other"
      }
    };

    const messageId = `req_${Date.now()}_${++msgIdCounter}`;
    
    // Create a promise to wait for user interaction in the overlay
    const decisionPromise = new Promise((resolve, reject) => {
      pendingRequests.set(messageId, { resolve, reject });
    });

    // Ask content.js to analyze
    window.postMessage({
      type: "SENTINEL_PROXY_ANALYZE",
      messageId,
      payload: sentinelPayload
    }, "*");

    try {
      const decision = await decisionPromise;
      if (decision.action === "reject") {
        // Standard EIP-1193 user rejection error
        const err = new Error("User rejected the transaction via Sentinel AI Security Policy.");
        err.code = 4001;
        throw err;
      }
      // If proceed, forward to original request
      return originalRequest.apply(provider, [args]);
    } catch (error) {
      // Send hide UI event just in case
      window.postMessage({ type: "SENTINEL_PROXY_HIDE_UI" }, "*");
      throw error;
    }
  }

  // Hooking strategy: Proxy the 'request' method on the provider.
  function wrapProvider(provider) {
    if (provider._sentinelWrapped) return provider;
    
    const originalRequest = provider.request;
    if (typeof originalRequest === "function") {
      provider.request = function (args) {
        return handleRpcRequest(args, originalRequest, provider);
      };
      provider._sentinelWrapped = true;
      console.log("[Sentinel Injected] Successfully hooked window.ethereum.request");
    }
    return provider;
  }

  // Handle immediate window.ethereum
  if (window.ethereum) {
    wrapProvider(window.ethereum);
  }

  // Handle delayed injection (e.g., MetaMask injecting later)
  let ethDescriptor = Object.getOwnPropertyDescriptor(window, "ethereum");
  let ethValue = window.ethereum;

  Object.defineProperty(window, "ethereum", {
    get() {
      return ethValue;
    },
    set(val) {
      ethValue = wrapProvider(val);
    },
    configurable: true,
    enumerable: true
  });

  // Also catch EIP-6963 providers (Multiple wallets like Rabby, Backpack, etc)
  window.addEventListener("eip6963:announceProvider", (event) => {
    if (event.detail && event.detail.provider) {
      wrapProvider(event.detail.provider);
      console.log("[Sentinel Injected] Hooked EIP-6963 provider:", event.detail.info?.name);
    }
  });

})();
