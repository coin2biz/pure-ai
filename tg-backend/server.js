const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
console.log("Bot polling started - @pureaitoken_bot");

let users = {};

function getUser(id) {
  if (!users[id]) users[id] = { balance: 0, referrals: 0, wallet: "", mined: 0, referred: false };
  return users[id];
}

bot.onText(/\/start(?: (.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const referredBy = match[1];
  const user = getUser(userId);
  
  if (referredBy && referredBy != userId && !user.referred) {
    user.referred = true;
    const refUser = getUser(referredBy);
    refUser.referrals += 1;
    refUser.balance += 10;
    try { bot.sendMessage(referredBy, "🎉 New referral! +10 PURE! Total: " + refUser.referrals); } catch(e) {}
  }
  
  bot.sendMessage(chatId, 
    "Welcome to PURE AI Token! 🚀\n\n" +
    "💎 Mine, Refer, Earn. Web3 Revolution.\n\n" +
    "/mine - Mine 3 PURE\n" +
    "/balance - Check balance\n" +
    "/referral - Get your link\n" +
    "/wallet - Set TON wallet"
  );
});

bot.onText(/\/mine/, (msg) => {
  const user = getUser(msg.from.id);
  const now = Date.now();
  if (user.lastMine && now - user.lastMine < 60000) {
    bot.sendMessage(msg.chat.id, "⏳ Wait 1 min to mine again!"); return;
  }
  user.lastMine = now;
  user.balance += 3;
  user.mined += 3;
  bot.sendMessage(msg.chat.id, "⛏️ Mined 3 PURE! Balance: " + user.balance);
});

bot.onText(/\/balance/, (msg) => {
  const u = getUser(msg.from.id);
  bot.sendMessage(msg.chat.id, "💰 Balance: " + u.balance + " PURE\n👥 Referrals: " + u.referrals + "\n⛏️ Mined: " + u.mined + "\n👛 Wallet: " + (u.wallet || "Not set"));
});

bot.onText(/\/referral/, (msg) => {
  const userId = msg.from.id;
  const u = getUser(userId);
  const link = "https://t.me/pureaitoken_bot?start=" + userId;
  bot.sendMessage(msg.chat.id, "🔗 Your Referral Link:\n" + link + "\n\n👥 Referrals: " + u.referrals + "\n💰 Earn 10 PURE per friend!");
});

bot.onText(/\/wallet/, (msg) => {
  bot.sendMessage(msg.chat.id, "👛 Send your TON wallet address (starts with UQ or EQ):");
});

bot.onText(/^(UQ|EQ|0Q)[A-Za-z0-9_-]+$/, (msg) => {
  const u = getUser(msg.from.id);
  u.wallet = msg.text;
  bot.sendMessage(msg.chat.id, "✅ Wallet saved: " + msg.text);
});

bot.on('polling_error', (e) => console.log(e.message));
app.get('/', (req, res) => res.send('PURE AI running'));
app.listen(process.env.PORT || 10000, () => console.log("Server running"));
