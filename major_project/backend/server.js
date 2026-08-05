// backend/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars FIRST
dotenv.config();

// --- Import Routes ---
const reportRoutes = require('./routes/report');
const authRoutes = require('./routes/auth'); // <-- Ensure this is required

// Connect to Database
connectDB();

// Initialize App
const app = express();

// --- CORRECTED CORS Middleware Setup ---
const allowedOrigins = [];
if (process.env.CHROME_EXTENSION_ID) {
    allowedOrigins.push(`chrome-extension://${process.env.CHROME_EXTENSION_ID}`);
    console.log(`[CORS] Added Extension Origin: chrome-extension://${process.env.CHROME_EXTENSION_ID}`);
} else {
    console.warn("[CORS] CHROME_EXTENSION_ID not set in .env. Extension requests might fail.");
}
const frontendDevOrigin = process.env.FRONTEND_DEV_URL || 'http://localhost:5173'; // Default Vite port
allowedOrigins.push(frontendDevOrigin);
console.log(`[CORS] Added Frontend Dev Origin: ${frontendDevOrigin}`);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.error(`[CORS] Blocked Origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'POST, GET, OPTIONS, PUT, DELETE',
  allowedHeaders: 'Content-Type, Authorization',
  credentials: true
};

console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
app.use(cors(corsOptions));
// --- END CORRECTED CORS ---

// Body Parser Middleware
app.use(express.json({ limit: '10mb' })); // Allow larger payloads

// Define Routes
app.get('/', (req, res) => res.send('Backend API Running')); // Test route
app.use('/api/auth', authRoutes); // <-- Ensure auth routes are used
app.use('/api/report', reportRoutes); // Use report routes


// Simple Error Handler (Keep at the end)
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack);
    res.status(500).send(process.env.NODE_ENV === 'production' ? 'Server Error' : err.stack);
});

// Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));