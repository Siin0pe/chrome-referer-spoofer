let hasInitialized = false;

console.log("Service Worker initialized");

function cleanupReferer(source) {
    if (hasInitialized) return;
    console.log(`Attempting to remove referer (triggered by: ${source})`);
    chrome.storage.local.remove("referer", () => {
        if (chrome.runtime.lastError) {
            console.error(`Error removing referer (${source}):`, chrome.runtime.lastError);
        } else {
            console.log(`Referer successfully removed (${source})`);
            hasInitialized = true;
        }
    });
}

chrome.windows.onCreated.addListener((window) => {
    chrome.windows.getAll((windows) => {
        if (windows.length === 1) {
            cleanupReferer('window created');
        }
    });
});

chrome.runtime.onInstalled.addListener((details) => {
    console.log("Extension event:", details.reason);
    cleanupReferer('installation/update');
});

chrome.runtime.onStartup.addListener(() => {
    console.log("Browser started.");
    cleanupReferer('startup');
});

setTimeout(() => {
    chrome.storage.local.get(['referer'], (result) => {
        if (result.referer) {
            console.log("Backup cleanup: referer still exists, removing it");
            cleanupReferer('backup check');
        }
    });
}, 5000);