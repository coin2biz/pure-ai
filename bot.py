import os, asyncio, threading
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from pymongo import MongoClient
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

TOKEN = os.getenv("BOT_TOKEN")
MONGO_URL = os.getenv("MONGO_URL")
ADMIN_ID = 6978164887

client = MongoClient(MONGO_URL)
db = client["pure_ai"]
users = db["users"]
withdraws = db["withdraws"]

MINE_AMOUNT = 30
MINE_HOURS = 12
REF_BONUS = 10
MIN_WITHDRAW = 100
TOP_REFERRAL_GOAL = 1000
TOP_REWARD = 1000000

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"PURE AI BOT Live")
    def log_message(self, *a): return

def run_server():
    HTTPServer(("0.0.0.0", int(os.getenv("PORT", 10000))), Handler).serve_forever()

def is_valid_ton_wallet(a):
    return (a.startswith("EQ") or a.startswith("UQ")) and len(a)==48

async def start(update, context):
    uid=update.effective_user.id
    if not users.find_one({"user_id":uid}):
        if context.args:
            try:
                ref=int(context.args[0])
                if ref!=uid and users.find_one({"user_id":ref}):
                    users.update_one({"user_id":ref},{"$inc":{"friends":1,"balance":REF_BONUS}})
                    await context.bot.send_message(ref,f"🎉 New referral! +{REF_BONUS} PURE")
            except: pass
        users.insert_one({"user_id":uid,"balance":0,"friends":0,"last_mine":datetime.utcnow()-timedelta(hours=13),"wallet":None,"top_claimed":False})
        await update.message.reply_text("🚀 Welcome! /mine 30 PURE | /setwallet | /withdraw | /top")
    else:
        await update.message.reply_text("Welcome back! /mine | /balance | /setwallet | /withdraw | /top")

async def mine(update, context):
    u=users.find_one({"user_id":update.effective_user.id})
    if not u: return
    now=datetime.utcnow()
    nxt=u["last_mine"]+timedelta(hours=MINE_HOURS)
    if now<nxt:
        rem=nxt-now; h=int(rem.total_seconds()//3600); m=int((rem.total_seconds()%3600)//60)
        await update.message.reply_text(f"⏳ Next in {h}h {m}m"); return
    users.update_one({"user_id":update.effective_user.id},{"$set":{"last_mine":now},"$inc":{"balance":MINE_AMOUNT}})
    await update.message.reply_text(f"⛏️ +{MINE_AMOUNT} PURE mined! Balance: {u['balance']+MINE_AMOUNT}")

async def setwallet(update, context):
    if not context.args:
        await update.message.reply_text("👛 /setwallet EQ... (48 chars, TON only)"); return
    w=context.args[0].strip()
    if not is_valid_ton_wallet(w):
        await update.message.reply_text("❌ Invalid TON! Must start EQ/UQ and 48 chars"); return
    users.update_one({"user_id":update.effective_user.id},{"$set":{"wallet":w}})
    await update.message.reply_text(f"✅ TON Wallet saved: {w}")

async def withdraw(update, context):
    u=users.find_one({"user_id":update.effective_user.id})
    wallet=u.get("wallet") if u else None
    if not wallet:
        await update.message.reply_text("❌ First /setwallet YOUR_TON (EQ/UQ)"); return
    if not context.args:
        await update.message.reply_text(f"💸 /withdraw <amount>\nWallet: {wallet}\nBal: {u['balance']}"); return
    try: amt=int(context.args[0])
    except: return
    if amt<MIN_WITHDRAW or u['balance']<amt:
        await update.message.reply_text(f"❌ Min {MIN_WITHDRAW}, Bal {u['balance']}"); return
    users.update_one({"user_id":update.effective_user.id},{"$inc":{"balance":-amt}})
    withdraws.insert_one({"user_id":update.effective_user.id,"amount":amt,"wallet":wallet,"status":"PENDING","time":datetime.utcnow()})
    await update.message.reply_text(f"✅ {amt} PURE to TON wallet {wallet} - PENDING")
    try: await context.bot.send_message(ADMIN_ID,f"🚨 WITHDRAW {amt} to {wallet} by {update.effective_user.id}")
    except: pass

async def balance(update, context):
    u=users.find_one({"user_id":update.effective_user.id})
    await update.message.reply_text(f"💰 {u['balance']} PURE | 👥 {u['friends']} | 👛 {u.get('wallet','Not set')}")

async def referral(update, context):
    uid=update.effective_user.id; botname=(await context.bot.get_me()).username
    u=users.find_one({"user_id":uid})
    top=list(users.find().sort("friends",-1).limit(10))
    is_top=any(x['user_id']==uid for x in top)
    if u['friends']>=TOP_REFERRAL_GOAL and is_top and not u.get('top_claimed'):
        users.update_one({"user_id":uid},{"$inc":{"balance":TOP_REWARD},"$set":{"top_claimed":True}})
        await update.message.reply_text(f"🏆 BONUS! +{TOP_REWARD} PURE for Top 10 + {TOP_REFERRAL_GOAL} refs!")
    await update.message.reply_text(f"👥 https://t.me/{botname}?start={uid}\nFriends: {u['friends']}\nTop10 + {TOP_REFERRAL_GOAL} refs = {TOP_REWARD} PURE")

async def top(update, context):
    top=list(users.find().sort("friends",-1).limit(10))
    txt="🏆 TOP 10\n"
    for i,x in enumerate(top,1): txt+=f"{i}. {x['user_id']} - {x['friends']} refs\n"
    txt+=f"\n{TOP_REFERRAL_GOAL} refs + Top10 = {TOP_REWARD} PURE"
    await update.message.reply_text(txt)

async def main():
    threading.Thread(target=run_server,daemon=True).start()
    app=Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start",start)); app.add_handler(CommandHandler("mine",mine)); app.add_handler(CommandHandler("setwallet",setwallet)); app.add_handler(CommandHandler("withdraw",withdraw)); app.add_handler(CommandHandler("balance",balance)); app.add_handler(CommandHandler("referral",referral)); app.add_handler(CommandHandler("top",top))
    await app.initialize(); await app.start(); await app.updater.start_polling(); await asyncio.Event().wait()
if __name__=="__main__": asyncio.run(main())
