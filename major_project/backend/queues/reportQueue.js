// backend/queues/reportQueue.js
const { Queue } = require('bullmq');
const dotenv = require('dotenv');

dotenv.config(); // Load .env variables

const redisConnection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    enableReadyCheck: true, // Good practice for cloud redis
    maxRetriesPerRequest: null
};

// Use a different queue name if desired, e.g., 'pdf-generation'
// Or keep 'report-parsing' if worker only does one thing
const reportQueue = new Queue('pdf-processing', { // Changed name slightly
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2, // Fewer attempts for PDF gen maybe?
        backoff: { type: 'exponential', delay: 10000 }, // Longer delay?
        removeOnComplete: true,
        removeOnFail: 500 // Keep fewer failed jobs?
    }
 });

console.log(`PDF Processing queue initialized. Connected to Redis at ${redisConnection.host}:${redisConnection.port}`);

reportQueue.on('error', err => console.error('BullMQ PDF Queue Error:', err));
// Add other listeners as needed

module.exports = reportQueue; // Export the specific queue instance