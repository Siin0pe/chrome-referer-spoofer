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

// Keep excludedRequestDomains in sync with the current page's domain
chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0) return;

    const { externalOnly } = await chrome.storage.local.get("externalOnly");
    if (!externalOnly) return;

    let hostname;
    try { hostname = new URL(details.url).hostname; } catch (_) { return; }
    if (!hostname) return;

    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const existing = rules.find(r => r.id === 1);
    if (!existing) return;

    const updated = {
        ...existing,
        condition: { ...existing.condition, excludedRequestDomains: [hostname] }
    };

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [updated]
    });
}, { url: [{ schemes: ["http", "https"] }] });