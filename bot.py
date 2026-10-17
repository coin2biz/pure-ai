import os
from datetime import datetime, timedelta
from pymongo import MongoClient
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

TOKEN = os.getenv("BOT_TOKEN")
MONGO_URL = os.getenv("MONGO_URL")

# MongoDB connect
client = MongoClient(MONGO_URL)
users = client["pure_ai"]["users"]

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    name = update.effective_user.first_name
    
    # User illana create pannu
    existing = users.find_one({"user_id": uid})
    if not existing:
        # Referral check
        if context.args:
            try:
                ref_id = int(context.args[0])
                # Thannai thanye refer panna koodathu
                if ref_id != uid:
                    ref_user = users.find_one({"user_id": ref_id})
                    if ref_user:
                        # Referrer ku bonus add
                        users.update_one(
                            {"user_id": ref_id},
                            {"$inc": {"friends": 1, "earned": 10, "balance": 10}}
                        )
            except:
                pass
        
        # Puthu user ah save pannu
        users.insert_one({
            "user_id": uid,
            "name": name,
            "balance": 0,
            "speed": 0.1, # 0.1 / Hour
            "level": 1,
            "friends": 0,
            "earned": 0,
            "last_claim": datetime.utcnow() - timedelta(hours=4)
        })
    
    await update.message.reply_text(
        f"🚀 Welcome {name} to PURE AI TOKEN!\n\n"
        f"⛏️ Mining: 0.1 PURE / Hour\n"
        f"👥 Referral: 10 PURE per friend (10%)\n\n"
        f"Open Mini App to start mining!"
    )

async def chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Ippo yaar message anupunaalum avanga data paathu reply pannum
    uid = update.effective_user.id
    u = users.find_one({"user_id": uid})
    bal = u["balance"] if u else 0
    friends = u["friends"] if u else 0
    
    await update.message.reply_text(
        f"You said: {update.message.text}\n\n"
        f"💰 Balance: {bal} PURE\n"
        f"👥 Friends: {friends}\n"
        f"Pure AI thinking... 🧠✨"
    )

def main():
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, chat))
    print("Pure AI Bot with MINING Started")
    app.run_polling()

if __name__ == "__main__":
    main()
