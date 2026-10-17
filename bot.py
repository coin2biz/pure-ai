import os
import asyncio
import threading
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from pymongo import MongoClient
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

TOKEN = os.getenv("BOT_TOKEN")
MONGO_URL = os.getenv("MONGO_URL")
ADMIN_ID = 6978164887  # YOUR ID ADDED ✅

client = MongoClient(MONGO_URL)
db = client["pure_ai"]
users = db["users"]
withdraws = db["withdraws"]

MINE_AMOUNT = 3
MINE_HOURS = 12
REF_BONUS = 10
MIN_WITHDRAW = 100

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"PURE AI BOT is Live")
    def log_message(self, *args): return

def run_server():
    port = int(os.getenv("PORT", 10000))
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if not users.find_one({"user_id": uid}):
        if context.args:
            try:
                ref_id = int(context.args[0])
                if ref_id != uid and users.find_one({"user_id": ref_id}):
                    users.update_one({"user_id": ref_id}, {"$inc": {"friends": 1, "balance": REF_BONUS, "earned": REF_BONUS}})
                    await context.bot.send_message(ref_id, f"🎉 New referral! +{REF_BONUS} PURE from {update.effective_user.first_name}")
            except: pass
        users.insert_one({"user_id": uid, "balance": 0, "friends": 0, "earned": 0, "last_mine": datetime.utcnow() - timedelta(hours=13)})
        await update.message.reply_text("🚀 Welcome to PURE AI TOKEN!\n\n⛏️ /mine - Mine 3 PURE every 12h\n💰 /balance - Check ledger\n👥 /referral - Earn 10 PURE\n💸 /withdraw - Withdraw PURE")
    else:
        await update.message.reply_text("Welcome back! Use /mine | /balance | /withdraw")

async def mine(update: Update, context: ContextTypes.DEFAULT_TYPE):
    u = users.find_one({"user_id": update.effective_user.id})
    if not u: await update.message.reply_text("Please /start first"); return
    now = datetime.utcnow()
    nxt = u["last_mine"] + timedelta(hours=MINE_HOURS)
    if now < nxt:
        rem = nxt - now; h = int(rem.total_seconds()//3600); m = int((rem.total_seconds()%3600)//60)
        await update.message.reply_text(f"⏳ Next claim in {h}h {m}m"); return
    users.update_one({"user_id": update.effective_user.id}, {"$set": {"last_mine": now}, "$inc": {"balance": MINE_AMOUNT}})
    await update.message.reply_text(f"Mining complete: +{MINE_AMOUNT} PURE.\nLedger balance: {u['balance']+MINE_AMOUNT} PURE.\nNext in {MINE_HOURS}h.")

async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    u = users.find_one({"user_id": update.effective_user.id})
    if not u: await update.message.reply_text("Please /start first"); return
    await update.message.reply_text(f"💰 Ledger: {u['balance']} PURE.\n👥 Friends: {u['friends']}\n\n💸 Min Withdraw: {MIN_WITHDRAW} PURE\n/withdraw <amount> <wallet>")

async def referral(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    botname = (await context.bot.get_me()).username
    u = users.find_one({"user_id": uid})
    friends = u['friends'] if u else 0
    await update.message.reply_text(f"👥 Referral Link:\nhttps://t.me/{botname}?start={uid}\n\nFriends: {friends}\nEarn {REF_BONUS} PURE per referral.")

async def withdraw(update: Update, context: ContextTypes.DEFAULT_TYPE):
    u = users.find_one({"user_id": update.effective_user.id})
    if not u: await update.message.reply_text("Please /start first"); return
    if len(context.args) < 2:
        await update.message.reply_text(f"💸 Format:\n/withdraw 100 0xYourBEP20Address\n\nMin: {MIN_WITHDRAW} PURE\nBalance: {u['balance']} PURE"); return
    try: amount = int(context.args[0]); wallet = context.args[1]
    except: await update.message.reply_text("❌ Ex: /withdraw 100 0x123..."); return
    if amount < MIN_WITHDRAW: await update.message.reply_text(f"❌ Minimum {MIN_WITHDRAW} PURE"); return
    if u['balance'] < amount: await update.message.reply_text(f"❌ You have only {u['balance']} PURE"); return
    if len(wallet) < 20: await update.message.reply_text("❌ Invalid wallet"); return
    users.update_one({"user_id": update.effective_user.id}, {"$inc": {"balance": -amount}})
    withdraws.insert_one({"user_id": update.effective_user.id, "username": f"@{update.effective_user.username}", "amount": amount, "wallet": wallet, "status": "PENDING", "time": datetime.utcnow()})
    await update.message.reply_text(f"✅ Request Submitted!\n\nAmount: {amount} PURE\nWallet: {wallet}\nStatus: PENDING\nProcessed within 24h.")
    try: await context.bot.send_message(ADMIN_ID, f"🚨 NEW WITHDRAW\nUser: @{update.effective_user.username} ({update.effective_user.id})\nAmount: {amount} PURE\nWallet: {wallet}\nLeft: {u['balance']-amount}")
    except: pass

async def main():
    threading.Thread(target=run_server, daemon=True).start()
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start)); app.add_handler(CommandHandler("mine", mine)); app.add_handler(CommandHandler("balance", balance)); app.add_handler(CommandHandler("referral", referral)); app.add_handler(CommandHandler("withdraw", withdraw))
    print("PURE AI BOT Live - Withdraw Enabled"); await app.initialize(); await app.start(); await app.updater.start_polling(); await asyncio.Event().wait()
if __name__ == "__main__": asyncio.run(main())
