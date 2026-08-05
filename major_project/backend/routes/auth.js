// backend/routes/auth.js
const express = require('express');
const router = express.Router();

// Import controller functions from authController.js
// Ensure the path is correct relative to this routes directory
const { registerUser, loginUser } = require('../controllers/authController');

// --- Define Authentication Routes ---

// @route   POST /api/auth/register
// @desc    Register a new examiner user
// @access  Public
router.post('/register', registerUser); // When a POST request hits /register, call the registerUser function

// @route   POST /api/auth/login
// @desc    Authenticate examiner user & get token
// @access  Public
router.post('/login', loginUser); // When a POST request hits /login, call the loginUser function


// Export the configured router so it can be used in server.js
module.exports = router;