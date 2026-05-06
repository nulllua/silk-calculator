require("dotenv").config();

// Discord webhook delivery should not depend on the Node runtime providing global fetch.
// Some deploy environments run older Node versions, so we fall back to node-fetch.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fetchImpl = global.fetch || require("node-fetch");

async function postWebhook(webhookUrl, payload, label) {
  if (!webhookUrl) {
    console.warn(`[discord] Missing webhook env for ${label}`);
    return;
  }

  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text().catch(() => "");
    if (!response.ok) {
      console.error(`[discord] ${label} failed:`, response.status, text);
    } else if (process.env.DISCORD_WEBHOOK_DEBUG === "1") {
      console.log(`[discord] ${label} ok:`, response.status, text);
    }
  } catch (err) {
    console.error(`[discord] ${label} exception:`, err.message);
  }
}

async function sendChangelogToDiscord(changelog) {
  const webhookUrl =
    process.env.DISCORD_CHANGELOG_WEBHOOK_URL ||
    process.env.DISCORD_CHANGELOG_WEBHOOK;
  const embed = {
    title: `Silk Road Update: ${changelog.version || "New Update"}`,
    color: 0x00ff88,
    timestamp: new Date().toISOString(),
    fields: [],
  };

  if (changelog.entries?.length > 0) {
    embed.description = changelog.entries.map((e) => `- ${e}`).join("\n");
  }
  if (changelog.date)
    embed.fields.push({
      name: "Date",
      value: String(changelog.date),
      inline: true,
    });
  if (changelog.thanks)
    embed.fields.push({
      name: "Thanks",
      value: String(changelog.thanks),
      inline: true,
    });

  await postWebhook(
    webhookUrl,
    { username: "Silk Road Updates", embeds: [embed] },
    "changelog",
  );
}

async function sendPermissionRequestToDiscord({ username, role, note }) {
  const webhookUrl =
    process.env.DISCORD_OWNER_ALERT_WEBHOOK_URL ||
    process.env.DISCORD_PERMISSION_REQUEST_WEBHOOK_URL;
  const embed = {
    title: "Admin Edit Permission Request",
    color: 0xf0d080,
    timestamp: new Date().toISOString(),
    fields: [
      { name: "User", value: username || "unknown", inline: true },
      { name: "Role", value: role || "helper", inline: true },
      { name: "Note", value: note || "No note provided", inline: false },
    ],
  };

  await postWebhook(
    webhookUrl,
    { username: "Admin Lock Guard", embeds: [embed] },
    "permission-request",
  );
}

module.exports = {
  sendChangelogToDiscord,
  sendPermissionRequestToDiscord,
};
