import os
import asyncio
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pymongo import MongoClient
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

TOKEN = os.getenv("BOT_TOKEN")
MONGO_URL = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI")
ADMIN_ID = 6978164887

client = MongoClient(MONGO_URL)
db = client["pure_ai"]
users = db["users"]
withdraws = db["withdraws"]

MINE_AMOUNT = 30
MINE_HOURS = 12
REF_BONUS = 10
MIN_WITHDRAW = 1000
TOP_GOAL = 1000
TOP_REWARD = 1000000

def now_utc():
    return datetime.now(timezone.utc)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"PURE AI BOT Live - TON Only - 30 PURE - Min 1000")
    def log_message(self, *a): return

def run_server():
    HTTPServer(("0.0.0.0", int(os.getenv("PORT", 10000))), Handler).serve_forever()

def is_ton(addr):
    return addr and (addr.startswith("EQ") or addr.startswith("UQ")) and len(addr) == 48

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    doc = users.find_one({"user_id": uid})
    if not doc:
        if context.args:
            try:
                ref = int(context.args[0])
                if ref != uid and users.find_one({"user_id": ref}):
                    users.update_one({"user_id": ref}, {"$inc": {"friends": 1, "balance": REF_BONUS, "earned": REF_BONUS}})
                    try:
                        await context.bot.send_message(ref, f"🎉 New referral! +{REF_BONUS} PURE from {update.effective_user.first_name}")
                    except: pass
            except: pass
        users.insert_one({"user_id": uid, "balance": 0, "friends": 0, "earned": 0, "last_mine": now_utc() - timedelta(hours=13), "wallet": None, "top_claimed": False, "username": update.effective_user.username})
        await update.message.reply_text("🚀 Welcome to PURE AI TOKEN!\n\n⛏️ /mine - Mine 30 PURE every 12h\n💰 /balance - Check balance\n👥 /referral - Earn 10 PURE per friend\n👛 /setwallet - Set TON wallet (EQ/UQ 48 chars)\n💸 /withdrawal - Withdraw min 1000 PURE\n🏆 /top - Top 10 = 1M PURE bonus")
    else:
        await update.message.reply_text("Welcome back!\n/mine | /balance | /referral | /wallet | /setwallet | /withdrawal | /top")

async def mine(update: Update, context: ContextTypes.DEFAULT_TYPE):
    u = users.find_one({"user_id": update.effective_user.id})
    if not u:
        await update.message.reply_text("Please /start first")
        return
    now = now_utc()
    last = u["last_mine"]
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    nxt = last + timedelta(hours=MINE_HOURS)
    if now < nxt:
        rem = nxt - now
        h = int(rem.total_seconds() // 3600)
        m = int((rem.total_seconds() % 3600) // 60)
        await update.message.reply_text(f"⏳ Next claim in {h}h {m}m")
        return
    users.update_one({"user_id": update.effective_user.id}, {"$set": {"last_mine": now}, "$inc": {"balance": MINE_AMOUNT, "earned": MINE_AMOUNT}})
    await update.message.reply_text(f"⛏️ Mining complete: +{MINE_AMOUNT} PURE\n💰 Balance: {u['balance']+MINE_AMOUNT} PURE\nNext claim in {MINE_HOURS}h")

async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    u = users.find_one({"user_id": update.effective_user.id})
    if not u:
        await update.message.reply_text("Please /start first")
        return
    w = u.get("wallet")
    wtxt = w if w else "Not set - Use /setwallet EQ..."
    await update.message.reply_text(f"💰 {u['balance']} PURE | 👥 {u.get('friends',0)} | 👛 {wtxt}")

async def referral(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    me = await context.bot.get_me()
    u = users.find_one({"user_id": uid})
    if not u:
        await update.message.reply_text("Please /start first")
        return
    friends = u.get("friends", 0)
    top_list = list(users.find().sort("friends", -1).limit(10))
    is_top = any(x["user_id"] == uid for x in top_list)
    extra = ""
    if friends >= TOP_GOAL and is_top and not u.get("top_claimed"):
        users.update_one({"user_id": uid}, {"$inc": {"balance": TOP_REWARD, "earned": TOP_REWARD}, "$set": {"top_claimed": True}})
        extra = f"\n\n🏆 CONGRATS! Top10 + {TOP_GOAL} refs = +{TOP_REWARD} PURE!"
        try:
            await context.bot.send_message(ADMIN_ID, f"🏆 TOP REWARD: {uid} @{update.effective_user.username} Friends:{friends}")
        except: pass
    await update.message.reply_text(f"👥 Your Referral Link:\nhttps://t.me/{me.username}?start={uid}\n\nFriends: {friends}\nEarn {REF_BONUS} PURE per referral\n\n🏆 Top 10 with {TOP_GOAL}+ refs = {TOP_REWARD} PURE!{extra}")

async def wallet_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    u = users.find_one({"user_id": update.effective_user.id})
    if not u:
        await update.message.reply_text("Please /start first")
        return
    if not context.args:
        cur = u.get("wallet")
        if cur:
            await update.message.reply_text(f"👛 Your registered TON wallet:\n{cur}\n\nTo change it:\n/setwallet NEW_EQ_ADDRESS (48 chars)")
        else:
            await update.message.reply_text("👛 TON Wallet Not Set\n\n🔹 TON ONLY (EQ/UQ - 48 chars)\nUse:\n/setwallet EQAbc...48chars\n\nGet from Tonkeeper / MyTonWallet")
        return
    addr = context.args[0].strip()
    if not is_ton(addr):
        await update.message.reply_text("❌ Invalid TON wallet!\n\nMust:\n- Start with EQ or UQ\n- Exactly 48 characters")
        return
    users.update_one({"user_id": update.effective_user.id}, {"$set": {"wallet": addr}})
    await update.message.reply_text(f"✅ TON Wallet Registered!\n\n{addr}\n\nNow you can /withdrawal <amount> (min 1000 PURE)")

async def withdraw(update: Update, context: ContextTypes.DEFAULT_TYPE):
    u = users.find_one({"user_id": update.effective_user.id})
    if not u:
        await update.message.reply_text("Please /start first")
        return
    wallet = u.get("wallet")
    if not wallet:
        await update.message.reply_text("❌ No TON wallet set!\nFirst:\n/setwallet EQ... (48 chars TON only)")
        return
    if not is_ton(wallet):
        await update.message.reply_text("❌ Saved wallet invalid! Set again: /setwallet EQ...")
        return
    if not context.args:
        await update.message.reply_text(f"💸 Format: /withdrawal <amount>\n\nRegistered TON: {wallet}\nBalance: {u['balance']} PURE\nMinimum: {MIN_WITHDRAW} PURE")
        return
    try:
        amt = int(context.args[0])
    except:
        await update.message.reply_text("❌ Example: /withdrawal 1000")
        return
    if amt < MIN_WITHDRAW:
        await update.message.reply_text(f"❌ Minimum {MIN_WITHDRAW} PURE required")
        return
    if u["balance"] < amt:
        await update.message.reply_text(f"❌ Insufficient balance. You have only {u['balance']} PURE")
        return
    users.update_one({"user_id": update.effective_user.id}, {"$inc": {"balance": -amt}})
    withdraws.insert_one({"user_id": update.effective_user.id, "username": f"@{update.effective_user.username}", "amount": amt, "wallet": wallet, "status": "PENDING", "time": now_utc()})
    await update.message.reply_text(f"✅ Withdrawal Submitted!\n\nAmount: {amt} PURE\nTON Wallet: {wallet}\nStatus: PENDING (24h)\n\nRemaining balance: {u['balance']-amt} PURE")
    try:
        await context.bot.send_message(ADMIN_ID, f"🚨 NEW WITHDRAWAL (TON)\nUser: @{update.effective_user.username} ({update.effective_user.id})\nAmount: {amt} PURE\nWallet: {wallet}")
    except: pass

async def top(update: Update, context: ContextTypes.DEFAULT_TYPE):
    top_users = list(users.find().sort("friends", -1).limit(10))
    txt = f"🏆 TOP 10 REFERRERS\nReward: {TOP_GOAL}+ refs in Top10 = {TOP_REWARD} PURE\n\n"
    for i, usr in enumerate(top_users, 1):
        f = usr.get("friends", 0)
        mark = " ✅ Eligible" if f >= TOP_GOAL else ""
        txt += f"{i}. ID:{usr['user_id']} - {f} refs{mark}\n"
    txt += f"\nReach {TOP_GOAL} refs + be in Top10 = {TOP_REWARD} PURE!"
    await update.message.reply_text(txt)

async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("📋 Commands:\n/mine - Mine 30 PURE every 12h\n/balance - Check ledger\n/referral - Invite link (10 PURE/ref)\n/wallet or /setwallet - Set TON wallet\n/withdrawal <amount> - Withdraw min 1000 PURE\n/top - Top 10 leaderboard\n/help - This help")

async def main():
    threading.Thread(target=run_server, daemon=True).start()
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("mine", mine))
    app.add_handler(CommandHandler("balance", balance))
    app.add_handler(CommandHandler("referral", referral))
    app.add_handler(CommandHandler("wallet", wallet_cmd))
    app.add_handler(CommandHandler("setwallet", wallet_cmd))
    app.add_handler(CommandHandler("withdraw", withdraw))
    app.add_handler(CommandHandler("withdrawal", withdraw))
    app.add_handler(CommandHandler("top", top))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("kyc", help_cmd))
    print("PURE AI BOT Live")
    await app.initialize()
    await app.start()
    await app.updater.start_polling()
    await asyncio.Event().wait()

if __name__ == "__main__":
    asyncio.run(main())
