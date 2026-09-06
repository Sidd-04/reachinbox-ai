import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import emailRoutes from './routes/emailRoutes';
import authRoutes from './routes/authRoutes';
import { initDb } from './config/database';
import { emailQueue } from './queues/emailQueue';
import './workers/emailWorker'; // Initialize worker to process the queue
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

// CORS – allow common Vite dev ports and dynamic localhost ports
app.use(cors({
    origin: (origin, callback) => {
        // allow requests with no origin (like mobile apps, curl, postman) or localhost origins
        if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || origin === FRONTEND_URL) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api/emails', emailRoutes);
app.use('/api/auth', authRoutes);

// BullMQ Dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter: serverAdapter,
});
app.use('/admin/queues', serverAdapter.getRouter());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
    try {
        await initDb();
        console.log('✅ Database initialized');

        app.listen(PORT, () => {
            console.log(`🚀 Backend server running on http://localhost:${PORT}`);
            console.log(`📊 BullMQ Dashboard: http://localhost:${PORT}/admin/queues`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

startServer();
