// backend/routes/report.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware'); // Still needed for list/download

// @route   POST /api/report
// @desc    Receive scraped data/screenshot and queue processing (Username verified in controller)
// @access  Public (restricted by CORS to extension)
router.post('/', reportController.receiveReportData); // NO protect middleware here

// @route   GET /api/report/list
// @desc    Get list of processed reports FOR THE LOGGED IN EXAMINER (from Web App)
// @access  Private (Requires JWT from Web App)
router.get('/list', protect, reportController.listReports); // KEEP protect here

// @route   GET /api/report/:reportId/download
// @desc    Get download link for a specific report FOR THE LOGGED IN EXAMINER (from Web App)
// @access  Private (Requires JWT from Web App)
router.get('/:reportId/download', protect, reportController.downloadReport); // KEEP protect here

module.exports = router;