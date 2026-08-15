// =====================================================
// GLOBAL LISTENER TO CLOSE POPUP ON OUTSIDE CLICK
// =====================================================
document.addEventListener("mousedown", (event) => {
    const host = document.getElementById("humanizex-host");
    if (!host) {
        return;
    }

    // event.target gets retargeted to `host` for anything that happens
    // inside the shadow tree (that's how shadow DOM event retargeting
    // works, even in "open" mode). So we can't compare event.target
    // against nodes inside the shadow root directly. Use composedPath()
    // instead, which preserves the real path through the shadow tree.
    const path = event.composedPath();
    if (!path.includes(host)) {
        host.remove();
    }
});


document.addEventListener("mouseup", (event) => {

    // Check if the mouse event happened inside
    // the HumanizeX popup (including its buttons, which live
    // inside the shadow root). Same retargeting issue as above -
    // use composedPath() instead of a direct target comparison,
    // otherwise releasing the mouse on a button inside the popup
    // gets treated as "user made a new selection" and a fresh
    // blank popup gets created on top of the one you're using.
    const host = document.getElementById("humanizex-host");

    if (host && event.composedPath().includes(host)) {
        return;
    }

    // Get selected text
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Do nothing if no text is selected
    if (!selectedText) {
        return;
    }

    // Get position + range of selected text.
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const clonedRange = range.cloneRange();

    console.log("Selected text:", selectedText);

    showPopup(rect, selectedText, clonedRange);
});


// =====================================================
// MESSAGES FROM background.js
// (right-click context menu / keyboard shortcut)
// =====================================================

chrome.runtime.onMessage.addListener((message) => {

    if (message.action === "run-detect-from-menu" ||
        message.action === "run-detect-from-shortcut") {

        const info = getCurrentSelectionInfo();

        if (!info) {
            if (message.selectionText && message.selectionText.trim()) {
                showPopup(
                    centerOfViewportRect(),
                    message.selectionText.trim(),
                    null
                );
            }
            return;
        }

        showPopup(info.rect, info.text, info.range);
    }
});


function getCurrentSelectionInfo() {

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
        return null;
    }

    const text = selection.toString().trim();

    if (!text) {
        return null;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    return {
        text,
        rect,
        range: range.cloneRange()
    };
}


function centerOfViewportRect() {
    return {
        left: window.innerWidth / 2 - 95,
        bottom: window.innerHeight / 2,
        top: window.innerHeight / 2
    };
}


function showPopup(rect, selectedText, selectionRange) {

    // Remove previous popup
    const oldHost = document.getElementById("humanizex-host");

    if (oldHost) {
        oldHost.remove();
    }


    // ========================================
    // CREATE HOST
    // ========================================

    const host = document.createElement("div");

    host.id = "humanizex-host";

    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.left = "0";
    host.style.top = "0";
    host.style.width = "0";
    host.style.height = "0";

    document.documentElement.appendChild(host);


    // ========================================
    // CREATE SHADOW DOM
    // ========================================

    const shadow = host.attachShadow({
        mode: "open"
    });


    // ========================================
    // CREATE POPUP
    // ========================================

    const popup = document.createElement("div");

    popup.className = "popup";

    popup.innerHTML = `
        <div class="header-row">
            <div class="title">✦ HumanizeX</div>
            <button id="close-btn" class="close-btn">×</button>
        </div>

        <button id="detect">
            🤖 AI Detect
        </button>

        <button id="humanize">
            ✍️ Humanize
        </button>
    `;


    // ========================================
    // POPUP CSS
    // ========================================

    const style = document.createElement("style");

    style.textContent = `

    * {
        box-sizing: border-box;
    }

    .popup {
        position: fixed;
        width: 190px;
        padding: 10px;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
        font-family: Arial, sans-serif;
        color: #111827;
        z-index: 2147483647;
    }

    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2px 2px 6px 2px;
    }

    .title {
        font-size: 14px;
        font-weight: 700;
        color: #111827;
    }

    .close-btn {
        background: transparent;
        border: none;
        font-size: 18px;
        font-weight: 700;
        color: #6b7280;
        cursor: pointer;
        padding: 0 4px;
        margin: 0;
        width: auto;
        display: inline-block;
        text-align: right;
    }

    .close-btn:hover {
        background: transparent;
        color: #111827;
    }

    button {
        display: block;
        width: 100%;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 10px;
        margin-top: 6px;
        background: #f3f4f6;
        color: #111827;
        cursor: pointer;
        font-family: Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        text-align: left;
    }

    button:hover {
        background: #e5e7eb;
    }

    button:active {
        background: #d1d5db;
    }

    button:disabled {
        cursor: default;
        opacity: 0.6;
    }

    .result {
        padding: 8px 6px;
        font-size: 13px;
        line-height: 1.6;
        color: #111827;
    }

    .result strong {
        font-weight: 700;
    }

    .score-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 12px;
    }

    .score-low {
        background: #dcfce7;
        color: #166534;
    }

    .score-mid {
        background: #fef9c3;
        color: #854d0e;
    }

    .score-high {
        background: #fee2e2;
        color: #991b1b;
    }

    .coming-soon {
        text-align: center;
        padding: 6px 2px;
    }

    .coming-soon-badge {
        display: inline-block;
        background: #ede9fe;
        color: #5b21b6;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 999px;
        margin-bottom: 6px;
    }

    .humanize-box {
        padding: 8px 6px;
        font-size: 13px;
        line-height: 1.6;
        color: #111827;
        max-height: 220px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 6px;
        background: #f9fafb;
    }

    .copy-btn.copied {
        background: #dcfce7;
        color: #166534;
    }

`;


    shadow.appendChild(style);
    shadow.appendChild(popup);


    // ========================================
    // CLOSE BUTTON LISTENER
    // ========================================
    shadow.getElementById("close-btn").addEventListener("click", () => {
        host.remove();
    });


    // ========================================
    // POSITION POPUP
    // ========================================

    const popupWidth = 190;
    const popupHeight = 105;

    let left = rect.left;
    let top = rect.bottom + 10;

    if (left + popupWidth > window.innerWidth) {
        left = window.innerWidth - popupWidth - 10;
    }

    if (left < 10) {
        left = 10;
    }

    if (top + popupHeight > window.innerHeight) {
        top = rect.top - popupHeight - 10;
    }

    if (top < 10) {
        top = 10;
    }

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;


    // ========================================
    // HIGHLIGHT HELPER
    // ========================================

    function highlightSelection(scorePercent) {
        if (!selectionRange) {
            return;
        }

        let colorClass;
        if (scorePercent < 30) {
            colorClass = "rgba(34, 197, 94, 0.25)";   // green
        } else if (scorePercent < 70) {
            colorClass = "rgba(234, 179, 8, 0.3)";    // yellow
        } else {
            colorClass = "rgba(239, 68, 68, 0.3)";    // red
        }

        try {
            const span = document.createElement("span");
            span.style.backgroundColor = colorClass;
            span.style.borderRadius = "2px";
            span.setAttribute("data-humanizex-highlight", "true");
            selectionRange.surroundContents(span);
        } catch (error) {
            console.warn("HumanizeX: couldn't highlight selection", error);
        }
    }


    // ========================================
    // AI DETECT BUTTON
    // ========================================

    const detectButton = shadow.getElementById("detect");

    detectButton.addEventListener("click", async () => {

        const wordCount = selectedText
            .split(/\s+/)
            .filter(word => word.length > 0)
            .length;

        popup.innerHTML = `
            <div class="header-row">
                <div class="title">✦ HumanizeX</div>
                <button id="close-btn" class="close-btn">×</button>
            </div>

            <div class="result">
                <div><strong>Words:</strong> ${wordCount}</div>
                <div><strong>AI Score:</strong> Analyzing...</div>
            </div>
        `;

        // Re-attach close button listener since innerHTML was overwritten
        shadow.getElementById("close-btn").addEventListener("click", () => {
            host.remove();
        });

        try {
            // Ask the background service worker to do the fetch,
            // since content script fetches are blocked by strict
            // page CSPs (e.g. Amazon) that don't allow connections
            // to third-party domains.
            const response = await chrome.runtime.sendMessage({
                action: "detect-ai",
                text: selectedText
            });

            if (!response || !response.success) {
                throw new Error(response ? response.error : "No response from background script");
            }

            const data = response.data;
            console.log("Server response:", data);

            // /api/detect returns { success: true, score: 0.0–1.0 }
            const aiScore = data.score;
            const aiPercentage = (aiScore * 100).toFixed(1);

            const scoreClass =
                aiScore < 0.3 ? "score-low" :
                aiScore < 0.7 ? "score-mid" :
                "score-high";

            popup.innerHTML = `
                <div class="header-row">
                    <div class="title">✦ HumanizeX</div>
                    <button id="close-btn" class="close-btn">×</button>
                </div>

                <div class="result">
                    <div><strong>Words:</strong> ${wordCount}</div>
                    <div>
                        <strong>AI Score:</strong>
                        <span class="score-badge ${scoreClass}">
                            ${aiPercentage}%
                        </span>
                    </div>
                </div>
            `;

            // Re-attach close button listener again
            shadow.getElementById("close-btn").addEventListener("click", () => {
                host.remove();
            });

            highlightSelection(parseFloat(aiPercentage));

            chrome.runtime.sendMessage({
                action: "increment-detect-count"
            });

        } catch (error) {
            console.error("Detection error:", error);

            popup.innerHTML = `
                <div class="header-row">
                    <div class="title">✦ HumanizeX</div>
                    <button id="close-btn" class="close-btn">×</button>
                </div>

                <div class="result">
                    <div><strong>Words:</strong> ${wordCount}</div>
                    <div class="error"><strong>Error:</strong> ${error.message}</div>
                </div>
            `;

            shadow.getElementById("close-btn").addEventListener("click", () => {
                host.remove();
            });
        }
    });


    // ========================================
    // HUMANIZE BUTTON
    // ========================================

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    const humanizeButton = shadow.getElementById("humanize");

    humanizeButton.addEventListener("click", async () => {

        popup.innerHTML = `
            <div class="header-row">
                <div class="title">✦ HumanizeX</div>
                <button id="close-btn" class="close-btn">×</button>
            </div>

            <div class="result">
                <div><strong>Humanizing...</strong></div>
            </div>
        `;

        shadow.getElementById("close-btn").addEventListener("click", () => {
            host.remove();
        });

        try {
            const response = await chrome.runtime.sendMessage({
                action: "humanize-text",
                text: selectedText
            });

            if (!response || !response.success) {
                throw new Error(response ? response.error : "No response from background script");
            }

            const data = response.data;

            popup.style.width = "320px";

            popup.innerHTML = `
                <div class="header-row">
                    <div class="title">✦ HumanizeX</div>
                    <button id="close-btn" class="close-btn">×</button>
                </div>

                <div class="humanize-box">${escapeHtml(data.humanized)}</div>

                <button id="copy-btn" class="copy-btn">📋 Copy</button>
            `;

            shadow.getElementById("close-btn").addEventListener("click", () => {
                host.remove();
            });

            shadow.getElementById("copy-btn").addEventListener("click", async () => {
                const copyBtn = shadow.getElementById("copy-btn");
                try {
                    await navigator.clipboard.writeText(data.humanized);
                    copyBtn.textContent = "✅ Copied!";
                    copyBtn.classList.add("copied");
                    setTimeout(() => {
                        copyBtn.textContent = "📋 Copy";
                        copyBtn.classList.remove("copied");
                    }, 1500);
                } catch (error) {
                    console.warn("HumanizeX: clipboard write failed", error);
                }
            });

            // Popup may now overflow the right edge since it got wider
            const newRect = popup.getBoundingClientRect();
            if (newRect.right > window.innerWidth) {
                popup.style.left = `${window.innerWidth - newRect.width - 10}px`;
            }

        } catch (error) {
            console.error("Humanize error:", error);

            popup.innerHTML = `
                <div class="header-row">
                    <div class="title">✦ HumanizeX</div>
                    <button id="close-btn" class="close-btn">×</button>
                </div>

                <div class="result">
                    <div class="error"><strong>Error:</strong> ${error.message}</div>
                </div>
            `;

            shadow.getElementById("close-btn").addEventListener("click", () => {
                host.remove();
            });
        }
    });
}