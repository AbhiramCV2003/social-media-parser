// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Needed to potentially fetch user details
const dotenv = require('dotenv');

dotenv.config(); // Load .env variables for JWT_SECRET

const protect = async (req, res, next) => {
    let token;

    // Check for token in Authorization header (Bearer token)
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header (Bearer TOKEN -> TOKEN)
            token = req.headers.authorization.split(' ')[1];

            // Verify token validity and signature
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            console.log(`[Protect Middleware] Token validated for user ID: ${req.userId}`);
            // Attach user ID to the request object for downstream handlers
            // We stored the user's MongoDB _id as 'id' in the JWT payload
            req.userId = decoded.id;

            console.log(`[Protect Middleware] Token validated. Decoded payload ID: ${decoded.id}. Assigned req.userId: ${req.userId}`);

            // Optional: Fetch full user object from DB if needed by controllers
            // req.user = await User.findById(decoded.id).select('-password');
            // if (!req.user) {
            //     return res.status(401).json({ message: 'Not authorized, user not found' });
            // }

            next(); // Token is valid, proceed to the next middleware/route handler

        } catch (error) {
            console.error('Authentication Error:', error.message);
             // Handle specific JWT errors if needed (e.g., TokenExpiredError)
             if (error.name === 'JsonWebTokenError') {
                 return res.status(401).json({ message: 'Not authorized, token failed (invalid signature or format)' });
             } else if (error.name === 'TokenExpiredError') {
                  return res.status(401).json({ message: 'Not authorized, token expired' });
             }
            // Generic failure
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    // If no token was found in the header at all
    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token provided' });
    }
};

module.exports = { protect };