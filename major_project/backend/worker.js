// backend/worker.js - PDF Processing Focus
const { Worker } = require('bullmq');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs'); // Use standard fs for streams
const fsPromises = require('fs').promises; // Use promise-based fs for unlink later
const PDFDocument = require('pdfkit'); // Require pdfkit
const { setTimeout } = require('timers/promises'); // Use promise-based setTimeout
const { Storage } = require('@google-cloud/storage');

dotenv.config();
const connectDB = require('./config/db');
const Report = require('./models/Report');

// Redis connection details (Reads from .env)
const redisConnection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    enableReadyCheck: true,
    maxRetriesPerRequest: null
};

// --- Helper: Generate PDF ---
async function generatePdfReport(reportId, platform, targetIdentifier, content, scrapedUrl) {
    console.log(`[Worker ${reportId}] Generating PDF...`);
    // Create a unique temp path within the backend directory (or use OS temp dir)
    const tempDir = path.join(__dirname, 'temp_pdfs'); // Create a temp directory if needed
    try {
        await fsPromises.mkdir(tempDir, { recursive: true }); // Ensure temp directory exists
    } catch (dirError) {
        console.error(`[Worker ${reportId}] Error creating temp PDF directory:`, dirError);
        throw new Error('Failed to create temporary directory for PDF.'); // Propagate error
    }
    const tempPdfPath = path.join(tempDir, `report_${reportId}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true }); // bufferPages might help with complex layouts/page counting
    const writeStream = require('fs').createWriteStream(tempPdfPath); // Use standard fs for stream
    doc.pipe(writeStream);

    try {
        // --- PDF Content ---
        // --- Title Page ---
        doc.fontSize(20).text(`Social Media Analysis Report`, { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(14).text(`Platform: ${platform.toUpperCase()}`, { align: 'center' });
        doc.text(`Target: ${targetIdentifier}`, { align: 'center' }); // Use targetIdentifier passed to job
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Report ID: ${reportId}`, { align: 'center' });
        doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' }); // Use toLocaleString for readability
        if (scrapedUrl) {
            doc.moveDown(0.5);
            doc.fillColor('blue').text(scrapedUrl, { link: scrapedUrl, underline: true, align: 'center' });
            doc.fillColor('black'); // Reset color
        }
        doc.addPage(); // Move to next page for content

        // --- Handle Screenshot Platform ---
        if (platform === 'screenshot' && content.screenshotDataUrl) {
            doc.fontSize(16).text('Captured Screenshot', { underline: true });
            doc.moveDown();
            try {
                // Use the temporary saved screenshot path if available - THIS PATH NEEDS TO BE PASSED CORRECTLY
                const screenshotFullPath = content.screenshotPath; // Assuming this path is passed in 'content'
                if (screenshotFullPath && require('fs').existsSync(screenshotFullPath)) {
                     console.log(`[Worker ${reportId}] Embedding screenshot from path: ${screenshotFullPath}`);
                     doc.image(screenshotFullPath, { fit: [doc.page.width - 100, doc.page.height - 150], align: 'center', valign: 'top' });
                } else {
                    // Fallback to embedding base64 directly if path wasn't passed/found
                    console.log(`[Worker ${reportId}] Embedding screenshot from data URL (fallback).`);
                    const base64Data = content.screenshotDataUrl.replace(/^data:image\/png;base64,/, "");
                    const imgBuffer = Buffer.from(base64Data, 'base64');
                     doc.image(imgBuffer, { fit: [doc.page.width - 100, doc.page.height - 150], align: 'center', valign: 'top' });
                }
            } catch (imgError) {
                console.error(`[Worker ${reportId}] Error embedding screenshot:`, imgError);
                doc.fillColor('red').text(`\nError embedding screenshot: ${imgError.message}`); // Add newline
                doc.fillColor('black');
             }
        }
        // --- Handle Scraping Error ---
        else if (content.error || content.profile?.error) {
            doc.fontSize(16).text('Scraping Result: FAILED', { underline: true }); // Removed color here for clarity
            doc.moveDown();
            doc.fillColor('red').fontSize(12);
            doc.text(`Error details: ${content.error || content.profile.error}`);
            doc.fillColor('black'); // Reset color
            // Optionally add partial data if available
             if (content.profile && Object.keys(content.profile).filter(k => k !== 'error').length > 0) { // Check if profile has actual data besides error
                 doc.addPage().fontSize(12).text('Partial Profile Data (if available):', { underline: true }).moveDown(0.5);
                 doc.text(`Name: ${content.profile.name || 'N/A'}`);
                 doc.text(`Handle: ${content.profile.handle || content.profile.username || 'N/A'}`);
                 doc.text(`Bio: ${content.profile.bio || 'N/A'}`);
                 doc.text(`Followers: ${content.profile.stats?.followers || content.profile.followersCount || 'N/A'}`);
                 doc.text(`Following: ${content.profile.stats?.following || content.profile.followingCount || 'N/A'}`);
                 // Add other partial fields
             }
             if (content.posts && content.posts.length > 0) {
                  doc.addPage().fontSize(12).text('Partial Posts Data:', { underline: true }).moveDown(0.5);
                  doc.fontSize(9);
                  content.posts.forEach((post, index) => {
                      // Basic display for partial posts
                       doc.fillColor('grey').text(`--- Post ${index + 1} (Partial) ---`);
                       doc.fillColor('black');
                       doc.text(`Timestamp: ${post.timestamp ? new Date(post.timestamp).toLocaleString() : 'N/A'}`);
                       if (post.url) doc.fillColor('blue').text(post.url, { link: post.url, underline: true }).fillColor('black');
                       doc.text(post.text || 'N/A', { width: doc.page.width - 100 });
                       doc.moveDown(1);
                  });
             }
        }
        // --- Handle Successful Scrape ---
        else if (content.profile) {
            // -- Profile Section --
            doc.fontSize(16).text('Profile Information', { underline: true });
            doc.moveDown();
            doc.fontSize(11);
            // Use standard fonts available in PDFKit by default
            doc.font('Helvetica-Bold').text('Name:', { continued: true }).font('Helvetica').text(` ${content.profile.name || 'N/A'}`);
            doc.font('Helvetica-Bold').text(' Handle:', { continued: true }).font('Helvetica').text(` ${content.profile.handle || content.profile.username || 'N/A'}`); // Add space before Handle
            if (content.profile.isVerified) doc.font('Helvetica-Bold').text(' (Verified)'); // Add verified status if present
            doc.moveDown(0.5); // Add spacing
            doc.font('Helvetica-Bold').text('Bio:', { underline: false });
            doc.font('Helvetica').text(content.profile.bio || 'N/A', { width: doc.page.width - 100, align: 'left' }); // Ensure wrapping and alignment
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').text('Location:', { continued: true }).font('Helvetica').text(` ${content.profile.location || 'N/A'}`);
            doc.font('Helvetica-Bold').text(' Website:', { continued: true }).font('Helvetica'); // Add space
            if (content.profile.website) {
                const webText = content.profile.website;
                const webLink = webText.startsWith('http') ? webText : `http://${webText}`;
                doc.fillColor('blue').text(` ${webText}`, { link: webLink, underline: true }); // Add space before link text
                doc.fillColor('black');
            } else { doc.text(' N/A'); }
            doc.font('Helvetica-Bold').text(' Join Date:', { continued: true }).font('Helvetica').text(` ${content.profile.joinDate || 'N/A'}`); // Add space
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').text('Following:', { continued: true }).font('Helvetica').text(` ${content.profile.stats?.following || content.profile.followingCount || 'N/A'}`);
            doc.font('Helvetica-Bold').text(' Followers:', { continued: true }).font('Helvetica').text(` ${content.profile.stats?.followers || content.profile.followersCount || 'N/A'}`); // Add space
            doc.moveDown(1);

            // -- Profile Screenshot (If available) --
            const screenshotFullPath = content.screenshotPath; // Assuming path is passed correctly
             if (screenshotFullPath && require('fs').existsSync(screenshotFullPath)) {
                 doc.addPage().fontSize(16).text('Profile Screenshot', { underline: true });
                 doc.moveDown();
                 try {
                     doc.image(screenshotFullPath, { fit: [doc.page.width - 100, doc.page.height - 150], align: 'center', valign: 'top' });
                 } catch (imgErr) {
                    console.error(`[Worker ${reportId}] Error embedding screenshot file ${screenshotFullPath}:`, imgErr);
                    doc.addPage().fillColor('red').text(`Error embedding screenshot: ${imgErr.message}`).fillColor('black');
                 }
             }

            // -- Posts Section --
            if (content.posts && content.posts.length > 0) {
                 doc.addPage().fontSize(16).text(`Scraped Posts (${content.posts.length})`, { underline: true });
                 doc.moveDown();
                 doc.fontSize(9);
                 content.posts.forEach((post, index) => {
                     const postHeightEstimate = 50 + (post.text?.length || 0) / 4; // Slightly better estimate
                     if (doc.y + postHeightEstimate > doc.page.height - 50 && index > 0) { // Avoid adding page just for first post if it's long
                         doc.addPage().fontSize(9);
                     }
                     doc.fillColor('grey').text(`--- Post ${index + 1} ---`);
                     doc.fillColor('black');
                     doc.font('Helvetica-Bold').text('Timestamp:', { continued: true }).font('Helvetica').text(` ${post.timestamp ? new Date(post.timestamp).toLocaleString() : 'N/A'}`);
                     if (post.url) {
                        doc.font('Helvetica-Bold').text(' URL:', { continued: true }).font('Helvetica').fillColor('blue').text(` ${post.url}`, { link: post.url, underline: true });
                        doc.fillColor('black');
                     }
                     doc.font('Helvetica-Bold').text(`Text:`);
                     doc.font('Helvetica').text(post.text || 'N/A', { width: doc.page.width - 100, indent: 15 }); // Indent post text slightly
                     doc.moveDown(1.5);
                 });
            } else {
                 // Check if we need a new page before adding this note
                 if(doc.bufferedPageRange().count > (screenshotFullPath ? 2 : 1)) doc.addPage(); // Add page if profile+screenshot exist
                 else doc.moveDown(2);
                 doc.fontSize(12).text('No posts were scraped from the visible timeline.');
            }
        } else {
             doc.fontSize(12).text('No specific content received for PDF generation.');
        }

        

        // --- END PDF CONTENT GENERATION ---

        doc.end(); // Finalize the PDF

        // Wait for stream to finish
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        console.log(`[Worker ${reportId}] REAL PDF generated successfully at: ${tempPdfPath}`);
        return tempPdfPath; // Return path

    } catch (error) {
         console.error(`[Worker ${reportId}] FATAL error during PDF generation:`, error);
          if (fs.existsSync(tempPdfPath)) {
               try { await fsPromises.unlink(tempPdfPath); } catch (e) {}
          }
         throw new Error(`PDF Generation Failed: ${error.message}`);
    }
}


// --- Helper: Upload PDF to Storage (Google Cloud Storage Implementation) ---
async function uploadPdfToStorage(localFilePath, reportId, platform) {
    const bucketName = process.env.GCS_BUCKET_NAME;
    const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS; // Get path from .env

    // Check if required configuration is present
    if (!bucketName || !keyFilename) {
        console.warn(`[Worker ${reportId}] GCS credentials key path or bucket name not fully configured in .env. Skipping upload.`);
        return null; // Return null to indicate upload was skipped
    }

    // Verify the keyfile path actually exists before trying to use it
    // Use standard require('fs') for this sync check
    if (!require('fs').existsSync(keyFilename)) {
         console.error(`[Worker ${reportId}] GCS Keyfile specified in .env not found at path: ${keyFilename}. Skipping upload.`);
         return null; // Return null if keyfile missing
    }

    console.log(`[Worker ${reportId}] Uploading PDF from ${localFilePath} to GCS bucket ${bucketName}...`);

    // Import the Storage class HERE or at the top of the file
    const { Storage } = require('@google-cloud/storage');

    // Creates a client using the Application Default Credentials mechanism
    // which includes checking the GOOGLE_APPLICATION_CREDENTIALS environment variable
    const storage = new Storage();

    // Define the destination path for the file within the bucket
    const destination = `reports/${platform}/${reportId}.pdf`;

    try {
        const options = {
            destination: destination,
            // Set the content type for proper handling by browsers
            contentType: 'application/pdf',
            // Optional: Control cache settings if needed
            // metadata: { cacheControl: 'public, max-age=31536000' },

            // --- Access Control ---
            // By default, uploads are private to the project/service account.
            // To make files publicly readable (less secure, simpler for direct links initially):
            // predefinedAcl: 'publicRead',
            // **Using Signed URLs for download (recommended) does NOT require setting publicRead here.**
        };

        // Uploads the local file to the bucket
        await storage.bucket(bucketName).upload(localFilePath, options);

        // Construct the standard HTTPS URL for the object.
        // Note: This URL only works directly if the object is public.
        // For private objects, you need a Signed URL for access.
        // We store this standard URL in the DB for reference.
        const uploadedUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
        console.log(`[Worker ${reportId}] Successfully uploaded PDF to GCS: ${uploadedUrl}`);
        return uploadedUrl; // Return the standard URL

    } catch (error) {
        console.error(`[Worker ${reportId}] Error uploading PDF to GCS:`, error);
        // Re-throw the error so the calling function (processReportJob) knows the upload failed
        // This ensures the job status is marked as Failed.
        throw new Error(`GCS Upload Failed: ${error.message}`);
    }
}

// --- Define the Job Processor Function ---
// This worker handles 'process-report' jobs added by the API controller
const processReportJob = async (job) => {
    console.log(`[Worker] Processing 'process-report' job ${job.id} for report ${job.data.reportId}`);
    // Destructure data received from the queue
    const { reportId, platform, content, scrapedUrl, targetIdentifier } = job.data;

    // --- Initialize variables ---
    let tempPdfFilePath = null;     // Path where generated PDF is temporarily saved
    let finalPdfUrl = null;         // URL after successful upload to cloud storage
    let processingError = null;   // Stores any error message during processing
    let tempScreenshotPath = null;  // Path where a temporary screenshot (from dataUrl) might be saved

    // --- Prepare Content for PDF Generation ---
    // Create a working copy of the content payload
    const pdfContentPayload = { ...content };

    try { // Wrap the main processing steps

        // Check if this job is specifically for a direct screenshot
        if (platform === 'screenshot' && content.screenshotDataUrl) {
            console.log(`[Worker ${reportId}] Handling direct screenshot payload...`);
            // Define path for the temporary screenshot file
            const tempDir = path.join(__dirname, 'temp_pdfs'); // Use same temp dir
            await fsPromises.mkdir(tempDir, { recursive: true });
            tempScreenshotPath = path.join(tempDir, `screenshot_${reportId}.png`);

            try {
                // Decode base64 and save the screenshot file
                const base64Data = content.screenshotDataUrl.replace(/^data:image\/png;base64,/, "");
                await fsPromises.writeFile(tempScreenshotPath, base64Data, 'base64');
                console.log(`[Worker ${reportId}] Temporary screenshot saved to: ${tempScreenshotPath}`);
                // Add the PATH to the payload for the PDF generator
                pdfContentPayload.screenshotPath = tempScreenshotPath;
                // Remove the large dataUrl from the payload to avoid passing it around unnecessarily
                delete pdfContentPayload.screenshotDataUrl;
            } catch (screenError) {
                console.error(`[Worker ${reportId}] Error saving temporary screenshot:`, screenError);
                processingError = `Failed to save screenshot data: ${screenError.message}`;
                tempScreenshotPath = null; // Ensure path is null if saving failed
            }
        }
        
        // --- Step 1: Generate PDF (only if no critical error saving screenshot) ---
        if (!processingError) {
            console.log(`[Worker ${reportId}] Starting PDF generation...`);
            try {
                // Call the PDF generator, passing the potentially modified payload
                // The generator function itself handles checking for content.error or content.screenshotPath
                tempPdfFilePath = await generatePdfReport(
                    reportId,
                    platform,
                    content.profile?.handle || content.profile?.username || targetIdentifier || platform || 'Unknown', // Get best identifier
                    pdfContentPayload, // Pass payload which might include .screenshotPath
                    scrapedUrl
                );

            } catch (pdfError) {
                console.error(`[Worker ${reportId}] PDF Generation failed:`, pdfError);
                processingError = processingError || `PDF Generation Error: ${pdfError.message}`; // Assign or keep previous error
                tempPdfFilePath = null; // Ensure path is null
            }
        }

        // --- Step 2: Upload PDF to Storage (only if PDF generated successfully) ---
        if (!processingError && tempPdfFilePath) {
            console.log(`[Worker ${reportId}] Starting PDF upload...`);
             try {
                 finalPdfUrl = await uploadPdfToStorage(tempPdfFilePath, reportId, platform);
             } catch (uploadError) {
                  console.error(`[Worker ${reportId}] PDF Upload failed:`, uploadError);
                  processingError = processingError || `PDF Upload Error: ${uploadError.message}`;
                  finalPdfUrl = null; // Ensure URL is null
             }
        } else {
            // If PDF generation failed or was skipped due to earlier error, ensure URL is null
            finalPdfUrl = null;
        }


    } catch (unexpectedError) { // Catch any truly unexpected errors during the flow
        console.error(`[Worker ${reportId}] Unexpected error in processing job:`, unexpectedError);
        processingError = processingError || `Unexpected worker error: ${unexpectedError.message}`;
        finalPdfUrl = null;
    } finally {
        // --- Step 3: Update Database Record ---
        // This runs regardless of success/failure to record the final outcome
        const finalStatus = processingError ? 'Failed' : 'Completed';
        const finalErrorMessage = processingError || content?.error || content?.profile?.error || null;; // Store the first error encountered

        console.log(`[Worker ${reportId}] Updating final report status to ${finalStatus}`);
        await Report.findByIdAndUpdate(reportId, {
            status: finalStatus,
            pdfUrl: finalPdfUrl, // Will be null if any step failed
            errorMessage: finalErrorMessage
        }).catch(dbErr => console.error(`[Worker ${reportId}] CRITICAL: Failed to update final report status:`, dbErr));

        // --- Step 4: Cleanup temporary files ---
        /*
        if (tempPdfFilePath) { // Cleanup generated PDF
            try {
                if (fs.existsSync(tempPdfFilePath)) {
                   console.log(`[Worker ${reportId}] Cleaning up temporary PDF: ${tempPdfFilePath}`);
                   await fsPromises.unlink(tempPdfFilePath);
                }
            } catch (cleanupErr) { console.error(`[Worker ${reportId}] Error cleaning up temp PDF ${tempPdfFilePath}:`, cleanupErr); }
        }
        */
         if (tempScreenshotPath) { // Cleanup screenshot saved from dataUrl
             try {
                 if (fs.existsSync(tempScreenshotPath)) {
                    console.log(`[Worker ${reportId}] Cleaning up temporary screenshot: ${tempScreenshotPath}`);
                    await fsPromises.unlink(tempScreenshotPath);
                 }
             } catch (cleanupErr) { console.error(`[Worker ${reportId}] Error cleaning up temp screenshot ${tempScreenshotPath}:`, cleanupErr); }
         }
         

        console.log(`[Worker] Job ${job.id} finished processing with status ${finalStatus}.`);
    } // End finally block


    // --- Let BullMQ know if the job failed ---
    if (processingError) {
        // Throwing the error ensures BullMQ handles retries/failure status correctly
        throw new Error(processingError);
    }

    // Return final status and URL on success
    return { finalStatus: 'Completed', pdfUrl: finalPdfUrl };

}; // --- End of processReportJob function ---


// --- Initialize the Worker ---
console.log('[Worker] Initializing worker for PDF Processing queue...');
const worker = new Worker('pdf-processing', processReportJob, { // Ensure this matches queue name used by controller
    connection: redisConnection,
    concurrency: 3, // PDF generation/upload might be resource intensive
    limiter: { max: 15, duration: 10000 },
 });
console.log('[Worker] Worker initialized and listening for jobs on [pdf-processing] queue...');

// --- Worker Event Listeners ---
worker.on('completed', (job, returnValue) => {
    console.log(`[Worker] Job ${job.id} (Report: ${job.data.reportId}) completed.`);
});

worker.on('failed', (job, err) => {
    const reportId = job?.data?.reportId || 'Unknown Report';
    // Log the full error for debugging
    console.error(`[Worker] Job ${job?.id} (Report: ${reportId}) failed overall. Error:`, err);
});

worker.on('error', err => {
    // Generic worker errors (e.g., connection issues)
    console.error('[Worker] Worker encountered an error:', err);
});

// --- Graceful Shutdown ---
const gracefulShutdown = async (signal) => {
    console.log(`[Worker] Received ${signal}. Closing worker...`);
    try {
        await worker.close(); // Wait for worker to close gracefully
        console.log('[Worker] Worker closed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('[Worker] Error closing worker:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// --- Connect to DB ---
console.log('[Worker] Connecting to MongoDB...');
connectDB().then(() => {
    console.log('[Worker] MongoDB connected for worker.');
}).catch(err => {
    console.error('[Worker] MongoDB connection failed for worker:', err);
    // Optionally try to shut down worker gracefully if DB fails?
    process.exit(1); // Exit if DB connection fails on startup
});