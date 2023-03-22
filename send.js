import TelegramBot from "node-telegram-bot-api";
import { readTrial, readOpened } from "./db.js";
import dotenv from "dotenv";
dotenv.config({ override: true });

const bot = new TelegramBot(process.env.TELEGRAM_KEY);
const trial = readTrial();
const opened = readOpened();

const users = Object.keys(trial).filter((chatId) => !opened[chatId]);
// every 100 milliseconds pop one element from trial
setInterval(() => {
    const chatId = users.pop();
    if (!chatId) return;
    console.log(chatId);
    bot.sendMessage(
        chatId,
        `Подключили версию GPT-3.5 в нашем боте! 🚀

В новой версии:
        
• повысили скорость обработки запросов. Стала доступна оптимизированная, более респонсивная версия GPT, которую OpenAI предварительно тестировала некоторое время.
        
• улучшенная интерпретация русского языка. Теперь GPT-3.5 намного лучше работает с русским языком, поэтому можно выключить автопереводчик Telegram.
        
• генерация более длинных "связных" текстов. Обновленная модель запоминает бóльшие объемы текста, а это значит, что ваши сгенерированные результаты будут всё более связными и логичными.
        
До встречи в следующем апдейте и успешной пробы новой версии! 👍
https://t.me/maxsoft_chat_gpt_group 🤗`
    )
        .then(() => {})
        .catch((e) => {
            console.error(e.message);
        });
}, 100);


