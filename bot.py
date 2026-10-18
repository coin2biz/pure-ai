import os
import asyncio
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

# FIX for Python 3.14 on Render
try:
    asyncio.set_event_loop(asyncio.new_event_loop())
except:
    pass

TOKEN = os.getenv("BOT_TOKEN", "").strip()

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Bot working ✅")

async def main():
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    print("Bot started - waiting for /start")
    await app.run_polling()

if __name__ == "__main__":
    asyncio.run(main())
