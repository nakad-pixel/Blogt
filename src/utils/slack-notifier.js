import fetch from 'node-fetch';
import logger from './logger.js';

async function notifySlack() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    logger.warn('SLACK_WEBHOOK_URL not configured, skipping notification');
    return;
  }

  const message = {
    text: '🚨 Blog Automation Workflow Failed',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Blog Automation Workflow Failed*\n\nThe daily blog publishing workflow encountered an error. Please check the GitHub Actions logs for details.'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Timestamp:*\n${new Date().toISOString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Repository:*\n${process.env.GITHUB_REPOSITORY || 'Unknown'}`
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (response.ok) {
      logger.info('Slack notification sent successfully');
    } else {
      logger.error(`Failed to send Slack notification: ${response.statusText}`);
    }
  } catch (error) {
    logger.error(`Error sending Slack notification: ${error.message}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  notifySlack().catch(console.error);
}

export default notifySlack;
