// service_worker.js
console.log("Parser Helper Service Worker Started.");

// --- Helper function to send FINAL aggregated data to backend ---
async function sendToBackend(finalPayload, examinerUsername) { // Added examinerUsername param
    console.log(`[Service Worker] Attempting to send FINAL data to backend for examiner: ${examinerUsername}...`);
    let backendApiUrl;
    // Helper to send status updates back to popup
    const updatePopup = (message, type = 'info') => {
         chrome.runtime.sendMessage({ action: "updatePopupStatus", message: message, type: type }).catch(e => {}); // Ignore errors if popup closed
    };

     try {
        const result = await chrome.storage.local.get(['backendApiUrl']);
        backendApiUrl = result.backendApiUrl;
        if (!backendApiUrl) throw new Error("Backend API URL is not configured.");

        const reportEndpoint = backendApiUrl; // Assumes URL includes /api/report path

        // Add examiner username to the payload being sent
        finalPayload.examinerUsername = examinerUsername;

        console.log("[Service Worker] Sending final payload to:", reportEndpoint);

        const response = await fetch(reportEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload) // Send payload including username
        });

        const responseBody = await response.text();

        if (!response.ok) {
             let backendErrorMsg = responseBody;
             try { backendErrorMsg = JSON.parse(responseBody).message || responseBody; } catch (e) {}
             console.error(`[Service Worker] Backend Error: ${response.status} ${response.statusText}. Body: ${responseBody}`);
             throw new Error(`Backend Error ${response.status}: ${backendErrorMsg}`);
        }

        console.log("[Service Worker] Backend response:", responseBody);
        updatePopup("Report submitted successfully!", 'success'); // Final success message

    } catch (error) {
         console.error("[Service Worker] Error in sendToBackend:", error);
         updatePopup(`Backend Send Error: ${error.message}`, 'error'); // Final error message
    }
}

// --- Helper function to request data FROM content script ---
async function requestDataFromContentScript(tabId, action) {
    console.log(`[Service Worker] Requesting '${action}' from content script in tab ${tabId}`);
     try {
         await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content_script.js'] });
         const response = await chrome.tabs.sendMessage(tabId, { action: action });
         console.log(`[Service Worker] Received response for '${action}'.`);
         if (!response) throw new Error(`No response received from content script for ${action}.`);
         if (response.error) console.warn(`[Service Worker] Content script reported error for '${action}': ${response.error}`);
         return response; // Return full response {profile/posts, platform, error}
     } catch (error) {
          console.error(`[Service Worker] Error communicating with content script for '${action}':`, error);
          return { error: `Failed to execute or get response for ${action}: ${error.message}` };
     }
}


// --- Main Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Service Worker] Message received:", request.action);

    if (request.action === "generateFullReport") {
        const { tabId, tabUrl, examinerUsername } = request; // Get username from popup
        if (!tabId || !tabUrl || !examinerUsername) {
             console.error("generateFullReport message missing tabId, tabUrl, or examinerUsername.");
             sendResponse({ status: "Error: Missing required info from popup.", error: true });
             return false;
        }

        sendResponse({ status: "Generation started...", error: false }); // Acknowledge

        // --- Start the asynchronous generation sequence ---
        (async () => {
            console.log(`[Service Worker] Starting full report sequence for examiner ${examinerUsername}, tab ${tabId}`);
            const updatePopup = (message, type = 'info') => {
                  chrome.runtime.sendMessage({ action: "updatePopupStatus", message: message, type: type }).catch(e => {});
             };

             let aggregatedContent = { profile: null, posts: [], screenshotDataUrl: null, error: null };
             let platform = 'unknown';
             let finalPayload = {};
             let overallError = null; // Track critical errors

             try {
                // 1. Request Profile Info
                updatePopup("Scraping profile info...", 'info');
                const profileResult = await requestDataFromContentScript(tabId, 'requestProfileScrape');
                platform = profileResult.platform || platform;
                aggregatedContent.profile = profileResult.profile; // Store profile data
                if (profileResult.error) {
                     console.warn("Profile scraping issue:", profileResult.error);
                     if(aggregatedContent.profile) aggregatedContent.profile.error = profileResult.error;
                     else aggregatedContent.profile = { error: profileResult.error };
                     // Make error critical only if essential info missing
                     if (!aggregatedContent.profile.name && !aggregatedContent.profile.handle && platform !== 'unknown') {
                         overallError = `Profile scraping failed: ${profileResult.error}`;
                         updatePopup(overallError, 'error');
                         // Optional: throw new Error(overallError); // Stop sequence if needed
                     } else { updatePopup(`Profile scrape warning: ${profileResult.error}`, 'info'); }
                }

                // 2. Request Posts Info (only if no CRITICAL error so far)
                if (!overallError) {
                     updatePopup("Scraping visible posts...", 'info');
                     const postsResult = await requestDataFromContentScript(tabId, 'requestPostsScrape');
                     aggregatedContent.posts = postsResult.posts || [];
                     if (postsResult.error) console.warn("Post scraping issue:", postsResult.error);
                }

                 // 3. Take Screenshot (only if no CRITICAL error so far)
                 if (!overallError) {
                     updatePopup("Taking screenshot...", 'info');
                     try {
                         aggregatedContent.screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
                         if (!aggregatedContent.screenshotDataUrl) throw new Error("captureVisibleTab returned empty.");
                         console.log("[Service Worker] Screenshot captured for aggregation.");
                     } catch (screenshotError) {
                          console.error("[Service Worker] Screenshot capture failed:", screenshotError.message);
                          updatePopup(`Screenshot failed: ${screenshotError.message}`, 'warning'); // Treat as warning
                     }
                 }

                // 4. Prepare Final Payload and Send to Backend
                // Include the overall error if one occurred during scraping
                if (overallError) aggregatedContent.error = overallError;
                updatePopup("Sending data to backend...", 'info');
                 finalPayload = {
                    scrapedUrl: tabUrl,
                    scrapedTimestamp: new Date().toISOString(),
                    platform: platform,
                    content: aggregatedContent
                    // examinerUsername passed directly to sendToBackend now
                 };
                 console.log("[Service Worker] Final Payload prepared:", JSON.stringify(finalPayload, null, 2)); // Log the formatted payload
                 console.log(`[Service Worker] Examiner username being sent: ${examinerUsername}`);
                 await sendToBackend(finalPayload, examinerUsername); // Pass username

             } catch (error) { // Catch critical errors stopping the sequence
                  console.error("[Service Worker] Full report generation sequence failed:", error);
                  updatePopup(`Report Failed: ${error.message}`, 'error');
             }
        })(); // End async sequence execution

        return true; // Indicate async handling

    } // End generateFullReport handler

    // --- Deprecated Direct Screenshot Handler (Can be removed if only using Full Report) ---
    // else if (request.action === "takeScreenshot") {
    //     // ... logic from message_158.md if needed ...
    // }

    // Default case if action isn't handled
    console.warn(`[Service Worker] Unhandled action type: ${request.action}`);
    return true; // Keep channel open briefly just in case
}); // End Message Listener

console.log("Parser Helper Service Worker Initialized/Re-Initialized.");