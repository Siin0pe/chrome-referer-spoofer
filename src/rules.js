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
