// =====================================================
// CONFIG
// =====================================================

const API_BASE_URL = "https://humanizex.onrender.com";


// =====================================================
// CONTEXT MENU SETUP
// =====================================================

chrome.runtime.onInstalled.addListener(() => {

    chrome.contextMenus.create({
        id: "humanizex-detect",
        title: "🤖 Detect AI (HumanizeX)",
        contexts: ["selection"]
    });
});


// =====================================================
// CONTEXT MENU CLICK -> tell content script to run detection
// =====================================================

chrome.contextMenus.onClicked.addListener((info, tab) => {

    if (info.menuItemId !== "humanizex-detect") {
        return;
    }

    if (!tab || !tab.id) {
        return;
    }

    chrome.tabs.sendMessage(tab.id, {
        action: "run-detect-from-menu",
        selectionText: info.selectionText || ""
    });
});


// =====================================================
// KEYBOARD SHORTCUT -> tell content script to run detection
// on whatever is currently selected on the page
// =====================================================

chrome.commands.onCommand.addListener((command, tab) => {

    if (command !== "detect-selection") {
        return;
    }

    if (!tab || !tab.id) {
        return;
    }

    chrome.tabs.sendMessage(tab.id, {
        action: "run-detect-from-shortcut"
    });
});


// =====================================================
// BACKEND CALLS
// These run in the background service worker, not the
// content script, because content-script fetches are
// subject to the host page's Content-Security-Policy
// (e.g. Amazon blocks cross-origin fetches outright).
// The background worker isn't bound by that.
// =====================================================

async function detectAI(text) {

    const response = await fetch(`${API_BASE_URL}/api/detect`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Detect request failed (HTTP ${response.status})`);
    }

    return data; // { success: true, score: 0.0–1.0 }
}


async function humanizeText(text) {

    const response = await fetch(`${API_BASE_URL}/api/humanize`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || data.message || `Humanize request failed (HTTP ${response.status})`);
    }

    return data; // { success, provider, humanized, metrics, quota, wordCount }
}


// =====================================================
// MESSAGE LISTENER
// =====================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.action === "detect-ai") {

        detectAI(message.text)
            .then((data) => sendResponse({ success: true, data }))
            .catch((error) => sendResponse({ success: false, error: error.message }));

        return true; // keep the message channel open for async sendResponse
    }

    if (message.action === "humanize-text") {

        humanizeText(message.text)
            .then((data) => sendResponse({ success: true, data }))
            .catch((error) => sendResponse({ success: false, error: error.message }));

        return true;
    }

    if (message.action === "increment-detect-count") {

        chrome.storage.local.get(["humanizex_detect_count"], (result) => {

            const newCount = (result.humanizex_detect_count || 0) + 1;

            chrome.storage.local.set({
                humanizex_detect_count: newCount
            });

            chrome.action.setBadgeText({
                text: String(newCount)
            });

            chrome.action.setBadgeBackgroundColor({
                color: "#4f46e5"
            });
        });

        return;
    }
});


// =====================================================
// RESTORE BADGE ON STARTUP
// =====================================================

chrome.storage.local.get(["humanizex_detect_count"], (result) => {

    if (result.humanizex_detect_count) {

        chrome.action.setBadgeText({
            text: String(result.humanizex_detect_count)
        });

        chrome.action.setBadgeBackgroundColor({
            color: "#4f46e5"
        });
    }
});