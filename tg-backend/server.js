const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const bot = new Telegraf(process.env.BOT_TOKEN);
const WEB_APP_URL = process.env.WEB_APP_URL; // Hosted React URL

// Bot Command /start
bot.start((ctx) => {
  ctx.reply(
    `Welcome ${ctx.from.first_name}! Ready to start mining?`,
    Markup.inlineKeyboard([
      Markup.button.webApp('🚀 Open Mining App', WEB_APP_URL)
    ])
  );
});

bot.launch();

// Validate Telegram Web App Data (Security Middleware)
function verifyTelegramData(telegramInitData) {
  const urlParams = new URLSearchParams(telegramInitData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const paramsChain = Array.from(urlParams.entries())
    .map(([key, val]) => `${key}=${val}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(paramsChain).digest('hex');

  return calculatedHash === hash;
}

// API endpoint to sync mined balance safely
app.post('/api/sync-mining', (req, me) => {
  const { initData, taps } = req.body;
  if (!verifyTelegramData(initData)) {
    return res.status(403).json({ error: 'Unauthorized payload' });
  }

  // TODO: Update tap gains in MongoDB/Database for user
  res.json({ success: true, syncedTaps: taps });
});

app.listen(5000, () => console.log('Backend running on port 5000'));
