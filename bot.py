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

client = MongoClient(MONGO_URL)
users = client["pure_ai"]["users"]

MINE_AMOUNT = 3
MINE_HOURS = 12
REF_BONUS = 10

# Dummy web server for Render Web Service
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"PURE AI BOT is Live")
    def log_message(self, *args): return

def run_server():
    port = int(os.getenv("PORT", 10000))
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()

# Bot handlers
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    user = users.find_one({"user_id": uid})
    if not user:
        if context.args:
            try:
                ref_id = int(context.args[0])
                if ref_id != uid and users.find_one({"user_id": ref_id}):
                    users.update_one({"user_id": ref_id}, {"$inc": {"friends": 1, "balance": REF_BONUS, "earned": REF_BONUS}})
                    await context.bot.send_message(ref_id, f"🎉 New referral! +{REF_BONUS} PURE from {update.effective_user.first_name}")
            except: pass
        users.insert_one({"user_id": uid, "balance": 0, "friends": 0, "earned": 0, "last_mine": datetime.utcnow() - timedelta(hours=13)})
        await update.message.reply_text(f"🚀 Welcome to PURE AI TOKEN!\n\n⛏️ /mine - Mine 3 PURE every 12 hours\n💰 /balance - Check ledger\n👥 /referral - Earn 10 PURE per referral")
    else:
        await update.message.reply_text("Welcome back! Use /mine")

async def mine(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    user = users.find_one({"user_id": uid})
    if not user:
        await update.message.reply_text("Please /start first"); return
    now = datetime.utcnow()
    next_time = user["last_mine"] + timedelta(hours=MINE_HOURS)
    if now < next_time:
        rem = next_time - now
        await update.message.reply_text(f"⏳ Next claim in {int(rem.total_seconds()//3600)}h {int((rem.total_seconds()%3600)//60)}m"); return
    users.update_one({"user_id": uid}, {"$set": {"last_mine": now}, "$inc": {"balance": MINE_AMOUNT}})
    await update.message.reply_text(f"Mining complete: +{MINE_AMOUNT} PURE.\nLedger balance: {user['balance']+MINE_AMOUNT} PURE.\nYour next claim is available in {MINE_HOURS} hours.")

async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    u = users.find_one({"user_id": update.effective_user.id})
    if not u: await update.message.reply_text("Please /start first"); return
    await update.message.reply_text(f"💰 Ledger balance: {u['balance']} PURE.\n👥 Friends: {u['friends']}")

async def referral(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    botname = (await context.bot.get_me()).username
    u = users.find_one({"user_id": uid})
    await update.message.reply_text(f"👥 Your referral link:\nhttps://t.me/{botname}?start={uid}\n\nFriends: {u['friends'] if u else 0}\nEarn {REF_BONUS} PURE per referral.")

async def main():
    threading.Thread(target=run_server, daemon=True).start()
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("mine", mine))
    app.add_handler(CommandHandler("balance", balance))
    app.add_handler(CommandHandler("referral", referral))
    print("PURE AI BOT Live - Mining Enabled")
    await app.run_polling()

if __name__ == "__main__":
    asyncio.run(main())
