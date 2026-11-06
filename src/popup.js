import { loadRules, saveRules, sync, restoreSession, ruleProblem, saveRule, simpleRule, setSimple, clearSimple, defaultView, parseSites, normalizeReferer } from "./rules.js";

const $ = (id) => document.getElementById(id);
const form = $("editor");
let rules = [];
let editing = null; // id of the rule being edited, null = new rule
let queue = Promise.resolve();
let view = "simple";

async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

async function reloadTab() {
    const tab = await activeTab();
    if (tab?.id !== undefined) chrome.tabs.reload(tab.id).catch(() => {});
}

function describeSites(sites) {
    let s;
    try { s = parseSites(sites); } catch (_) { return sites; } // ruleProblem explains it
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
        const problem = ruleProblem(rule);
        li.querySelector(".problem").textContent = problem && `Not applied: ${problem}`;
        li.querySelector(".problem").hidden = !problem;

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
        li.querySelector(".delete").addEventListener("click", () => {
            if (editing === rule.id) closeEditor();
            commit(list => list.filter(r => r.id !== rule.id));
        });
        list.append(li);
    });

    const on = rules.filter(r => r.on && !ruleProblem(r)).length; // same count as the badge
    $("empty").hidden = rules.length > 0;
    renderSimple(on);
    $("status").textContent = view === "simple"
        ? (isSimpleOn() ? "On" : "Off")
        : (rules.length ? `${on} of ${rules.length} on` : "");
}

const isSimpleOn = () => {
    const rule = simpleRule(rules);
    return !!rule?.on && !ruleProblem(rule);
};

function renderSimple(on) {
    const rule = simpleRule(rules);
    $("simpleReferer").value = rule?.referer ?? "";
    $("simpleExternalOnly").checked = !!rule?.externalOnly;
    $("simpleDelete").hidden = !rule;
    const problem = rule && ruleProblem(rule);
    $("simpleError").textContent = problem ? `Not applied: ${problem}` : "";
    $("simpleError").hidden = !problem;

    const others = on - (isSimpleOn() ? 1 : 0);
    $("simpleNote").textContent = others === 1
        ? "1 other rule from Advanced is also on."
        : `${others} other rules from Advanced are also on.`;
    $("simpleNote").hidden = others === 0;
}

function showView(next) {
    view = next;
    const simple = view === "simple";
    document.body.classList.toggle("wide", !simple);
    $("simple").hidden = !simple;
    $("advanced").hidden = simple;
    for (const [id, selected] of [["tabSimple", simple], ["tabAdvanced", !simple]]) {
        $(id).setAttribute("aria-selected", selected);
        $(id).tabIndex = selected ? 0 : -1;
    }
    closeEditor(); // its errors would land in a hidden panel
    $("error").hidden = true;
    render();
}

function chooseView(next) {
    showView(next);
    chrome.storage.local.set({ view: next });
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
    const id = editing;
    const fields = {
        sites: $("sites").value.trim(),
        mode: form.mode.value,
        referer: $("referer").value.trim(),
        externalOnly: $("externalOnly").checked,
        allRequests: $("allRequests").checked
    };
    try {
        parseSites(fields.sites);
        if (fields.mode === "set") fields.referer = normalizeReferer(fields.referer);
    } catch (err) {
        showError("formError", err.message);
        return;
    }
    const ok = await commit(list => saveRule(list, id, fields));
    if (ok) closeEditor();
});

form.addEventListener("change", (e) => { if (e.target.name === "mode") syncModeUI(); });
$("add").addEventListener("click", () => openEditor(null));

$("tabSimple").addEventListener("click", () => chooseView("simple"));
$("tabAdvanced").addEventListener("click", () => chooseView("advanced"));
document.querySelector(".tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = view === "simple" ? "advanced" : "simple";
    chooseView(next);
    $(next === "simple" ? "tabSimple" : "tabAdvanced").focus();
});

$("simple").addEventListener("submit", async (e) => {
    e.preventDefault();
    let referer;
    try {
        referer = normalizeReferer($("simpleReferer").value);
    } catch (err) {
        showError("simpleError", err.message);
        return;
    }
    const externalOnly = $("simpleExternalOnly").checked;
    await commit(list => setSimple(list, { referer, externalOnly }));
});
$("simpleDelete").addEventListener("click", () => commit(clearSimple));
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

// Don't rely on the worker having run: it may still be restoring, or not have woken up at all.
try {
    await restoreSession();
    await sync();
} catch (err) {
    showError("error", `Chrome rejected the rules: ${err.message}`);
}
rules = await loadRules();
const { keepAfterRestart, view: savedView } = await chrome.storage.local.get(["keepAfterRestart", "view"]);
$("keepAfterRestart").checked = !!keepAfterRestart;
showView(savedView ?? defaultView(rules));
