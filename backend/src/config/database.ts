import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'reachinbox',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    // Users table – stores Google OAuth profile + per-user Slack token
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        google_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        avatar TEXT,
        slack_access_token TEXT,
        slack_webhook_url TEXT,
        slack_channel TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Emails table
    await client.query(`
      CREATE TABLE IF NOT EXISTS emails (
        id UUID PRIMARY KEY,
        sender_email VARCHAR(255) NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        subject TEXT,
        body TEXT,
        scheduled_at TIMESTAMP NOT NULL,
        sent_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'scheduled',
        provider_id VARCHAR(255),
        preview_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add preview_url column if it doesn't exist (for existing DBs)
    await client.query(`
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS preview_url TEXT;
    `);

    // Indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_emails_sender_status ON emails(sender_email, status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
    `);

  } catch (err) {
    console.error('DB init warning:', (err as Error).message);
  } finally {
    client.release();
  }
}

// Upsert user from Google OAuth – returns the user row
export async function upsertUser(googleId: string, name: string, email: string, avatar: string) {
  const { rows } = await pool.query(`
    INSERT INTO users (google_id, name, email, avatar)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (google_id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      avatar = EXCLUDED.avatar,
      updated_at = NOW()
    RETURNING *
  `, [googleId, name, email, avatar]);
  return rows[0];
}

// Get user by google_id
export async function getUserByGoogleId(googleId: string) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE google_id = $1`, [googleId]);
  return rows[0] || null;
}

// Update user Slack integration
export async function setUserSlack(googleId: string, accessToken: string, webhookUrl: string, channel: string) {
  await pool.query(`
    UPDATE users SET slack_access_token = $1, slack_webhook_url = $2, slack_channel = $3, updated_at = NOW()
    WHERE google_id = $4
  `, [accessToken, webhookUrl, channel, googleId]);
}

// Get Slack webhook for a given sender email
export async function getSlackWebhookBySender(email: string) {
  const { rows } = await pool.query(`SELECT slack_webhook_url FROM users WHERE email = $1`, [email]);
  return rows[0]?.slack_webhook_url || process.env.SLACK_WEBHOOK_URL || null;
}
