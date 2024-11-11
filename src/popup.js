document.getElementById("setReferer").addEventListener("click", () => {
    const referer = document.getElementById("referer").value;
    chrome.storage.local.set({ referer }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;
  
        chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.location.reload()
        });
  
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId },
            func: () => window.location.reload()
          });
        }, 1000);
      });
    });
  });
  