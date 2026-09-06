import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { connection } from '../config/redis';
import { pool } from '../config/database';
import { getSlackWebhookBySender } from '../config/database';
import { indexEmail } from '../services/elasticsearch';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Create Ethereal SMTP transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
        user: process.env.SMTP_USER || 'test@ethereal.email',
        pass: process.env.SMTP_PASS || 'pass123'
    }
});

const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5');

// Send Slack notification to the per-user webhook (falls back to global env)
async function notifySlack(webhookUrl: string, message: string) {
    if (!webhookUrl) return;
    try {
        await axios.post(webhookUrl, { text: message }, { timeout: 3000 });
        console.log('[Slack] Notification sent');
    } catch (err) {
        console.error('[Slack] Failed to notify:', (err as Error).message);
    }
}

// Configure BullMQ worker with configurable concurrency
export const emailWorker = new Worker('sending-emails', async (job: Job) => {
    const { emailId, from, to, subject, body, hourlyLimit } = job.data;

    // ── Rate Limiting via Redis counter (keyed by sender + hour window) ──────
    const hourWindow = new Date().toISOString().substring(0, 13); // e.g. "2026-09-05T16"
    const redisKey = `ratelimit:${from}:${hourWindow}`;

    const count = await connection.incr(redisKey);
    if (count === 1) {
        await connection.expire(redisKey, 3600); // TTL = 1 hour
    }

    const limit = hourlyLimit
        ? parseInt(String(hourlyLimit))
        : MAX_EMAILS_PER_HOUR;

    if (count > limit) {
        console.warn(`[Rate Limit] Sender ${from} hit limit (${limit}/hr). Deferring email ${emailId} by 1 hour.`);

        // Notify the user's Slack when the limit is first hit
        if (count === limit + 1) {
            const webhookUrl = await getSlackWebhookBySender(from);
            if (webhookUrl) {
                await notifySlack(
                    webhookUrl,
                    `🚨 *ReachInbox Rate Limit Hit*\n*Sender:* ${from}\n*Limit:* ${limit} emails/hr\nEmails are being deferred to the next hour window.`
                );
            }
        }

        // Reschedule: move job to 1 hour from now, preserving order
        await job.moveToDelayed(Date.now() + 3_600_000, job.token!);
        return;
    }

    // ── Send Email ────────────────────────────────────────────────────────────
    try {
        const info = await transporter.sendMail({
            from: from || '"ReachInbox Demo" <demo@reachinbox.ai>',
            to,
            subject,
            text: body,
            html: `<div style="font-family: sans-serif; max-width: 600px;">${body.replace(/\n/g, '<br>')}</div>`
        });

        const previewUrl = nodemailer.getTestMessageUrl(info) || '';
        console.log(`[Email] Sent: ${info.messageId}`);
        if (previewUrl) console.log(`[Email] Preview: ${previewUrl}`);

        // Update DB: mark as sent with preview URL
        await pool.query(
            `UPDATE emails SET status = 'sent', sent_at = NOW(), provider_id = $1, preview_url = $2 WHERE id = $3`,
            [info.messageId, previewUrl, emailId]
        );

        // Index in Elasticsearch (optional – silent fail if not running)
        await indexEmail({
            id: emailId,
            sender: from,
            recipient: to,
            subject,
            body,
            status: 'sent'
        });

    } catch (error) {
        console.error(`[Email] Failed to send ${emailId}:`, error);
        await pool.query(`UPDATE emails SET status = 'failed' WHERE id = $1`, [emailId]);
        throw error; // BullMQ will retry
    }

}, {
    connection,
    concurrency: WORKER_CONCURRENCY,
    // Minimum 2s delay between job processing to mimic provider throttling
    limiter: {
        max: WORKER_CONCURRENCY,
        duration: 2000,
    }
});

emailWorker.on('completed', job => {
    console.log(`[Worker] Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});
