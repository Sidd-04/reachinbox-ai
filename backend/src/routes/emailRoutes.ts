import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { emailQueue } from '../queues/emailQueue';
import { searchEmails } from '../services/elasticsearch';

const router = Router();

// POST /api/emails/schedule
router.post('/schedule', async (req: Request, res: Response) => {
    try {
        const { from, to, subject, body, delaySeconds, hourlyLimit, sendAt, list } = req.body;

        // Support either single "to" or a list of emails
        const recipients: string[] = list && list.length > 0 ? list : [to];

        const scheduledTime = sendAt ? new Date(sendAt) : new Date();

        for (let i = 0; i < recipients.length; i++) {
            const emailId = uuidv4();
            const recipient = recipients[i];

            // Stagger: apply delaySeconds * i for each subsequent recipient
            const delayOffset = delaySeconds ? delaySeconds * 1000 * i : 0;
            const jobDelay = Math.max(0, scheduledTime.getTime() - Date.now() + delayOffset);

            // Store in DB
            await pool.query(
                `INSERT INTO emails (id, sender_email, recipient, subject, body, scheduled_at, status) 
                 VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
                 ON CONFLICT (id) DO NOTHING`,
                [emailId, from || 'user@reachinbox.ai', recipient, subject, body, new Date(Date.now() + jobDelay)]
            );

            // Schedule via BullMQ delayed job (idempotent via jobId)
            await emailQueue.add(
                'send-email',
                { emailId, from: from || 'user@reachinbox.ai', to: recipient, subject, body, hourlyLimit },
                { delay: jobDelay, jobId: emailId }
            );
        }

        res.status(200).json({ message: 'Emails scheduled successfully', count: recipients.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/emails/scheduled
router.get('/scheduled', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM emails WHERE status = 'scheduled' ORDER BY scheduled_at ASC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/emails/sent
router.get('/sent', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM emails WHERE status IN ('sent', 'failed') ORDER BY sent_at DESC NULLS LAST`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/emails/search?q=xxx
// MUST be before /:id to avoid being caught by that route
router.get('/search', async (req: Request, res: Response) => {
    try {
        const q = req.query.q as string;
        if (!q) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }

        // Try Elasticsearch first
        const esResults = await searchEmails(q);
        if (esResults.length > 0) {
            return res.json(esResults);
        }

        // Fallback: PostgreSQL full-text / ILIKE search
        const { rows } = await pool.query(
            `SELECT * FROM emails 
             WHERE subject ILIKE $1 OR body ILIKE $1 OR recipient ILIKE $1 OR sender_email ILIKE $1
             ORDER BY created_at DESC LIMIT 50`,
            [`%${q}%`]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/emails/:id  (must be AFTER /search)
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(`SELECT * FROM emails WHERE id = $1`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Email not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
