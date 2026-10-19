const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const app = express();
app.use(express.json());

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
console.log("Bot polling started");

const DB_FILE = './db.json';
let db = {};
if (fs.existsSync(DB_FILE)) {
  try { db = JSON.parse(fs.readFileSync(DB_FILE)); } catch(e) { db = {}; }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

const getUser = (id) => {
  id = String(id);
  if (!db[id]) {
    db[id] = { balance: 0, lastMine: 0, wallet: "", referrals: 0, referredBy: null };
    saveDB();
  }
  return db[id];
};

bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
  if (!msg.from_user) return;
  const userId = String(msg.from_user.id);
  const refId = match[1] ? match[1].trim() : null;
  getUser(userId);
  if (refId && refId !== userId && refId.length > 3) {
    const user = getUser(userId);
    if (!user.referredBy) {
      user.referredBy = refId;
      const refUser = getUser(refId);
      refUser.balance += 10;
      refUser.referrals += 1;
      saveDB();
      try { bot.sendMessage(refId, `🎉 New referral! +10 PURE!`); } catch(e){}
    }
  }
  saveDB();
  bot.sendMessage(msg.chat.id, `🚀 Welcome to PURE AI TOKEN!\n\n⛏️ /mine - Mine 3 PURE every 12h\n💰 /balance - Check balance\n🔗 /referral - Get link\n👛 /wallet - Set TON wallet`);
});

bot.onText(/\/mine/, (msg) => {
  if (!msg.from_user) return;
  const user = getUser(String(msg.from_user.id));
  const now = Date.now();
  const cooldown = 12*60*60*1000;
  if (now - user.lastMine < cooldown) {
    const rem = cooldown - (now - user.lastMine);
    const h = Math.floor(rem/3600000); const m = Math.floor((rem%3600000)/60000);
    bot.sendMessage(msg.chat.id, `⏳ Already mined! Come back after ${h}h ${m}m`);
    return;
  }
  user.balance += 3; user.lastMine = now; saveDB();
  bot.sendMessage(msg.chat.id, `⛏️ You got 3 PURE!\n💰 Balance: ${user.balance} PURE`);
});

bot.onText(/\/balance/, (msg) => {
  if (!msg.from_user) return;
  const user = getUser(String(msg.from_user.id));
  const w = user.wallet ? `\n👛 Wallet: ${user.wallet.substring(0,6)}...` : `\n👛 Wallet: Not set`;
  bot.sendMessage(msg.chat.id, `💰 Balance: ${user.balance} PURE${w}\nReferrals: ${user.referrals}`);
});

bot.onText(/\/referral/, (msg) => {
  if (!msg.from_user) return;
  bot.sendMessage(msg.chat.id, `🔗 Your Link:\nhttps://t.me/pure_ai_token_bot?start=${msg.from_user.id}`);
});

bot.onText(/\/wallet/, (msg) => {
  if (!msg.from_user) return;
  bot.sendMessage(msg.chat.id, "👛 Send your TON wallet (UQ/EQ):").then(()=>{
    bot.once('message', (nextMsg)=>{
      if (!nextMsg.from_user || nextMsg.chat.id !== msg.chat.id) return;
      const addr = nextMsg.text.trim();
      if (addr.length < 20) { bot.sendMessage(msg.chat.id, "❌ Invalid! Try /wallet again"); return; }
      const u = getUser(String(nextMsg.from_user.id)); u.wallet = addr; saveDB();
      bot.sendMessage(msg.chat.id, `✅ Wallet saved!`);
    });
  });
});

bot.on('polling_error', (err) => { console.log("Polling error: " + err.message); });

app.get('/', (req,res)=> res.send('pure-ai running - fixed'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log("Server running on "+PORT));
