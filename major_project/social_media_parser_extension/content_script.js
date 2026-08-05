// social-parser-extension/content_script.js
console.log("Parser Helper Content Script Initialized/Injected.");

// --- Helper: Get Platform ---
function getPlatform() {
    const hostname = window.location.hostname;
    console.log(`[CS getPlatform] Checking hostname: "${hostname}"`);
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) return 'twitter';
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('facebook.com')) return 'facebook';
    console.warn("[CS getPlatform] Hostname did not match supported platforms.");
    return 'unknown';
}

// --- Scraping Functions (EXAMPLES - *** UPDATE SELECTORS!!! ***) ---

// --- Scrape Twitter/X Profile ---
function scrapeTwitterProfileData() {
    console.log("[CS] Running scrapeTwitterProfileData");
    const data = { profile: {}, platform: 'twitter', error: null };
    try {
        // ====> USE YOUR VERIFIED X.COM SELECTORS HERE <====
        const userNameContainer = document.querySelector('[data-testid="UserName"]');
        if (userNameContainer) {
             data.profile.name = userNameContainer.querySelector('div[dir="ltr"] > span > span')?.innerText.trim() || null;
             data.profile.handle = userNameContainer.querySelector('div[tabindex="-1"] span')?.innerText.trim() || null;
             if (!data.profile.name || !data.profile.handle) {
                 console.warn('[CS] Specific name/handle selectors failed, attempting fallback...');
                 const allSpans = Array.from(userNameContainer.querySelectorAll('span')).map(s => s.innerText.trim()).filter(s => s);
                 if (!data.profile.name && allSpans.length > 0) data.profile.name = allSpans[0];
                 if (!data.profile.handle) data.profile.handle = allSpans.find(s => s && s.startsWith('@'));
             }
        } else { console.warn("[CS] Twitter UserName container not found.");}

        data.profile.bio = document.querySelector('div[data-testid="UserDescription"]')?.innerText.trim() || null;

        const headerItemsContainer = document.querySelector('[data-testid="UserProfileHeader_Items"]');
        if (headerItemsContainer) {
             data.profile.location = headerItemsContainer.querySelector('span[data-testid="UserLocation"] span > span')?.innerText.trim() || null;
             data.profile.website = headerItemsContainer.querySelector('a[data-testid="UserUrl"] span')?.innerText.trim() || null;
             data.profile.joinDate = headerItemsContainer.querySelector('span[data-testid="UserJoinDate"] span')?.innerText.trim() || null;
        } else { console.warn("[CS] Twitter UserProfileHeader_Items container not found.");}

         const followingLink = document.querySelector('a[href$="/following"]');
         if (followingLink) data.profile.followingCount = followingLink.querySelector('span:first-child > span:first-child')?.innerText.trim() || null;
         const followersLink = document.querySelector('a[href$="/verified_followers"], a[href$="/followers"]');
          if (followersLink) data.profile.followersCount = followersLink.querySelector('span:first-child > span:first-child')?.innerText.trim() || null;

        if (!data.profile.name && !data.profile.handle) {
            data.profile.error = "Failed to extract key Twitter profile name/handle.";
        }
        console.log("[CS] Extracted Twitter Profile:", data.profile);
    } catch (err) { data.profile.error = `Scraping Error: ${err.message}`; }
    // Propagate error if one occurred
    if(data.profile.error) data.error = data.profile.error;
    return data;
}

// --- Scrape Instagram Profile ---
function scrapeInstagramProfileData() {
    console.log("[CS] Running scrapeInstagramProfileData");
    const data = { profile: {}, platform: 'instagram', error: null };
    console.warn("[CS] Instagram selectors are highly unstable.");
    try {
        // ====> USE YOUR (VERY UNSTABLE) INSTAGRAM SELECTORS HERE <====
        data.profile.username = document.querySelector('header section h2')?.innerText.trim() || null;
        data.profile.isVerified = (document.querySelector('svg[aria-label="Verified"]') !== null);
         const listItems = document.querySelectorAll('header section ul li');
         if(listItems.length >= 3) {
             const parseStatText = (item) => { try { const text = item.innerText; const match = text.match(/([\d,.]+k?m?)/i); return match ? match[0] : null; } catch { return null; } };
             data.profile.postsCount = parseStatText(listItems[0]);
             data.profile.followersCount = parseStatText(listItems[1]);
             data.profile.followingCount = parseStatText(listItems[2]);
         }
        data.profile.name = document.querySelector('section[class*="xc3tme8"] > div > span')?.innerText.trim() || data.profile.username;
        data.profile.bio = document.querySelector('section[class*="xc3tme8"] span._ap3a')?.innerText.trim() || document.querySelector('section ul + div > span + span')?.innerText.trim() || null;
        const websiteLinkElement = document.querySelector('a[rel~="me"] span');
        data.profile.website = websiteLinkElement ? websiteLinkElement.innerText.trim() : null;

        if (!data.profile.followersCount && !data.profile.followingCount) data.profile.error = "Failed to extract key Insta elements. Login wall likely.";
        console.log("[CS] Extracted Instagram Profile (Limited):", data.profile);
    } catch (err) { data.profile.error = `Scraping Error: ${err.message}`; }
    if(data.profile.error) data.error = data.profile.error;
    return data;
}

// --- Scrape Facebook Profile ---
function scrapeFacebookProfileData() {
     console.log("[CS] Running scrapeFacebookProfileData");
     const data = { profile: {}, platform: 'facebook', error: null };
     console.warn("[CS] Facebook scraping is very limited.");
     try {
        // ====> USE YOUR (VERY LIMITED) FACEBOOK SELECTORS HERE <====
        data.profile.name = document.querySelector('h1')?.innerText.trim() || null;
         if (!data.profile.name) data.profile.error = "Failed to extract FB name. Login wall likely.";
         console.log("[CS] Extracted Facebook Profile (Limited):", data.profile);
     } catch (err) { data.profile.error = `Scraping Error: ${err.message}`; }
      if(data.profile.error) data.error = data.profile.error;
     return data;
}

// --- Scrape Visible Posts (Only Implemented for Twitter here) ---
function scrapeVisiblePosts(platform) {
    console.log(`[CS] Scraping visible posts for ${platform}`);
    const data = { posts: [], platform: platform, error: null };
    try {
        if (platform === 'twitter') {
             console.log("[CS] Attempting to find posts with selector: article[data-testid='tweet']");
             // *** VERIFY ALL TWEET SELECTORS ***
             const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');
             console.log(`[CS] Found ${tweetArticles.length} visible tweet articles.`);
             tweetArticles.forEach((tweet, index) => {
                 const textEl = tweet.querySelector('[data-testid="tweetText"]');
                 const timeEl = tweet.querySelector('time[datetime]');
                 const linkEl = tweet.querySelector('a[href*="/status/"]');
                 const statusUrl = linkEl ? linkEl.href : null;
                 const postId = statusUrl ? statusUrl.split('/status/')[1]?.split('?')[0] : null;
                 data.posts.push({
                     id: postId || `fallback_${Date.now()}_${index}`,
                     text: textEl ? textEl.innerText.trim() : null,
                     timestamp: timeEl ? timeEl.getAttribute('datetime') : null,
                     url: statusUrl
                 });
             });
             if (tweetArticles.length === 0 && !data.error) { // Only set error if no other error exists
                data.error = "No posts found using current selector.";
                console.log(data.error);
             }
        } else {
            // Indicate posts not scraped for other platforms
            data.posts = []; // Ensure posts array is empty for non-twitter
            data.error = `Post scraping not available publicly for ${platform}.`;
            console.warn(data.error);
        }
    } catch(err) {
         console.error("[CS] Error during post scrape:", err);
         data.error = `Scraping Error: ${err.message}`;
    }
    console.log("[CS] Returning data from scrapeVisiblePosts:", data);
    return data;
} // --- End scrapeVisiblePosts ---


// --- Message Listener (Responds to Service Worker) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Content Script] Message received:", request.action);
    let responseData = { error: "Platform not detected or function missing" }; // Default error
    const platform = getPlatform();

    try {
        if (request.action === "requestProfileScrape") {
            // Call the correct platform-specific function
            if (platform === 'twitter') { responseData = scrapeTwitterProfileData(); }
            else if (platform === 'instagram') { responseData = scrapeInstagramProfileData(); }
            else if (platform === 'facebook') { responseData = scrapeFacebookProfileData(); }
            else { responseData = { platform: 'unknown', error: `Unsupported platform for profile scrape: ${platform}` }; }
            console.log("[CS] Responding with profile data for requestProfileScrape");

        } else if (request.action === "requestPostsScrape") {
            // Call scrapeVisiblePosts, which handles platform check internally
            responseData = scrapeVisiblePosts(platform);
            console.log("[CS] Responding with posts data for requestPostsScrape");

        } else {
            console.log("[CS] Ignoring unknown action:", request.action);
            responseData = { error: "Unknown action for content script" };
        }
    } catch (e) {
        // Catch any unexpected errors during function calls
        console.error(`[CS] Unexpected error processing action ${request.action}:`, e);
        responseData = { platform: platform, error: `Internal content script error: ${e.message}` };
    }

    // Send the response back to the service worker
    sendResponse(responseData);

    // Indicate synchronous response handling
    return false;
}); // --- End Message Listener ---

console.log("Parser Helper Content Script Initialized/Active."); // Log on initial load