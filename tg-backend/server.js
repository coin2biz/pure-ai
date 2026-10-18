const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

const token = process.env.BOT_TOKEN;
console.log(token ? "✅ BOT_TOKEN found" : "❌ BOT_TOKEN missing");

if (!token) {
  console.log("BOT_TOKEN not set in Environment");
} else {
  const bot = new TelegramBot(token, { polling: true });
  console.log("🤖 Bot polling started");

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "⛏️ Welcome to PURE AI TOKEN Mining!\n\nMine 3 PURE every 12 hours\nRefer friends & earn 10 PURE\n\nCommands:\n/mine - Mine 3 PURE\n/balance - Check balance\n/referral - Get referral link");
  });

  bot.onText(/\/mine/, (msg) => {
    bot.sendMessage(msg.chat.id, "⛏️ Mining... You got 3 PURE!");
  });

  bot.onText(/\/balance/, (msg) => {
    bot.sendMessage(msg.chat.id, "💰 Your balance: Checking...");
  });

  bot.onText(/\/referral/, (msg) => {
    const link = "https://t.me/pure_ai_token_bot?start=" + msg.from.id;
    bot.sendMessage(msg.chat.id, "👥 Your referral link: " + link);
  });

  bot.on('polling_error', (err) => {
    console.log("Polling error: " + err.message);
  });
}

app.get('/', (req, res) => {
  res.send('pure-ai LIVE OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});
