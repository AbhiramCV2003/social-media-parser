// popup.js
const generateReportBtn = document.getElementById('generateReportBtn');
const examinerUsernameInput = document.getElementById('examinerUsernameInput');
const statusDiv = document.getElementById('status');
const backendUrlInput = document.getElementById('backendUrlInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const registerLinkBtn = document.getElementById('registerLinkBtn');

// --- Status Updates ---
function updateStatus(message, type = 'info') { // type: 'info', 'success', 'error'
    statusDiv.textContent = message;
    statusDiv.className = type;
    console.log(`Popup Status (${type}): ${message}`);
}

// --- Button Click Listener ---
generateReportBtn.addEventListener('click', async () => {
    const examinerUsername = examinerUsernameInput.value.trim();

    if (!examinerUsername) {
        updateStatus("Please enter your examiner username.", 'error');
        return;
    }

    updateStatus(`Initiating report for examiner ${examinerUsername}...`, 'info');
    generateReportBtn.disabled = true;
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error("Active tab not found.");
        if (!tab.url || !/https?:\/\/(?:www\.)?(x\.com|twitter\.com|instagram\.com|facebook\.com)\//.test(tab.url)) {
            throw new Error("Not on a supported page (X, Insta, FB).");
        }

        // Send message to service worker, including the examiner username
        chrome.runtime.sendMessage({
            action: "generateFullReport",
            tabId: tab.id,
            tabUrl: tab.url,
            examinerUsername: examinerUsername
        }, (response) => {
             if (chrome.runtime.lastError) {
                console.error("Error sending generateFullReport message:", chrome.runtime.lastError.message);
                updateStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
                 generateReportBtn.disabled = false;
            } else if (response) {
                console.log("Response from service worker (initiation):", response);
                updateStatus(response.status || 'Report generation started.', response.error ? 'error' : 'info');
            } else {
                 updateStatus("No immediate response from service worker (might be starting).", 'info');
                 console.warn("No immediate response from service worker message.");
            }
        });

    } catch (error) {
        console.error("Error initiating report generation:", error);
        updateStatus(`Error: ${error.message}`, 'error');
        generateReportBtn.disabled = false;
    }
});


// --- Settings Management ---
saveSettingsBtn.addEventListener('click', () => {
    const backendUrl = backendUrlInput.value.trim();
    const examinerUsername = examinerUsernameInput.value.trim();
    try {
        new URL(backendUrl);
        if (!backendUrl.startsWith('http')) throw new Error("URL must start with http or https.");

        const settingsToSave = { backendApiUrl: backendUrl };
        if (examinerUsername) {
            settingsToSave.lastExaminerUsername = examinerUsername;
        }

        chrome.storage.local.set(settingsToSave, () => {
            if (chrome.runtime.lastError) {
                 updateStatus(`Error saving settings: ${chrome.runtime.lastError.message}`, 'error');
            } else {
                 updateStatus('Settings saved.', 'success');
                 console.log('Settings saved:', settingsToSave);
            }
        });
    } catch (error) {
        updateStatus(`Invalid URL: ${error.message}`, 'error');
    }
});

// Load saved settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['backendApiUrl', 'lastExaminerUsername'], (result) => {
        const defaultUrl = 'http://localhost:5001/api/report';
        const loadedUrl = result.backendApiUrl || defaultUrl;
        backendUrlInput.value = loadedUrl;
        console.log("Loaded backend URL:", loadedUrl);

        if (result.lastExaminerUsername) {
            examinerUsernameInput.value = result.lastExaminerUsername;
            console.log("Loaded last username:", result.lastExaminerUsername);
        }
    });
});

// --- Listener for updates FROM Service Worker ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updatePopupStatus") {
        updateStatus(request.message, request.type || 'info');
        if (request.type === 'success' || request.type === 'error') {
            generateReportBtn.disabled = false;
        }
    }
});

// --- Register Button/Link Logic ---
registerLinkBtn.addEventListener('click', () => {
    const registerUrl = 'http://localhost:5173/register'; // <<< CHANGE TO YOUR FRONTEND URL
     chrome.tabs.create({ url: registerUrl });
});