const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const app = express();
app.use(express.json());

const token = process.env.BOT_TOKEN;
console.log(token ? "BOT_TOKEN found" : "BOT_TOKEN NOT FOUND");

if (!token) {
  console.log("BOT_TOKEN not set");
} else {
  const bot = new TelegramBot(token, { polling: true });
  console.log("Bot polling started");

  const DB_FILE = './db.json';
  let db = {};
  if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE)); } catch(e) { db = {}; }
  }
  const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db));

  const getUser = (id) => {
    id = String(id);
    if (!db[id]) {
      db[id] = { balance: 0, lastMine: 0, wallet: "", referrals: 0, referredBy: null };
      saveDB();
    }
    return db[id];
  };

  bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = String(msg.from_user.id);
    const refId = match[1];

    getUser(userId);

    // Referral logic
    if (refId && refId !== userId) {
      const user = getUser(userId);
      if (!user.referredBy) {
        user.referredBy = refId;
        saveDB();
        const refUser = getUser(refId);
        refUser.balance += 10;
        refUser.referrals += 1;
        saveDB();
        bot.sendMessage(refId, `🎉 New referral! +10 PURE! Total referrals: ${refUser.referrals}`);
      }
    }

    bot.sendMessage(chatId, 
`🚀 *Welcome to PURE AI TOKEN!*

⛏️ Mine 3 PURE every 12 hours
👥 Refer = 10 PURE per friend

Commands:
/mine - Mine 3 PURE
/balance - Check balance
/referral - Get referral link
/wallet - Set TON wallet

💎 Pure Intelligence, Pure Decentralization`, {parse_mode: "Markdown"});
  });

  bot.onText(/\/mine/, (msg) => {
    const userId = String(msg.from_user.id);
    const user = getUser(userId);
    const now = Date.now();
    const cooldown = 12 * 60 * 60 * 1000; // 12 hours

    if (now - user.lastMine < cooldown) {
      const remaining = cooldown - (now - user.lastMine);
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      bot.sendMessage(msg.chat.id, `⏳ Already mined!\nCome back after ${h}h ${m}m`);
      return;
    }

    user.balance += 3;
    user.lastMine = now;
    saveDB();
    bot.sendMessage(msg.chat.id, `⛏️ Mining... You got 3 PURE!\n💰 New Balance: ${user.balance} PURE`);
  });

  bot.onText(/\/balance/, (msg) => {
    const user = getUser(String(msg.from_user.id));
    const walletInfo = user.wallet ? `\n👛 Wallet: ${user.wallet.substring(0,6)}...${user.wallet.slice(-4)}` : `\n👛 Wallet: Not set (/wallet)`;
    bot.sendMessage(msg.chat.id, `💰 Your Balance: ${user.balance} PURE${walletInfo}\n👥 Referrals: ${user.referrals}`);
  });

  bot.onText(/\/referral/, (msg) => {
    const userId = msg.from_user.id;
    const link = `https://t.me/pure_ai_token_bot?start=${userId}`;
    bot.sendMessage(msg.chat.id, `🔗 Your Referral Link:\n${link}\n\nShare & earn 10 PURE per friend!`);
  });

  bot.onText(/\/wallet/, (msg) => {
    bot.sendMessage(msg.chat.id, "👛 Send your TON wallet address (starts with UQ or EQ):").then(() => {
      bot.once('message', (nextMsg) => {
        if (nextMsg.chat.id !== msg.chat.id) return;
        const addr = nextMsg.text.trim();
        if (addr.length < 20 || (!addr.startsWith('UQ') && !addr.startsWith('EQ') && !addr.startsWith('0Q'))) {
          bot.sendMessage(msg.chat.id, "❌ Invalid TON address! Try /wallet again");
          return;
        }
        const user = getUser(String(msg.from_user.id));
        user.wallet = addr;
        saveDB();
        bot.sendMessage(msg.chat.id, `✅ Wallet saved!\n${addr.substring(0,10)}...${addr.slice(-6)}`);
      });
    });
  });

  bot.on('polling_error', (err) => {
    console.log("Polling error: " + err.message);
  });
}

app.get('/', (req, res) => { res.send('pure-ai bot running'); });
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log("Server running on " + PORT); });
