/**
 * Sends a Slack notification to an SME via an Incoming Webhook.
 * Silently skips if SLACK_WEBHOOK_URL is not set.
 */
async function sendSlackNotification(sme, document, twName) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const deadline = document.deadline
    ? new Date(document.deadline).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'No deadline set';

  const reviewUrl = `${process.env.APP_URL}/review/${sme.token}`;

  const body = {
    text: `📄 *Review Request: ${document.title}*\nHi ${sme.sme_name}, you've been asked to review a document.\n\n*Due:* ${deadline}\n*From:* ${twName}\n\n<${reviewUrl}|Click here to review>`,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`Slack notification failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error('Slack notification error:', err.message);
  }
}

/**
 * Notifies the TW via Slack that a review link was sent to the wrong person.
 */
async function sendWrongPersonNotification(smeName, document, twName) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const body = {
    text: `⚠️ *Wrong recipient alert*\n${smeName} reports that the review link for *${document.title}* was sent to the wrong person.\n\n*Assigned to:* ${smeName}\n*Action needed:* ${twName}, please send the correct link to the intended reviewer.`,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`Slack wrong-person notification failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error('Slack wrong-person notification error:', err.message);
  }
}

module.exports = { sendSlackNotification, sendWrongPersonNotification };
