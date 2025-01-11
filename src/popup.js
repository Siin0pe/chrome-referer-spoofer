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

document.getElementById("setReferer").addEventListener("click", () => {
    const referer = document.getElementById("referer").value.trim();
    if (!referer) {
        console.warn("The Referer field is empty.");
        return;
    }

    chrome.storage.local.set({ referer }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving the referer:", chrome.runtime.lastError);
            return;
        }

        const rule = {
            id: 1,
            priority: 1,
            action: {
                type: "modifyHeaders",
                requestHeaders: [
                    { header: "Referer", operation: "set", value: referer }
                ]
            },
            condition: {
                urlFilter: "*",
                resourceTypes: ["main_frame"]
            }
        };

        updateDynamicRules([rule], [1]);
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
