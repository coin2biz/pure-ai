const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.BOT_TOKEN;
const URL = process.env.RENDER_EXTERNAL_URL;

const bot = new TelegramBot(TOKEN);

app.get('/', (req, res) => {
  res.send('pure-ai bot running!');
});

app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.on('message', async (msg) => {
  await bot.sendMessage(msg.chat.id, `Hi ${msg.from.first_name}! pure-ai here 🚀`);
});

app.listen(PORT, async () => {
  console.log('Server on ' + PORT);
  if (URL) {
    await bot.setWebHook(`${URL}/bot${TOKEN}`);
    console.log('Webhook set!');
  }
});
