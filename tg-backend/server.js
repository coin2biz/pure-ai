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
  lastMine: { type: Number, default: 0 },
  lastDaily: { type: Date, default: null },
  stakes: { type: Array, default: [] },
  stakingState: { type: String, default: "" },
  tempStakeAmount: { type: Number, default: 0 }
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
    refUser.balance += 50;
    await refUser.save();
    try { bot.sendMessage(referredBy, "🎉 New referral! +50 PURE"); } catch(e) {}
  }

  bot.sendMessage(chatId,
    "Welcome to PURE AI Token! 🚀\n\n" +
    "💎 Mine, Refer, Earn. Web3 Revolution!\n\n" +
    "/mine - Mine 30 PURE\n" +
    "/balance - Check balance\n" +
    "/referral - Get your link\n" +
    "/wallet - Set TON wallet\n" +
    "/withdraw - withdraw PURE\n" +
    "/top - Top holders 🏆\n" +
    "/daily - Daily Bonus 🎁\n" +
    "/card - View Your Virtual PURE Card 💳\n" +
    "/load - Load PURE Card USDT BEP20 - 1 USDT = 100 PURE\n" +
    "/confirm - Confirm USDT Payment with TX Hash\n" +
    "/stake - Stake PURE & Earn 200% (Min 5000) 💎\n" +
    "/staking - View your active stakes 📊\n" +
    "/unstake - Claim your staking rewards 💰\n" +
    "📢 Official: https://t.me/pureaiofficial\n" +
    "🤖 Bot: https://t.me/pureaitoken_bot\n" +
    "🐦 X: https://x.com/pureaitoken"
  );
});
// ONLY CARD SHOWED TO CLIENT - TEXT ONLY, NO PNG NEEDED
bot.onText(/\/card/, async (msg) => {
  let user = await getUser(msg.from.id);
  let totalStaked = 0;
  if(user.stakes && user.stakes.length > 0){
    user.stakes.forEach(s=>{ if(!s.claimed) totalStaked += s.amount; });
  }
  
  if(totalStaked < 5000){
    return bot.sendMessage(msg.chat.id, "❌ Need Min 5000 PURE Stake! Use /stake to get your Virtual Card 💳");
  }
  
  let textCard = `
╔══════════════════════════╗
║  💳 PURE VIRTUAL CARD 💳  ║
╠══════════════════════════╣
║  Holder: ${msg.from.first_name}
║  Stake: ${totalStaked} PURE
║  No: 4000 1234 5678 9010
║  Valid: 12/31 - 5 YEARS
║  Status: ✅ ACTIVE
║  Type: LIVE Virtual
║  PURE AI TOKEN
╚══════════════════════════╝
`;
  bot.sendMessage(msg.chat.id, textCard);
});

bot.onText(/\/mine/, async (msg) => {
  let user = await getUser(msg.from.id);
  let now = Date.now();
  if (user.lastMine && now - user.lastMine < 43200000) {
    return bot.sendMessage(msg.chat.id, "⏳ Wait 12 hour to mine again! you got 30 PURE");
  }
  user.lastMine = now;
  user.balance += 30;
  user.mined += 30;
  await user.save();
  bot.sendMessage(msg.chat.id, "⛏️ Mined 30 PURE! Balance: " + user.balance);
});

bot.onText(/\/balance/, async (msg) => {
  let u = await getUser(msg.from.id);
  bot.sendMessage(msg.chat.id, "💰 Balance: " + u.balance + " PURE\nMined: " + u.mined + "\nReferrals: " + u.referrals);
});

bot.onText(/\/referral/, async (msg) => {
  let userId = msg.from.id;
  await getUser(userId);
  let link = "https://t.me/pureaitoken_bot?start=" + userId;
  bot.sendMessage(msg.chat.id, "🔗 Your link:\n" + link + "\n\nEarn 50 PURE per referral!");
});bot.onText(/\/top/, async (msg) => {
  let top = await User.find().sort({balance:-1}).limit(20);
  let t = "🏆 TOP 20 PURE HOLDERS 🏆\n\n";
  for(let i=0;i<top.length;i++){
    t += (i+1) + ". User " + String(top[i].userId).slice(-4) + " - " + top[i].balance + " PURE\n";
  }
  bot.sendMessage(msg.chat.id, t);
});
bot.onText(/\/daily/, async (msg) => {
  try {
    let user = await getUser(msg.from.id);
    let now = Date.now();
    if(user.lastDaily){
      let diff = now - new Date(user.lastDaily).getTime();
      if(diff < 24*60*60*1000){
        let hoursLeft = Math.ceil((24*60*60*1000 - diff) / (1000*60*60));
        return bot.sendMessage(msg.chat.id, "⏰ Already claimed! Come back after " + hoursLeft + " hours! ⏰");
      }
    }
    user.balance += 5;
    user.lastDaily = new Date();
    await user.save();
    bot.sendMessage(msg.chat.id, "🎁 DAILY BONUS CLAIMED! +5 PURE! 🎁\n\nNew Balance: " + user.balance + " PURE\nCome back tomorrow!");
  } catch(e){ console.log(e); }
});
// ========== STAKING SYSTEM ==========
bot.onText(/\/stake/, async (msg) => {
  let user = await getUser(msg.from.id);
  let args = msg.text.split(" ");
  if(args.length >= 3){
    let amt = parseInt(args[1]); let d = parseInt(args[2]);
    return doStake(msg.chat.id, user, amt, d);
  }
  user.stakingState = "awaiting_amount"; await user.save();
  bot.sendMessage(msg.chat.id, `💎 *PURE STAKING*\nBalance: ${user.balance} PURE\nMin: 5000\n\nAmount :\nEx: 5000`, {parse_mode:"Markdown"});
});

bot.onText(/\/staking/, async (msg) => {
  let user = await getUser(msg.from.id);
  if(!user.stakes || user.stakes.length==0) return bot.sendMessage(msg.chat.id, "📊 No stakes! /stake 💎");
  let txt = `📊 *YOUR STAKES* 💎\n\n`;
  user.stakes.forEach((s,i)=>{
    let matured = Date.now() >= s.end;
    let st = s.claimed ? "✅ CLAIMED" : matured ? "🟢 READY /unstake" : "🟡 LOCKED";
    txt+=`${i+1}. ${s.amount} | ${s.days}D | +${s.reward} | ${st}\n\n`;
  });
  bot.sendMessage(msg.chat.id, txt, {parse_mode:"Markdown"});
});

bot.onText(/\/unstake/, async (msg) => {
  let user = await getUser(msg.from.id);
  let claimable = user.stakes.filter(s=>!s.claimed && Date.now()>=s.end);
  if(claimable.length==0) return bot.sendMessage(msg.chat.id, "⏳ No matured stakes! /staking check");
  let total=0; claimable.forEach(s=>{total+=s.total; s.claimed=true;});
  user.balance+=total; await user.save();
  bot.sendMessage(msg.chat.id, `💰 *UNSTAKED!* 🎉\n+${total} PURE added to balance!\n/balance check`, {parse_mode:"Markdown"});
});

async function doStake(chatId, user, amount, days){
  if(amount < 5000) return bot.sendMessage(chatId, "❌ Min 5000 PURE!");
  if(amount > user.balance) return bot.sendMessage(chatId, `❌ Balance low! Have ${user.balance}`);
  if(![7,30,100].includes(days)) return bot.sendMessage(chatId, "❌ Days: 7, 30 or 100 only");
  let rates = {7:0.10,30:0.40,100:2.0};
  let reward = amount * rates[days];
  let total = amount + reward;
  user.balance -= amount;
  user.stakes.push({amount, reward, total, days, start: Date.now(), end: Date.now() + days*86400000, claimed:false});
  user.stakingState=""; user.tempStakeAmount=0; await user.save();
  bot.sendMessage(chatId, `✅ *STAKED!* 💎\nAmount: ${amount}\nLock: ${days}D\nReward: ${reward} (${rates[days]*100}%)\nReturn: ${total}\n\n/staking`, {parse_mode:"Markdown"});
}

bot.on("message", async (msg) => {
  if(!msg.text || msg.text.startsWith("/")) return;
  let user = await getUser(msg.from.id); if(!user.stakingState) return;
  if(user.stakingState=="awaiting_amount"){
    let amt = parseInt(msg.text); if(isNaN(amt)||amt<5000) return bot.sendMessage(msg.chat.id, "❌ Min 5000! Valid amount anuppu");
    if(amt>user.balance) return bot.sendMessage(msg.chat.id, `❌ Low balance! ${user.balance} only`);
    user.tempStakeAmount=amt; user.stakingState="awaiting_days"; await user.save();
    return bot.sendMessage(msg.chat.id, `Amount: ${amt} ✅\n\nLock choose:\n1 - 7 Days (10%)\n2 - 30 Days (40%)\n3 - 100 Days (200%)\n\nType 1, 2 or 3`);
  }
  if(user.stakingState=="awaiting_days"){
    let map={"1":7,"2":30,"3":100}; let d=map[msg.text.trim()];
    if(!d) return bot.sendMessage(msg.chat.id, "❌ 1, 2 or 3 mattum!");
    let amt=user.tempStakeAmount; user.stakingState=""; user.tempStakeAmount=0; await user.save();
    return doStake(msg.chat.id, user, amt, d);
  }
});
bot.onText(/\/withdraw/, async (msg) => {
  let u = await getUser(msg.from.id);
  if(u.balance < 10000){
    return bot.sendMessage(msg.chat.id, `❌ Need 10000 PURE to withdraw!\n\n💰 Your Balance: ${u.balance} PURE\n\nKeep mining /mine`);
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
