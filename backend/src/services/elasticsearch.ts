import axios from 'axios';

const ES_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const ES_ENABLED = process.env.ELASTICSEARCH_URL !== undefined;

export async function indexEmail(emailData: any) {
    if (!ES_ENABLED) return;
    try {
        await axios.post(`${ES_URL}/emails/_doc/${emailData.id}`, emailData, {
            timeout: 2000
        });
    } catch {
        // Elasticsearch is optional - silently skip if not available
    }
}

export async function searchEmails(query: string) {
    if (!ES_ENABLED) return [];
    try {
        const response = await axios.post(
            `${ES_URL}/emails/_search`,
            {
                query: {
                    multi_match: {
                        query,
                        fields: ['subject', 'body', 'recipient', 'sender']
                    }
                }
            },
            { timeout: 2000 }
        );
        return response.data.hits.hits.map((hit: any) => hit._source);
    } catch {
        // Elasticsearch not running - return empty results gracefully
        return [];
    }
}
