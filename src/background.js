import { loadRules, saveRules, sync } from "./rules.js";

chrome.action.setBadgeBackgroundColor({ color: "#2B3FBF" });

// v1.3.0 and earlier: one dynamic rule (id 1) plus "referer"/"externalOnly" keys. Turn them into a rule.
// Runs at every fresh session rather than in onInstalled, which doesn't fire on every update path.
async function migrateLegacy() {
    const { referer, externalOnly } = await chrome.storage.local.get(["referer", "externalOnly"]);
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1] });
    if (referer === undefined && externalOnly === undefined) return;
    if (referer) {
        const legacy = { id: crypto.randomUUID(), on: true, sites: "", mode: "set", referer, externalOnly: !!externalOnly, allRequests: false };
        await saveRules([...await loadRules(), legacy]);
    }
    await chrome.storage.local.remove(["referer", "externalOnly"]);
}

// Session rules (and storage.session) are wiped on browser restart, extension update,
// reload and disable/enable. The flag tells such a fresh session from a service worker wake-up.
// ponytail: runtime.onStartup is not used, it does not fire reliably (see v1.2.4).
async function boot() {
    const { restored } = await chrome.storage.session.get("restored");
    if (restored) return;
    await chrome.storage.session.set({ restored: true });
    await migrateLegacy().catch(err => console.error("Could not migrate the old referer:", err));
    const { keepAfterRestart } = await chrome.storage.local.get("keepAfterRestart");
    const rules = await loadRules();
    if (!keepAfterRestart && rules.some(r => r.on)) await saveRules(rules.map(r => ({ ...r, on: false })));
    else await sync();
}
boot().catch(err => console.error("Could not restore rules:", err));
