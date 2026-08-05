// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // Make sure bcrypt is installed (npm install bcrypt)

const userSchema = new mongoose.Schema({
    username: { // Or use 'email' if you prefer email login
        type: String,
        required: [true, 'Please add a username'], // Added error message
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: [6, 'Password must be at least 6 characters'] // Example validation
        // Consider removing select: false if you need password temporarily in controllers
        // select: false // Usually good practice to not select password by default
    }
    // Add other fields for the examiner if needed:
    // name: { type: String },
    // role: { type: String, enum: ['examiner', 'admin'], default: 'examiner' }
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// --- Password Hashing Middleware ---
// This function runs automatically BEFORE a 'save' operation on a User document
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    // 'this' refers to the document being saved
    if (!this.isModified('password')) {
        return next(); // Skip hashing if password hasn't changed
    }

    try {
        // Generate salt (complexity factor for hashing, 10-12 is common)
        const salt = await bcrypt.genSalt(10);
        // Hash the password using the generated salt
        this.password = await bcrypt.hash(this.password, salt);
        next(); // Proceed with the save operation
    } catch (error) {
        next(error); // Pass any error during hashing to the next middleware/handler
    }
});

// --- Password Comparison Method ---
// Add a custom method to the userSchema to compare passwords during login
userSchema.methods.comparePassword = async function(enteredPassword) {
    // 'this.password' refers to the hashed password stored in the document
    // bcrypt.compare securely compares the plain text password with the hash
    return await bcrypt.compare(enteredPassword, this.password);
};


// Create the Mongoose model from the schema
const User = mongoose.model('User', userSchema);

module.exports = User;