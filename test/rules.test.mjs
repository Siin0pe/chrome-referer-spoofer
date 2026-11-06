// Run: node test/rules.test.mjs
import assert from "node:assert/strict";
import { parseSites, normalizeReferer, toDnr, ruleProblem, restoreSession, simpleRule, setSimple, clearSimple, defaultView } from "../src/rules.js";

assert.deepEqual(parseSites(""), { all: true });
assert.deepEqual(parseSites("https://Shop.Example.com/, foo.org"), { domains: ["shop.example.com", "foo.org"] });
assert.deepEqual(parseSites("example.com/shop/*"), { urlFilter: "example.com/shop/*" });
assert.deepEqual(parseSites("bücher.de"), { domains: ["xn--bcher-kva.de"] });
assert.throws(() => parseSites("a.com, b.com/*"), /pattern/);

assert.equal(normalizeReferer(" https://www.google.com "), "https://www.google.com/");
assert.equal(normalizeReferer("https://exämple.com/é"), "https://xn--exmple-cua.com/%C3%A9");
assert.throws(() => normalizeReferer("google.com"), /full URL/);
assert.throws(() => normalizeReferer("localhost:3000"), /full URL/);
assert.equal(normalizeReferer("android-app://com.google.android.gm/"), "android-app://com.google.android.gm/");
assert.deepEqual(parseSites("example.com."), { domains: ["example.com"] });

const rules = [
    { on: true, sites: "", mode: "set", referer: "https://g.com/", externalOnly: true, allRequests: false },
    { on: true, sites: "a.com", mode: "remove", referer: "", externalOnly: false, allRequests: true },
];
const dnr = rules.map(toDnr);
assert.deepEqual(dnr.map(r => r.id), [1, 2]);
assert.ok(dnr[1].priority > dnr[0].priority, "site rule beats global rule");
assert.ok(dnr.every(r => r.priority >= 1));
assert.equal(dnr[0].condition.domainType, "thirdParty");
assert.deepEqual(dnr[0].condition.resourceTypes, ["main_frame"]);
assert.deepEqual(dnr[1].action.requestHeaders, [{ header: "referer", operation: "remove" }]);
assert.deepEqual(dnr[1].condition.requestDomains, ["a.com"]);
assert.ok(dnr[1].condition.resourceTypes.includes("xmlhttprequest"));

// ruleProblem: what the popup shows for a rule Chrome will never get
assert.equal(ruleProblem({ sites: "", mode: "set", referer: "https://g.com/" }), null);
assert.equal(ruleProblem({ sites: "a.com", mode: "remove", referer: "" }), null);
assert.match(ruleProblem({ sites: "", mode: "set", referer: "google.com" }), /full URL/);
assert.match(ruleProblem({ sites: "a.com, b.com/*", mode: "remove", referer: "" }), /pattern/);

// restoreSession, against an in-memory stand-in for the Chrome APIs
function area(data = {}) {
    return {
        data,
        async get(keys) {
            if (typeof keys === "string") keys = [keys];
            return Object.fromEntries(keys.filter(k => k in data).map(k => [k, data[k]]));
        },
        async set(items) { Object.assign(data, items); },
        async remove(keys) { for (const k of keys) delete data[k]; },
    };
}
function fakeBrowser(local) {
    const dnr = { session: [], dynamic: [{ id: 1 }] };
    globalThis.chrome = {
        storage: { local: area(local), session: area() },
        action: { setBadgeText: async () => {} },
        declarativeNetRequest: {
            getSessionRules: async () => dnr.session,
            async updateSessionRules({ removeRuleIds, addRules }) {
                dnr.session = dnr.session.filter(r => !removeRuleIds.includes(r.id)).concat(addRules);
            },
            async updateDynamicRules({ removeRuleIds }) {
                dnr.dynamic = dnr.dynamic.filter(r => !removeRuleIds.includes(r.id));
            },
        },
    };
    return dnr;
}
const tails = new Map();
Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: {
        request(name, fn) {
            const run = (tails.get(name) ?? Promise.resolve()).then(() => fn());
            tails.set(name, run.catch(() => {}));
            return run;
        },
    },
});
const onRule = { id: "r", on: true, sites: "", mode: "set", referer: "https://g.com/", externalOnly: false, allRequests: false };

{ // fresh session, default setting: stored rules switch off and nothing is applied
    const dnr = fakeBrowser({ rules: [onRule] });
    await restoreSession();
    assert.deepEqual(chrome.storage.local.data.rules.map(r => r.on), [false]);
    assert.equal(dnr.session.length, 0);
}
{ // fresh session, "keep" setting: the rule stays on and is applied again
    const dnr = fakeBrowser({ rules: [onRule], keepAfterRestart: true });
    await restoreSession();
    assert.deepEqual(chrome.storage.local.data.rules.map(r => r.on), [true]);
    assert.deepEqual(dnr.session[0].action.requestHeaders[0].value, "https://g.com/");
}
{ // a later call in the same session (worker wake-up, popup open) must not switch off what the user just turned on
    fakeBrowser({ rules: [onRule] });
    await restoreSession();
    chrome.storage.local.data.rules = [onRule];
    await restoreSession();
    assert.deepEqual(chrome.storage.local.data.rules.map(r => r.on), [true]);
}
{ // worker and popup racing at startup: the v1 referer is migrated once, not twice
    const dnr = fakeBrowser({ referer: "google.com", externalOnly: true });
    const logError = console.error;
    console.error = () => {}; // v1 accepted this referer; applying it logs "Skipping invalid rule"
    await Promise.all([restoreSession(), restoreSession()]);
    console.error = logError;
    const stored = chrome.storage.local.data.rules;
    assert.equal(stored.length, 1);
    assert.equal(stored[0].referer, "google.com");
    assert.equal(stored[0].externalOnly, true);
    assert.equal(chrome.storage.local.data.referer, undefined);
    assert.equal(dnr.dynamic.length, 0);
}
{ // a failed restore is reported, and does not repeat at every popup open
    const dnr = fakeBrowser({ rules: [onRule], keepAfterRestart: true });
    const update = chrome.declarativeNetRequest.updateSessionRules;
    chrome.declarativeNetRequest.updateSessionRules = async () => { throw new Error("rejected"); };
    await assert.rejects(restoreSession(), /rejected/);
    chrome.declarativeNetRequest.updateSessionRules = update;
    await restoreSession();
    assert.equal(dnr.session.length, 0, "second call is a no-op, sync() is what retries");
}

// Simple mode: a view on the first all-sites rule that sends a URL
const siteRule = { id: "site", on: true, sites: "a.com", mode: "set", referer: "https://a.com/", externalOnly: false, allRequests: false };
const removeAll = { id: "rm", on: true, sites: "", mode: "remove", referer: "", externalOnly: false, allRequests: false };
const allOff = { id: "off", on: false, sites: "", mode: "set", referer: "https://off.com/", externalOnly: false, allRequests: true };
const allOn = { id: "on", on: true, sites: "", mode: "set", referer: "https://on.com/", externalOnly: false, allRequests: false };

assert.equal(simpleRule([]), null);
assert.equal(simpleRule([siteRule, removeAll]), null, "site rules and remove rules are not the simple rule");
assert.equal(simpleRule([allOff, siteRule]).id, "off");
assert.equal(simpleRule([allOff, allOn]).id, "on", "the rule actually in effect comes first");

{ // no simple rule yet: one is added, other rules untouched
    const out = setSimple([siteRule], { referer: "https://x.com/", externalOnly: true });
    assert.equal(out.length, 2);
    assert.equal(out[0], siteRule);
    const { id, ...fields } = out[1];
    assert.ok(id);
    assert.deepEqual(fields, { on: true, sites: "", mode: "set", referer: "https://x.com/", externalOnly: true, allRequests: false });
}
{ // existing rule: updated in place and switched on, keeping what simple mode can't edit
    const out = setSimple([siteRule, allOff], { referer: "https://x.com/", externalOnly: false });
    assert.equal(out.length, 2);
    assert.deepEqual(out[1], { ...allOff, on: true, referer: "https://x.com/" });
}
assert.deepEqual(clearSimple([siteRule, allOff, allOn]).map(r => r.id), ["site", "off"]);
assert.deepEqual(clearSimple([siteRule]).map(r => r.id), ["site"], "nothing to delete leaves the list alone");

assert.equal(defaultView([]), "simple");
assert.equal(defaultView([allOff]), "simple");
assert.equal(defaultView([siteRule]), "advanced", "simple mode could not show this rule");
assert.equal(defaultView([allOn, allOff]), "advanced");

console.log("rules: ok");
