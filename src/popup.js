import { loadRules, saveRules, parseSites, normalizeReferer } from "./rules.js";

const $ = (id) => document.getElementById(id);
const form = $("editor");
let rules = [];
let editing = null; // id of the rule being edited, null = new rule
let queue = Promise.resolve();

async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

async function reloadTab() {
    const tab = await activeTab();
    if (tab?.id !== undefined) chrome.tabs.reload(tab.id).catch(() => {});
}

function describeSites(sites) {
    const s = parseSites(sites);
    if (s.all) return "All sites";
    if (s.urlFilter) return `URLs matching ${s.urlFilter}`;
    return s.domains.join(", ");
}

function render() {
    const list = $("rules");
    list.replaceChildren();
    rules.forEach((rule) => {
        const li = $("ruleTpl").content.firstElementChild.cloneNode(true);
        li.classList.toggle("off", !rule.on);
        const target = describeSites(rule.sites);
        li.querySelector(".target").textContent = target;
        li.querySelector(".value").textContent = rule.mode === "remove" ? "(removed)" : rule.referer;
        const flags = [rule.externalOnly && "links from other sites only", rule.allRequests && "all requests"].filter(Boolean);
        li.querySelector(".flags").textContent = flags.join(", ");
        li.querySelector(".flags").hidden = !flags.length;

        const toggle = li.querySelector(".on");
        toggle.checked = rule.on;
        toggle.setAttribute("aria-label", `Rule for ${target}`);
        toggle.addEventListener("change", () => {
            const on = toggle.checked;
            commit(list => list.map(r => r.id === rule.id ? { ...r, on } : r));
        });
        li.querySelector(".edit").setAttribute("aria-label", `Edit rule for ${target}`);
        li.querySelector(".delete").setAttribute("aria-label", `Delete rule for ${target}`);
        li.querySelector(".edit").addEventListener("click", () => openEditor(rule.id));
        li.querySelector(".delete").addEventListener("click", () => commit(list => list.filter(r => r.id !== rule.id)));
        list.append(li);
    });

    const on = rules.filter(r => r.on).length;
    $("empty").hidden = rules.length > 0;
    $("status").textContent = rules.length ? `${on} of ${rules.length} on` : "";
}

// Changes run one after another, each on top of the previous result.
function commit(change) {
    const run = queue.then(async () => {
        $("error").hidden = true;
        const next = change(rules);
        try {
            await saveRules(next);
            rules = next;
            render();
            await reloadTab();
            return true;
        } catch (err) {
            render(); // undo the optimistic toggle
            showError(form.hidden ? "error" : "formError", `Chrome rejected the rule: ${err.message}`);
            return false;
        }
    });
    queue = run;
    return run;
}

function showError(id, msg) {
    $(id).textContent = msg;
    $(id).hidden = false;
}

function syncModeUI() {
    const remove = form.mode.value === "remove";
    $("referer").disabled = remove;
}

function openEditor(id) {
    editing = id;
    const r = rules.find(r => r.id === id) || { sites: "", mode: "set", referer: "", externalOnly: false, allRequests: false };
    $("editorTitle").textContent = id ? "Edit rule" : "New rule";
    $("sites").value = r.sites;
    form.mode.value = r.mode;
    $("referer").value = r.referer;
    $("externalOnly").checked = r.externalOnly;
    $("allRequests").checked = r.allRequests;
    $("formError").hidden = true;
    syncModeUI();
    form.hidden = false;
    $("add").hidden = true;
    $("sites").focus();
}

function closeEditor() {
    form.hidden = true;
    $("add").hidden = false;
    editing = null;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rule = {
        id: editing ?? crypto.randomUUID(),
        on: true,
        sites: $("sites").value.trim(),
        mode: form.mode.value,
        referer: $("referer").value.trim(),
        externalOnly: $("externalOnly").checked,
        allRequests: $("allRequests").checked
    };
    try {
        parseSites(rule.sites);
        if (rule.mode === "set") rule.referer = normalizeReferer(rule.referer);
    } catch (err) {
        showError("formError", err.message);
        return;
    }
    const ok = await commit(list => list.some(r => r.id === rule.id) ? list.map(r => r.id === rule.id ? rule : r) : [...list, rule]);
    if (ok) closeEditor();
});

form.addEventListener("change", (e) => { if (e.target.name === "mode") syncModeUI(); });
$("add").addEventListener("click", () => openEditor(null));
$("cancel").addEventListener("click", closeEditor);
form.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); closeEditor(); } });

$("thisSite").addEventListener("click", async () => {
    const tab = await activeTab();
    try {
        const host = new URL(tab.url).hostname;
        if (host) $("sites").value = host.replace(/^www\./, "");
    } catch (_) {}
});

$("keepAfterRestart").addEventListener("change", (e) => {
    chrome.storage.local.set({ keepAfterRestart: e.target.checked });
});

rules = await loadRules();
const { keepAfterRestart } = await chrome.storage.local.get("keepAfterRestart");
$("keepAfterRestart").checked = !!keepAfterRestart;
render();
