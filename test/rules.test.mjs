// Run: node test/rules.test.mjs
import assert from "node:assert/strict";
import { parseSites, normalizeReferer, toDnr } from "../src/rules.js";

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
console.log("rules: ok");
