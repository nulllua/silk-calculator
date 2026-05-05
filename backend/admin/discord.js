require('dotenv').config();

async function sendChangelogToDiscord(changelog) {
    const webhookUrl = process.env.DISCORD_CHANGELOG_WEBHOOK;

    if (!webhookUrl) {
        console.log("Discord webhook URL is not set in .env");
        return;
    }

    const embed = {
        title: `🚀 ${changelog.version}`,
        color: 0x00ff88,
        timestamp: new Date().toISOString(),
        fields: []
    };

    if (changelog.entries?.length > 0) {
        embed.description = changelog.entries.map(e => `• ${e}`).join("\n");
    }

    if (changelog.date) {
        embed.fields.push({ name: "Date", value: changelog.date, inline: true });
    }

    if (changelog.thanks) {
        embed.fields.push({ name: "Thanks", value: changelog.thanks, inline: true });
    }

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "Silkroadcalc.eu Updates",
                embeds: [embed]
            })
        });
        console.log(`Sent to Discord: ${changelog.version}`);
    } catch (err) {
        console.error("Discord error:", err.message);
    }
}

module.exports = { sendChangelogToDiscord };
