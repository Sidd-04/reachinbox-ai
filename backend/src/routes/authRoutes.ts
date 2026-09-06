import { Router, Request, Response } from 'express';
import axios from 'axios';
import { upsertUser, setUserSlack, getUserByGoogleId } from '../config/database';

const router = Router();

// ─── Google OAuth ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/google
 * Body: { token: string }  (Google access_token from @react-oauth/google)
 * Returns: { user: { google_id, name, email, avatar, slack_connected } }
 */
router.post('/google', async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'access_token is required' });
        }

        // Verify token and fetch user profile from Google
        const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000,
        });

        const { sub: googleId, name, email, picture: avatar } = googleRes.data;
        if (!googleId || !email) {
            return res.status(400).json({ error: 'Invalid Google token response' });
        }

        // Upsert user in DB
        const user = await upsertUser(googleId, name || email, email, avatar || '');

        res.json({
            user: {
                google_id: user.google_id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                slack_connected: !!user.slack_webhook_url,
                slack_channel: user.slack_channel,
            }
        });
    } catch (err: any) {
        console.error('Google auth error:', err?.message);
        // Fallback: if Google call fails (e.g. expired token), still allow login with what we have
        res.status(401).json({ error: 'Google token verification failed' });
    }
});

// ─── Slack OAuth ──────────────────────────────────────────────────────────────

/**
 * GET /api/auth/slack?google_id=xxx
 * Redirects to Slack OAuth authorization page
 */
router.get('/slack', (req: Request, res: Response) => {
    const { google_id } = req.query;
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:3001/api/auth/slack/callback';

    if (!clientId) {
        return res.status(501).json({ 
            error: 'Slack OAuth not configured', 
            message: 'Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REDIRECT_URI in backend/.env' 
        });
    }

    const scopes = 'incoming-webhook,chat:write';
    const state = google_id ? String(google_id) : 'no-user';
    const slackUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    
    res.redirect(slackUrl);
});

/**
 * GET /api/auth/slack/callback
 * Slack sends back ?code=xxx&state=google_id
 */
router.get('/slack/callback', async (req: Request, res: Response) => {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

    if (error) {
        return res.redirect(`${frontendUrl}/dashboard?slack=error&reason=${error}`);
    }
    if (!code) {
        return res.redirect(`${frontendUrl}/dashboard?slack=error&reason=no_code`);
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:3001/api/auth/slack/callback';
    const googleId = String(state || '');

    if (!clientId || !clientSecret) {
        return res.redirect(`${frontendUrl}/dashboard?slack=error&reason=not_configured`);
    }

    try {
        // Exchange code for access token
        const tokenRes = await axios.post('https://slack.com/api/oauth.v2.access', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
            },
        });

        const slackData = tokenRes.data;
        if (!slackData.ok) {
            throw new Error(slackData.error || 'Slack token exchange failed');
        }

        const accessToken: string = slackData.access_token;
        const webhookUrl: string = slackData.incoming_webhook?.url || '';
        const channel: string = slackData.incoming_webhook?.channel || '';

        // Store in DB for this user
        if (googleId && googleId !== 'no-user') {
            await setUserSlack(googleId, accessToken, webhookUrl, channel);
        }

        // Send a test message to confirm connection
        if (webhookUrl) {
            await axios.post(webhookUrl, { 
                text: `✅ ReachInbox connected successfully! You'll get rate-limit alerts here.` 
            });
        }

        res.redirect(`${frontendUrl}/dashboard?slack=connected&channel=${encodeURIComponent(channel)}`);
    } catch (err: any) {
        console.error('Slack callback error:', err?.message);
        res.redirect(`${frontendUrl}/dashboard?slack=error&reason=token_exchange_failed`);
    }
});

/**
 * GET /api/auth/slack/status?google_id=xxx
 * Returns whether user has Slack connected
 */
router.get('/slack/status', async (req: Request, res: Response) => {
    const { google_id } = req.query;
    if (!google_id) {
        return res.json({ connected: false });
    }
    try {
        const user = await getUserByGoogleId(String(google_id));
        res.json({ 
            connected: !!(user?.slack_webhook_url),
            channel: user?.slack_channel || null,
        });
    } catch (err) {
        res.json({ connected: false });
    }
});

export default router;
