console.log("Service Worker initialized");

async function cleanupReferer(source) {
    console.log(`Attempting to remove referer (triggered by: ${source})`);
    try {
        await chrome.storage.local.remove("referer");
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1] });
        console.log(`Referer successfully removed (${source})`);
    } catch (err) {
        console.error(`Error removing referer (${source}):`, err);
    }
}

chrome.runtime.onInstalled.addListener((details) => {
    console.log("Extension event:", details.reason);
    cleanupReferer('installation/update');
});

chrome.runtime.onStartup.addListener(() => {
    console.log("Browser started.");
    cleanupReferer('startup');
});