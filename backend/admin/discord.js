// discord.js
require('dotenv').config();

async function sendChangelogToDiscord(changelog) {
    const webhookUrl = process.env.DISCORD_CHANGELOG_WEBHOOK;

    console.log("🔍 Discord debug - Webhook URL exists:", !!webhookUrl);

    if (!webhookUrl) {
        console.log("❌ No DISCORD_CHANGELOG_WEBHOOK in .env");
        return;
    }

    const embed = {
        title: `🚀 ${changelog.version || 'New Update'}`,
        color: 0x00ff88,
        timestamp: new Date().toISOString(),
        fields: []
    };

    if (changelog.entries?.length > 0) {
        embed.description = changelog.entries.map(e => `• ${e}`).join("\n");
    }
    if (changelog.date) embed.fields.push({ name: "Date", value: changelog.date, inline: true });
    if (changelog.thanks) embed.fields.push({ name: "Thanks", value: changelog.thanks, inline: true });

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "Silk Road Updates",
                embeds: [embed]
            })
        });

        console.log(`✅ Discord response status: ${response.status}`);

        if (!response.ok) {
            const text = await response.text();
            console.log("❌ Discord error body:", text);
        } else {
            console.log("✅ Successfully sent to Discord!");
        }
    } catch (err) {
        console.error("❌ Failed to send to Discord:", err.message);
    }
}

module.exports = { sendChangelogToDiscord };
