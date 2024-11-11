chrome.storage.local.get("referer", ({ referer }) => {
    if (referer) {
        chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [
                {
                    "id": 1,
                    "priority": 1,
                    "action": {
                        "type": "modifyHeaders",
                        "requestHeaders": [
                            { "header": "Referer", "operation": "set", "value": referer }
                        ]
                    },
                    "condition": {
                        "urlFilter": "*",
                        "resourceTypes": ["main_frame"]
                    }
                }
            ],
            removeRuleIds: [1]
        });
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.referer) {
        chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [
                {
                    "id": 1,
                    "priority": 1,
                    "action": {
                        "type": "modifyHeaders",
                        "requestHeaders": [
                            { "header": "Referer", "operation": "set", "value": changes.referer.newValue }
                        ]
                    },
                    "condition": {
                        "urlFilter": "*",
                        "resourceTypes": ["main_frame"]
                    }
                }
            ],
            removeRuleIds: [1]
        });
    }
});
