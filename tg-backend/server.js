const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
console.log("Bot polling started");

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Bot working! /mine /balance");
});

bot.onText(/\/mine/, (msg) => {
  bot.sendMessage(msg.chat.id, "You mined 3 PURE!");
});

bot.onText(/\/balance/, (msg) => {
  bot.sendMessage(msg.chat.id, "Balance: 0 PURE");
});

app.get('/', (req, res) => {
  res.send('Bot running');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});
