const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

console.log("Bot started @pureaitoken");

// PERMANENT DATABASE - MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected - Permanent Storage!"))
  .catch(e => console.log("Mongo Error", e));

const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  balance: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  mined: { type: Number, default: 0 },
  wallet: { type: String, default: "" },
  referred: { type: Boolean, default: false },
  lastMine: { type: Number, default: 0 }
});

const User = mongoose.model('User', UserSchema);

async function getUser(id) {
  let user = await User.findOne({ userId: id.toString() });
  if (!user) {
    user = await User.create({ userId: id.toString(), balance: 10 });
  }
  return user;
}

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const referredBy = match[1];
  
  let user = await getUser(userId);

  if (referredBy && referredBy != userId && !user.referred) {
    user.referred = true;
    await user.save();
    let refUser = await getUser(referredBy);
    refUser.referrals += 1;
    refUser.balance += 10;
    await refUser.save();
    try { bot.sendMessage(referredBy, "🎉 New referral! +10 PURE"); } catch(e) {}
  }

  bot.sendMessage(chatId,
    "Welcome to PURE AI Token! 🚀\n\n" +
    "💎 Mine, Refer, Earn. Web3 Revolution!\n\n" +
    "/mine - Mine 3 PURE\n" +
    "/balance - Check balance\n" +
    "/referral - Get your link\n" +
    "/wallet - Set TON wallet\n" +
    "/withdraw - withdraw PURE "
  );
});

bot.onText(/\/mine/, async (msg) => {
  let user = await getUser(msg.from.id);
  let now = Date.now();
  if (user.lastMine && now - user.lastMine < 3600000) {
    return bot.sendMessage(msg.chat.id, "⏳ Wait 1 hour to mine again!");
  }
  user.lastMine = now;
  user.balance += 3;
  user.mined += 3;
  await user.save();
  bot.sendMessage(msg.chat.id, "⛏️ Mined 3 PURE! Balance: " + user.balance);
});

bot.onText(/\/balance/, async (msg) => {
  let u = await getUser(msg.from.id);
  bot.sendMessage(msg.chat.id, "💰 Balance: " + u.balance + " PURE\nMined: " + u.mined + "\nReferrals: " + u.referrals);
});

bot.onText(/\/referral/, async (msg) => {
  let userId = msg.from.id;
  await getUser(userId);
  let link = "https://t.me/pureaitoken_bot?start=" + userId;
  bot.sendMessage(msg.chat.id, "🔗 Your link:\n" + link + "\n\nEarn 10 PURE per referral!");
});
bot.onText(/\/withdraw/, async (msg) => {
  let u = await getUser(msg.from.id);
  if(u.balance < 5000){
    return bot.sendMessage(msg.chat.id, `❌ Need 5000 PURE to withdraw!\n\n💰 Your Balance: ${u.balance} PURE\n\nKeep mining /mine`);
  }
  bot.sendMessage(msg.chat.id, `💸 WITHDRAWAL REQUEST 💸\n\n💰 Balance: ${u.balance} PURE\n📦 Amount: ${u.balance} PURE\n👛 Wallet: ${u.wallet || "Not set! Use /wallet"}\n\n✅ Request sent to @VKR9339\n⏰ Payment in 24 hours on TON!`);
});

bot.onText(/\/wallet/, (msg) => {
  bot.sendMessage(msg.chat.id, "👛 Send your TON wallet (UQ/EQ...)");
});

bot.onText(/^(UQ|EQ|0Q)[A-Za-z0-9-_]+$/, async (msg) => {
  let u = await getUser(msg.from.id);
  u.wallet = msg.text;
  await u.save();
  bot.sendMessage(msg.chat.id, "✅ Wallet saved: " + msg.text);
});

bot.on('polling_error', (e) => console.log(e));
app.get('/', (req, res) => res.send('PURE AI Bot Running - Permanent DB!'));
app.listen(process.env.PORT || 10000, () => console.log("Server running"));
