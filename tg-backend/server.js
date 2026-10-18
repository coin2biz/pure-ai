const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

const token = process.env.BOT_TOKEN;
console.log(token ? "✅ BOT_TOKEN found, starting bot..." : "❌ BOT_TOKEN missing!");

if (!token) {
  console.error("BOT_TOKEN is not set in Environment!");
} else {
  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
`⛏️ Welcome to PURE AI TOKEN Mining!

Mine 3 PURE every 12 hours
Refer friends & earn 10 PURE

Commands:
/mine - Mine 3 PURE
/balance - Check balance
/referral - Get referral link`);
  });

  bot.onText(/\/mine/, (msg) => {
    bot.sendMessage(msg.chat.id, "⛏️ Mining... You got 3 PURE! (Connect your backend API here)");
  });

  bot.onText(/\/balance/, (msg) => {
    bot.sendMessage(msg.chat.id, "💰 Your balance: Checking... (Connect backend API)");
  });

  bot.onText(/\/referral/, (msg) => {
    bot.sendMessage(msg.chat.id, `👥 Your referral link: https://t.me/${msg.chat.username || 'pure_ai_token_bot'}?start=${msg.from.id}`);
  });

  bot.on('polling_error', (err) => console.log("Polling error:", err.message));

  console.log("🤖 Bot polling started!");
}

app.get('/', (req, res) => res.send('pure-ai LIVE OK - Bot Running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
