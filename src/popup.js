function reloadActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs[0]) {
            console.error("Error retrieving the active tab:", chrome.runtime.lastError);
            return;
        }
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => window.location.reload()
        });
    });
}

function updateDynamicRules(addRules = [], removeRuleIds = []) {
    chrome.declarativeNetRequest.updateDynamicRules({ addRules, removeRuleIds }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error updating rules:", chrome.runtime.lastError);
        } else {
            reloadActiveTab();
        }
    });
}

// Restore saved state on popup open
chrome.storage.local.get(["referer", "externalOnly"], (data) => {
    if (data.referer) document.getElementById("referer").value = data.referer;
    document.getElementById("externalOnly").checked = !!data.externalOnly;
});

// Persist toggle state immediately on change
document.getElementById("externalOnly").addEventListener("change", (e) => {
    chrome.storage.local.set({ externalOnly: e.target.checked });
});

document.getElementById("setReferer").addEventListener("click", () => {
    const referer = document.getElementById("referer").value.trim();
    if (!referer) {
        console.warn("The Referer field is empty.");
        return;
    }

    const externalOnly = document.getElementById("externalOnly").checked;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let excludedDomains = [];
        if (externalOnly) {
            try {
                const hostname = new URL(tabs[0]?.url || "").hostname;
                if (hostname) excludedDomains = [hostname];
            } catch (_) {}
        }

        chrome.storage.local.set({ referer, externalOnly }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving the referer:", chrome.runtime.lastError);
                return;
            }

            const condition = { urlFilter: "*", resourceTypes: ["main_frame"] };
            if (excludedDomains.length) condition.excludedRequestDomains = excludedDomains;

            const rule = {
                id: 1,
                priority: 1,
                action: {
                    type: "modifyHeaders",
                    requestHeaders: [
                        { header: "Referer", operation: "set", value: referer }
                    ]
                },
                condition
            };

            updateDynamicRules([rule], [1]);
        });
    });
});

document.getElementById("deleteReferer").addEventListener("click", () => {
    chrome.storage.local.remove("referer", () => {
        if (chrome.runtime.lastError) {
            console.error("Error deleting the referer:", chrome.runtime.lastError);
            return;
        }
        updateDynamicRules([], [1]);
    });
});
