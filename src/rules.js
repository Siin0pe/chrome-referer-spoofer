// Shared by the popup and the service worker.
// A rule as stored: { id, on, sites, mode: "set" | "remove", referer, externalOnly, allRequests }

// ponytail: explicit list, newer enum values (webtransport, webbundle) would reject the whole update on old Chrome
const ALL_TYPES = ["main_frame", "sub_frame", "stylesheet", "script", "image", "font",
    "object", "xmlhttprequest", "ping", "media", "websocket", "other"];

const PATTERN = /[\/*|^]/;

// "https://Shop.Example.com/x, foo.org" -> ["shop.example.com", "foo.org"]
// A single entry with / * | ^ is kept as a DNR urlFilter instead.
export function parseSites(input) {
    const parts = (input || "").split(/[\s,]+/).filter(Boolean);
    if (parts.length === 0) return { all: true };
    if (parts.length === 1 && PATTERN.test(parts[0]) && !/^https?:\/\/[^\/]+\/?$/i.test(parts[0])) {
        return { urlFilter: parts[0] };
    }
    const domains = [];
    for (const p of parts) {
        if (PATTERN.test(p.replace(/^https?:\/\//i, "").replace(/\/$/, ""))) {
            throw new Error(`"${p}" mixes a URL pattern with other sites. Use one pattern on its own.`);
        }
        let host;
        try { host = new URL(/^[a-z]+:\/\//i.test(p) ? p : "http://" + p).hostname; } catch (_) { host = ""; }
        host = host.replace(/\.$/, "");
        if (!host) throw new Error(`"${p}" is not a valid domain.`);
        domains.push(host);
    }
    return { domains };
}

// Returns a header-safe referer (URL-encoded, punycoded host) or throws.
export function normalizeReferer(value) {
    value = value.trim();
    // "localhost:3000" parses as scheme "localhost:", so require "scheme://"
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) throw new Error("Enter a full URL, including https://");
    try { return new URL(value).href; } catch (_) {
        throw new Error("Enter a full URL, including https://");
    }
}

export function toDnr(rule, index, all) {
    const sites = parseSites(rule.sites);
    const condition = { resourceTypes: rule.allRequests ? ALL_TYPES : ["main_frame"] };
    if (sites.domains) condition.requestDomains = sites.domains;
    if (sites.urlFilter) condition.urlFilter = sites.urlFilter;
    if (rule.externalOnly) condition.domainType = "thirdParty";

    const header = rule.mode === "remove"
        ? { header: "referer", operation: "remove" }
        : { header: "referer", operation: "set", value: normalizeReferer(rule.referer) };

    // Site-specific rules beat "all sites" rules; otherwise the higher rule in the list wins.
    const priority = (sites.all ? 1 : 2) * all.length - index;

    return { id: index + 1, priority, action: { type: "modifyHeaders", requestHeaders: [header] }, condition };
}

// Why Chrome can't apply this rule, or null if it can.
export function ruleProblem(rule) {
    try {
        toDnr(rule, 0, [rule]);
        return null;
    } catch (err) {
        return err.message;
    }
}

// The rule editor: update rule `id` and keep its on/off state, or add a new rule if id is null.
export function saveRule(rules, id, fields) {
    if (id) return rules.map(r => r.id === id ? { ...fields, id, on: r.on } : r);
    return [...rules, { ...fields, id: crypto.randomUUID(), on: true }];
}

// Simple mode is a view on the rules, not a second kind of rule: it edits the all-sites rule
// that sends a URL, preferring the one in effect. Advanced mode shows that same rule.
const isSimple = (r) => !r.sites?.trim() && r.mode === "set";

export function simpleRule(rules) {
    return rules.find(r => isSimple(r) && r.on) ?? rules.find(isSimple) ?? null;
}

export function setSimple(rules, { referer, externalOnly }) {
    const current = simpleRule(rules);
    if (current) return rules.map(r => r === current ? { ...r, on: true, referer, externalOnly } : r);
    return [...rules, { id: crypto.randomUUID(), on: true, sites: "", mode: "set", referer, externalOnly, allRequests: false }];
}

export function clearSimple(rules) {
    const current = simpleRule(rules);
    return rules.filter(r => r !== current);
}

// Without a saved choice, open the mode that can show every rule.
export function defaultView(rules) {
    return rules.every(r => r === simpleRule(rules)) ? "simple" : "advanced";
}

export async function loadRules() {
    const { rules = [] } = await chrome.storage.local.get("rules");
    return rules;
}

// Popup and service worker both rewrite the session rules; serialize them or ids collide.
const locked = (fn) => navigator.locks.request("rules", fn);

async function apply(rules) {
    const active = [];
    for (const r of rules.filter(r => r.on)) {
        try { active.push(toDnr(r, active.length, rules.filter(r => r.on))); }
        catch (err) { console.error("Skipping invalid rule", r, err); } // one bad stored rule must not drop the rest
    }
    const old = await chrome.declarativeNetRequest.getSessionRules();
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: old.map(r => r.id), addRules: active });
    await chrome.action.setBadgeText({ text: active.length ? String(active.length) : "" });
}

// Apply first so a rule Chrome rejects is never stored as if it were active.
export const saveRules = (rules) => locked(async () => {
    await apply(rules);
    await chrome.storage.local.set({ rules });
});

export const sync = () => locked(async () => apply(await loadRules()));

// v1.3.0 and earlier: one dynamic rule (id 1) plus "referer"/"externalOnly" keys. Turn them into a rule.
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

// First call of a browser session: migrate, then apply the "off after restart" setting.
// Session rules (and storage.session) are wiped on browser restart, extension update,
// reload and disable/enable. The flag tells such a fresh session from a later call.
// Worker and popup both call this; the lock makes the popup wait for a restore in progress.
export const restoreSession = () => navigator.locks.request("restore", async () => {
    const { restored } = await chrome.storage.session.get("restored");
    if (restored) return;
    try {
        await migrateLegacy().catch(err => console.error("Could not migrate the old referer:", err));
        const { keepAfterRestart } = await chrome.storage.local.get("keepAfterRestart");
        const rules = await loadRules();
        if (!keepAfterRestart && rules.some(r => r.on)) await saveRules(rules.map(r => ({ ...r, on: false })));
        else await sync();
    } finally {
        // Also after a failure, or every later call would switch off rules the user has since turned on.
        await chrome.storage.session.set({ restored: true });
    }
});
