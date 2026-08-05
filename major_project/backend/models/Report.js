// backend/models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    // Optional: Add reference to an examiner user if your backend has them
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    platform: { type: String, 
        required: true, 
        enum: ['twitter', 'instagram', 'facebook','screenshot'],
        
    },
    targetIdentifier: { type: String }, // Store username/ID for social media, maybe null for screenshot
    scrapedUrl: { type: String },       // URL the data was scraped from
    status: {
        type: String,
        required: true,
        enum: ['Received', 'Generating', 'Completed', 'Failed'], // Updated statuses
        default: 'Received'
    },
    pdfUrl: { type: String, trim: true, default: null },       // URL to the final PDF/Image in storage
    errorMessage: { type: String, default: null },
    // Optional: Store a small snippet or summary of data? Not recommended for large data.
    // contentSummary: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

const Report = mongoose.model('Report', reportSchema);
module.exports = Report;