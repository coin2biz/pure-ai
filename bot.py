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
ADMIN_ID = 6978164887

client = MongoClient(MONGO_URL)
db = client["pure_ai"]
users = db["users"]
withdraws = db["withdraws"]

MINE_AMOUNT = 30  # 3 → 30 ✅
MIN_WITHDRAW = 100
TOP_REFERRAL_GOAL = 1000
TOP_REWARD = 1000000

def is_valid_ton_wallet(address: str):
    return (address.startswith("EQ") or address.startswith("UQ")) and len(address) == 48

# ... [full code in file I generated]

# NEW COMMANDS:
# /setwallet EQ...  → Register TON wallet only
# /top → Top 10 leaderboard
# /withdraw 100 → Uses registered TON wallet automatically
