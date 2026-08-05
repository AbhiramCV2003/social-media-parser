// backend/controllers/reportController.js
const User = require('../models/User'); // <-- Require User model
const Report = require('../models/Report');
const reportQueue = require('../queues/reportQueue'); // Ensure correct path
// --- Require GCS/Presigner for download ---
const { Storage } = require('@google-cloud/storage');
// const { getSignedUrl } = require('@google-cloud/storage').v4; // getSignedUrl is on file object

// Controller to RECEIVE data, VERIFY USERNAME, and QUEUE PDF generation
const receiveReportData = async (req, res) => {
    console.log('Backend received data payload with username.');
    // Destructure data including examinerUsername
    const { scrapedUrl, platform, content, examinerUsername } = req.body; // <-- Get username

    // --- Validation ---
    if (!platform || !content || !examinerUsername) {
        console.error('Validation Error: Missing platform, content, or examinerUsername in payload.');
        return res.status(400).json({ message: 'Missing platform, content, or examiner username in payload' });
    }
    const allowedPlatforms = ['twitter', 'facebook', 'instagram', ];
    const receivedPlatformLower = platform.toLowerCase();
    if (!allowedPlatforms.includes(receivedPlatformLower)) {
         console.error(`Validation Error: Received invalid platform '${platform}' from user ${examinerUsername}`);
         return res.status(400).json({ message: `Invalid or unsupported platform received: ${platform}` });
    }
    // --- End Validation ---

    try {
        // --- Verify Examiner Username ---
        const examinerUser = await User.findOne({ username: examinerUsername.toLowerCase() });

        if (!examinerUser) {
            console.warn(`Examiner username "${examinerUsername}" not found.`);
            // Send 404 specific to user not found
            return res.status(404).json({ message: `Examiner username "${examinerUsername}" not found. Please register via the web app.` });
        }
        const examinerUserId = examinerUser._id; // Get the ID of the found examiner
        // --- End Verification ---


        // Determine identifier for the report (target profile/page)
        let identifierForDb = 'Unknown';
        if (receivedPlatformLower === 'screenshot') { identifierForDb = scrapedUrl || 'Screenshot'; }
        else if (content.profile) { identifierForDb = content.profile.handle || content.profile.username || receivedPlatformLower; }
        else if (content.posts && content.posts.length > 0 && content.posts[0].url) {
            try { const urlParts = new URL(content.posts[0].url); const pathParts = urlParts.pathname.split('/'); if (pathParts.length > 1 && pathParts[1] !== 'status') identifierForDb = pathParts[1]; else identifierForDb = receivedPlatformLower; } catch (e) { identifierForDb = receivedPlatformLower; }
        }
        else { identifierForDb = receivedPlatformLower; }
        identifierForDb = identifierForDb.substring(0, 100);


        // Create Report record - Associate with VERIFIED examinerUserId
        const newReport = new Report({
            user: examinerUserId, // <-- Associate with the verified examiner
            platform: receivedPlatformLower,
            scrapedUrl: scrapedUrl,
            targetIdentifier: identifierForDb,
            status: 'Received',
        });

        const savedReport = await newReport.save();

        // Add job to queue - Pass necessary info
        await reportQueue.add('process-report', { // Job name matches worker listener
            reportId: savedReport._id.toString(),
            platform: savedReport.platform,
            scrapedUrl: scrapedUrl,
            content: content, // Pass the full content payload
            targetIdentifier: savedReport.targetIdentifier, // Pass identifier for PDF title etc.
            userId: examinerUserId // Optional: pass examiner ID to worker if needed downstream
        });
        // Respond quickly to the extension
        res.status(202).json({ message: 'Data received, user verified, queued for PDF processing.', reportId: savedReport._id });

    } catch (error) {
         console.error('Error receiving report data or queuing job:', error);
         if (error.name === 'ValidationError') { return res.status(400).json({ message: `Data validation failed: ${error.message}` }); }
         res.status(500).json({ message: 'Server error while processing received data.' });
     }
};

// --- listReports controller ---
// Assumes authentication happens via 'protect' middleware called from web app
const listReports = async (req, res) => {
    try {
        const userId = req.userId; // Get ID from protect middleware

        // --- ADDED LOGGING: Check ID received from middleware ---
        console.log(`[listReports Controller] Received request to list reports for user ID: ${userId}`);
        // -------------------------------------------------------

        if (!userId) {
            // Added explicit check and log if ID is missing after middleware
            console.error('[listReports Controller] Error: User ID is missing from request after protect middleware.');
            return res.status(401).json({ message: 'Not authorized (User ID missing)' });
        }

        // --- ADDED LOGGING: Log the exact query being made ---
        console.log(`[listReports Controller] Querying DB: Report.find({ user: "${userId}" })`);
        // -----------------------------------------------------

        const reports = await Report.find({ user: userId }) // <-- FILTER BY USER ID
                                   .sort({ createdAt: -1 })
                                   .limit(50)
                                   .select('-content'); // Keep select for now, can remove if needed

        // --- ADDED LOGGING: Log the result of the query ---
        if (reports.length > 0) {
             console.log(`[listReports Controller] User ID stored in the first found report: ${reports[0].user}`);
        }
        // ---------------------------------------------------

        res.status(200).json(reports); // Send the potentially empty array

    } catch (error) {
         // Log the specific user ID associated with the error
         console.error(`Error listing reports for user ${req.userId}:`, error);
         res.status(500).json({ message: 'Server error listing reports.' });
    }
};

// --- downloadReport controller ---
// Assumes authentication happens via 'protect' middleware called from web app
 const downloadReport = async (req, res) => {
     const { reportId } = req.params;
     const userId = req.userId; // Get ID from protect middleware
     if (!userId) return res.status(401).json({ message: 'Not authorized' });

     const bucketName = process.env.GCS_BUCKET_NAME;
     if (!bucketName || !process.env.GOOGLE_APPLICATION_CREDENTIALS) { /* ... error handling ... */ }

     try {
         console.log(`User ${userId} requesting download for report ${reportId}`);
         // Find report AND verify ownership by user ID
         const report = await Report.findOne({ _id: reportId, user: userId }); // <-- CHECK OWNERSHIP

         if (!report) return res.status(404).json({ message: 'Report not found or access denied.' });
         if (report.status !== 'Completed' || !report.pdfUrl) return res.status(400).json({ message: 'Report processing not complete or PDF missing.' });
         // Basic check for GCS URL format
         if (!report.pdfUrl.includes('storage.googleapis.com')) return res.status(500).json({ message: 'Stored report URL format is invalid.' });

         // Extract GCS Object Name
         let finalObjectName;
         try {
             const urlParts = new URL(report.pdfUrl);
             const objectPath = urlParts.pathname.startsWith('/') ? urlParts.pathname.substring(1) : urlParts.pathname;
             const pathParts = objectPath.split('/');
             if (pathParts[0] === bucketName) pathParts.shift();
             finalObjectName = pathParts.join('/');
             if (!finalObjectName) throw new Error('Parsed object name is empty');
         } catch (parseError) { throw new Error('Could not parse object name from stored pdfUrl'); }
         console.log(`[Download ${reportId}] Extracted object name: ${finalObjectName}`);

         // Generate GCS Signed URL
         const storage = new Storage(); // Uses GOOGLE_APPLICATION_CREDENTIALS
         const options = { version: 'v4', action: 'read', expires: Date.now() + 15 * 60 * 1000 };
         const [signedUrl] = await storage.bucket(bucketName).file(finalObjectName).getSignedUrl(options);

         console.log(`[Download ${reportId}] Generated GCS signed URL.`);
         res.status(200).json({ downloadUrl: signedUrl });

     } catch (error) {
          console.error(`Error generating download URL for report ${reportId} by user ${userId}:`, error);
          if (error.name === 'CastError') { return res.status(400).json({ message: 'Invalid report ID format.' }); }
          if (error.message.includes('Could not parse object name')) { return res.status(500).json({ message: 'Server error processing stored report URL.' }); }
          if (error.code && error.errors) { return res.status(500).json({ message: `Storage access error: ${error.message}` }); }
          res.status(500).json({ message: 'Server error generating download link.' });
     }
 }; // --- End downloadReport ---

module.exports = { receiveReportData, listReports, downloadReport };