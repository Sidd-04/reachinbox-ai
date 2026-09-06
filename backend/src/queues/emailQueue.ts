import { Queue } from 'bullmq';
import { connection } from '../config/redis';

// Define the Queue for sending emails
export const emailQueue = new Queue('sending-emails', { connection });
