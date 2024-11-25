function reloadActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs[0]) {
          console.error("Erreur lors de la récupération de l'onglet actif :", chrome.runtime.lastError);
          return;
      }
      chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => window.location.reload()
      });
  });
}


function updateDynamicRules(addRules = [], removeRuleIds = []) {
  chrome.declarativeNetRequest.updateDynamicRules({ addRules, removeRuleIds }, () => {
      if (chrome.runtime.lastError) {
          console.error("Erreur lors de la mise à jour des règles :", chrome.runtime.lastError);
      } else {
          reloadActiveTab();
      }
  });
}

document.getElementById("setReferer").addEventListener("click", () => {
  const referer = document.getElementById("referer").value.trim();
  if (!referer) {
      console.warn("Le champ Referer est vide.");
      return;
  }

  chrome.storage.local.set({ referer }, () => {
      if (chrome.runtime.lastError) {
          console.error("Erreur lors de l'enregistrement du referer :", chrome.runtime.lastError);
          return;
      }

      const rule = {
          id: 1,
          priority: 1,
          action: {
              type: "modifyHeaders",
              requestHeaders: [
                  { header: "Referer", operation: "set", value: referer }
              ]
          },
          condition: {
              urlFilter: "*",
              resourceTypes: ["main_frame"]
          }
      };

      updateDynamicRules([rule], [1]);
  });
});

document.getElementById("deleteReferer").addEventListener("click", () => {
  chrome.storage.local.remove("referer", () => {
      if (chrome.runtime.lastError) {
          console.error("Erreur lors de la suppression du referer :", chrome.runtime.lastError);
          return;
      }
      updateDynamicRules([], [1]);
  });
});
