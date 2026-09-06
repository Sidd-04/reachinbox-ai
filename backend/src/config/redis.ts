import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

export const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
    console.error('Redis connection error:', err);
});
