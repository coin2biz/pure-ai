import os
from telegram.ext import Application, CommandHandler

TOKEN = os.getenv("BOT_TOKEN").strip()

async def start(update, context):
    await update.message.reply_text("Bot working ✅")

app = Application.builder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))
app.run_polling()
