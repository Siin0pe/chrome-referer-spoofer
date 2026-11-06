import { restoreSession } from "./rules.js";

chrome.action.setBadgeBackgroundColor({ color: "#2B3FBF" });

const start = () => restoreSession().catch(err => console.error("Could not restore rules:", err));

// Chrome only wakes a service worker for events it listens to, so these two make it run at
// browser start and on install/update. The direct call covers any other wake-up, such as
// re-enabling the extension. restoreSession only does its work once per session.
chrome.runtime.onStartup.addListener(start);
chrome.runtime.onInstalled.addListener(start);
start();
