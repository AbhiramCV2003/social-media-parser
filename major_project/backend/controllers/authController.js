// backend/controllers/authController.js
const User = require('../models/User');    // Import the User model
const jwt = require('jsonwebtoken');       // Import JWT for token generation
const bcrypt = require('bcrypt');          // Used indirectly via User model, but good to have context
const dotenv = require('dotenv');          // Import dotenv to access JWT_SECRET

// Load environment variables from .env file
dotenv.config();

// --- Helper function to generate JWT ---
const generateToken = (userId) => {
    // Sign the token with the user ID as payload and your JWT_SECRET
    return jwt.sign(
        { id: userId }, // Payload: Typically contains user identifier
        process.env.JWT_SECRET, // Your secret key from .env
        { expiresIn: '30d' } // Token expiration time (e.g., 30 days)
    );
};


// --- Register User Controller ---
const registerUser = async (req, res) => {
    // 1. Destructure username and password from request body
    const { username, password } = req.body;

    // 2. Basic Validation
    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide both username and password' });
    }
    // Add more validation if needed (e.g., password complexity)

    try {
        // 3. Check if user already exists (case-insensitive username check)
        const userExists = await User.findOne({ username: username.toLowerCase() });

        if (userExists) {
            // Send 400 Bad Request if username is taken
            return res.status(400).json({ message: 'Username already taken' });
        }

        // 4. Create new user instance (Password hashing happens automatically via Mongoose pre-save hook)
        const newUser = new User({
            username: username.toLowerCase(), // Store username consistently
            password: password,
        });

        // 5. Save user to database
        const savedUser = await newUser.save(); // This triggers the pre-save hook for hashing

        // 6. Respond with success message (don't send token on register usually)
        if (savedUser) {
            res.status(201).json({ // 201 Created status
                _id: savedUser._id,
                username: savedUser.username,
                message: 'User registered successfully. Please log in.' // Guide user to login
            });
        } else {
            // Should generally not happen if .save() didn't throw, but as fallback
            res.status(400).json({ message: 'User registration failed, invalid data provided.' });
        }

    } catch (error) {
        console.error("Error during registration:", error);
        // Handle potential validation errors from Mongoose or other issues
        if (error.name === 'ValidationError') {
             return res.status(400).json({ message: `Registration validation failed: ${error.message}` });
        }
        res.status(500).json({ message: 'Server error during registration' });
    }
};


// --- Login User Controller ---
const loginUser = async (req, res) => {
    // 1. Destructure username and password from request body
    const { username, password } = req.body;

    // 2. Basic Validation
    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide username and password' });
    }

    try {
        // 3. Find user by username (case-insensitive)
        // Explicitly select password if schema has 'select: false'
        // const user = await User.findOne({ username: username.toLowerCase() }).select('+password');
        // If password is not selected: false, just findOne is enough:
        const user = await User.findOne({ username: username.toLowerCase() });

        // 4. Check if user exists
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' }); // 401 Unauthorized
        }

        // 5. Compare entered password with stored hashed password
        const isMatch = await user.comparePassword(password); // Use the method defined in User model

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' }); // Incorrect password
        }

        // 6. Passwords match - Respond with user info and JWT token
        res.status(200).json({ // 200 OK
            _id: user._id,
            username: user.username,
            token: generateToken(user._id), // Generate and send the token
            message: 'Login successful'
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};


// Export the controller functions to be used in routes/auth.js
module.exports = {
    registerUser,
    loginUser
};