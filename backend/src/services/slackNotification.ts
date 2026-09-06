import axios from 'axios';

// Mock Slack Notification
export async function sendSlackNotification(message: string) {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
        console.log(`[Slack] No webhook configured, dropping notification: ${message}`);
        return;
    }
    try {
        await axios.post(slackWebhookUrl, { text: message });
        console.log('[Slack] Notification sent successfully');
    } catch (err) {
        console.error('[Slack] Failed to send notification', err);
    }
}
