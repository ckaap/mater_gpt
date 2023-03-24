import { config } from 'dotenv';
config();
import fs from 'fs';
import fetch from "node-fetch";
import { Configuration, OpenAIApi } from "openai";
import TelegramBot from "node-telegram-bot-api";
import Replicate from "replicate-js";
import google from "./search.js";
import {
    writeOpened,
    readOpened,
    writeTrial,
    readTrial,
    writeSkip,
    readSkip,
    writeContext,
    readContext,
    readChatSuffix,
    writeChatSuffix,
    writeTemp,
    readTemp,
    writeTime,
    readTime,
    writeMoney,
    readMoney,
} from "./db.js";
import dotenv from "dotenv";
dotenv.config({ override: true });

let CONTEXT_SIZE = 400; // increase can negatively affect your bill, 1 Russian char == 1 token
let MAX_TOKENS = 1000;
let MAX_LENGTH = 300;
let PREMIUM = 2.0;

let MAX_MONEY = 3;
let MAX_GROUP_MONEY = 6;
let PRICE = 5;
let GROUP_PRICE = 10;

let CONTEXT_TIMEOUT = 3600;
let OPENAI_PRICE = 0.002;
let IMAGE_PRICE = 0.002;
let OCR_PRICE = 0.02;

let PROMO_MAX_PER_MINUTE = 25;
let PROMO_MAX_PER_HOUR = 5;
let PROMO = [process.env.GROUP_RU_ID, process.env.GROUP_EN_ID];

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_KEY }));
const bot = new TelegramBot(process.env.TELEGRAM_KEY, { polling: true });

const context = readContext();
const skip = readSkip();
const trial = readTrial();
const opened = readOpened();
const temp = readTemp();
const time = readTime();
const money = readMoney();
const chatSuffix = readChatSuffix();
const last = {};
const count = {};

bot.on("pre_checkout_query", async (query) => {
    if (query.total_amount < PRICE * 100) {
        bot.answerPreCheckoutQuery(query.id, false, {
            error_message: "Please update invoice using /payment command 😊",
        });
        return;
    }
    console.log("Checkout from ", query.from);
    bot.answerPreCheckoutQuery(query.id, true);
});

const botUsername = 'LemonGPT_Bot';
function hasBotMention(msg, botUsername) {
    if (!msg.entities) {
        return false;
    }

    const mentionEntities = msg.entities.filter(
        (entity) => entity.type === 'mention' || entity.type === 'text_mention'
    );

    const result = mentionEntities.some((entity) => {
        if (entity.type === 'mention') {
            const username = msg.text.slice(entity.offset + 1, entity.offset + entity.length);
            console.log('Checking mention:', username);
            return username === botUsername;
        } else if (entity.type === 'text_mention') {
            return entity.user.username === botUsername;
        }
        return false;
    });

    if (!result) {
        // Check if the message contains the bot username without a command
        const botUsernamePattern = new RegExp(`\\b${botUsername}\\b`);
        if (botUsernamePattern.test(msg.text)) {
            return true;
        }
    }
    return result;
}



bot.on("message", async (msg) => {
    try {
        if (protection(msg)) {
            return;
        }
        // Technical stuff
        const chatId = msg.chat.id;
        const msgL = msg.text?.toLowerCase();

        if (msgL) {
            if (msg.chat.type === 'private' || hasBotMention(msg, botUsername)) {
                if (msgL.startsWith('/') || hasBotMention(msg, botUsername)) {
                    const commandProcessed = processCommand(chatId, msgL, msg.from?.language_code);
                    if (commandProcessed) {
                        return;
                    }
                }
            }
        } else {
            return;
        }
                
        
        

        // Brain activity
        context[chatId] = context[chatId]?.slice(-CONTEXT_SIZE * premium(chatId)) ?? "";
        if (time[chatId] && new Date() - new Date(time[chatId]) > CONTEXT_TIMEOUT * 5000) {
            context[chatId] = "";
        }
        time[chatId] = new Date();
        writeTime(time);
        writeContext(context);

        if (!msg.text) {
            return;
        }

        // console.log(chatId, msg?.from?.username, msg.text);

        msg.text = msg.text?.substring(0, MAX_LENGTH * premium(chatId));
        if (msgL.startsWith("погугли") || msgL.startsWith("загугли") || msgL.startsWith("google")) {
            textToGoogle(chatId, msg.text.slice(7), msg.from?.language_code);
        } else {
            if (msgL.startsWith("нарисуй") || msgL.startsWith("draw") || msgL.startsWith("paint")) {
                // visual hemisphere (left)
                textToVisual(chatId, msgL, msg.from?.language_code);
            } else {
                // audio hemisphere (right)
                textToText(chatId, msg);
            }
        }
    } catch (e) {
        console.error(e.message);
    }
});

const processCommand = (chatId, msg, language_code) => {
    if (msg.startsWith("/command") || msg.startsWith("/help")) {
        bot.sendMessage(
            chatId,
            language_code == "ru"
                ? "/support"
                : "/support"
        );
        return true;
    }
    if (msg.startsWith("/start")) {
        bot.sendMessage(
            chatId,
            language_code == "ru"
                ? "Привет! Я ChatGPT бот. Я могу говорить с вами на любом языке. Я могу нарисовать все что вы хотите. Вы также можете отправить мне изображение, и я переведу его в текст. Я могу искать в Google любую информацию, которая вам нужна."
                : "Hello! I'm ChatGPT bot. I can talk to you in any language. I can draw anything you want. You can also send me an image and I will convert it to text. I can search Google for any information you need."
        );
        return true;
    }
    if (msg.startsWith("/support")) {
        bot.sendMessage(
            chatId,
            language_code == "ru"
                ? "Если у вас возникли проблемы, пожалуйста, напишите мне в личные сообщения @ckaap"
                : "If you have any problems, please message me privately @ckaap"
        );
        return true;
    }
    if (msg === "сброс" || msg === "reset") {
        bot.sendMessage(chatId, "Личность уничтожена/Context cleared");
        context[chatId] = "";
        chatSuffix[chatId] = "";
        writeChatSuffix(chatSuffix);
        return true;
    }
    if (msg.startsWith("пропуск ") || msg.startsWith("skip ") || msg.startsWith("отвечать раз в ")) {
        const skipValue = +msg.split(" ")[1];
        skip[chatId] = skipValue;
        writeSkip(skip);
        bot.sendMessage(chatId, "Отвечать раз в " + skipValue + "/Answer every " + skipValue);
        return true;
    }
};


const textToText = async (chatId, msg) => {
    count[chatId] = (count[chatId] ?? 0) + 1;
    context[chatId] += msg.text + ".";
    if (
        !(
            msg.text?.toLowerCase()?.startsWith("отвечай") ||
            msg.text?.toLowerCase()?.startsWith("ответь") ||
            msg.text?.toLowerCase()?.startsWith("answer") ||
            msg.text?.toLowerCase()?.startsWith("через английский")
        ) &&
        count[chatId] % (skip[chatId] ?? 1) != 0
    ) {
        trial[chatId] = trial[chatId] - 1;
        return;
    }
    const english = msg.from?.language_code != "en" && msg.text?.toLowerCase()?.startsWith("через английский");
    if (english) {
        msg.text = msg.text.slice(17);
    }
    bot.sendChatAction(chatId, "typing");
    const intervalId = setInterval(() => {
        bot.sendChatAction(chatId, "typing")
            .then(() => {})
            .catch((e) => {
                console.error(e.message);
            });
    }, 2000);
    let prompt = context[chatId] + chatSuffix[chatId] ?? "";
    if (english) {
        prompt = await translate(msg.text, "en");
    }
    let response;
    if (prompt) {
        response = await getText(
            prompt,
            ((temp[chatId] ?? 36.5) - 36.5) / 10 + 0.5,
            MAX_TOKENS * premium(chatId),
            chatId
        );
    }
    if (english && response) {
        response = await translate(response, msg.from?.language_code);
    }
    clearInterval(intervalId);
    if (response) {
        last[chatId] = response;
        context[chatId] = context[chatId] + response;
    
        // Удаляем старые сообщения, если длина контекста превышает 1000
        if (context[chatId].length > 1000) {
            context[chatId] = context[chatId].slice(-1000);
        }
    
        fs.writeFile("context.json", JSON.stringify(context), () => {});
        bot.sendMessage(chatId, response)
            .then(() => {})
            .catch((e) => {
                console.error(e.message);
            });
    }
};

const textToGoogle = async (chatId, msg, language_code) => {
    bot.sendChatAction(chatId, "typing");
    const response = await google(msg, language_code);
    if (response) {
        last[chatId] = response;
        context[chatId] = context[chatId] + response;
        writeContext(context);
        bot.sendMessage(chatId, response)
            .then(() => {})
            .catch((e) => {
                console.error(e.message);
            });
    }
};

const getText = async (prompt, temperature, max_tokens, chatId) => {
    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: max_tokens,
            temperature: temperature,
        });
        const response = completion?.data?.choices?.[0]?.message?.content;
        const spent = (completion?.data?.usage?.total_tokens / 1000) * OPENAI_PRICE;
        if (spent) {
            money[chatId] = (money[chatId] ?? 0) + spent;
            writeMoney(money);
        }
        // console.log(response);
        return response;
    } catch (e) {
        console.error(e.message);
        // if (e.message?.includes("429")) {
        //     bot.sendMessage(process.env.ADMIN_ID, e.message);
        // }
    }
};


const premium = (chatId) => {
    if (opened[chatId] && chatId > 0) {
        return PREMIUM;
    } else {
        return 1;
    }
};

let callsTimestamps = [];
let groupUsers = {};

// once per hour clean groupUsers
setInterval(() => {
    groupUsers = {};
}, 1000 * 60 * 60);

const protection = (msg) => {
    //if user is admin, allow all and switch on server
    if (msg?.from?.username == process.env.ADMIN || msg?.from?.username == process.env.ADMIN2) {
        var d = new Date();
        d.setMonth(d.getMonth() + 1);
        opened[msg.chat.id] = d;
        writeOpened(opened);
        groupUsers = {};
        return false;
    }

    if (msg?.text?.toLowerCase()?.startsWith("usage")) {
        return true;
    }

    // DDOS protection, call not more than 15 per minute for msg.chat.id
    if (PROMO.includes(String(msg.chat.id))) {
        // if reply, return true
        if (msg?.reply_to_message) {
            return true;
        }

        //if msg contains оежим or сброс, return true
        if (
            msg?.text?.toLowerCase()?.startsWith("режим") ||
            msg?.text?.toLowerCase()?.startsWith("сброс") ||
            msg?.text?.toLowerCase()?.startsWith("пропуск") ||
            msg?.text?.toLowerCase()?.startsWith("mode") ||
            msg?.text?.toLowerCase()?.startsWith("reset") ||
            msg?.text?.toLowerCase()?.startsWith("skip")
        ) {
            return true;
        }

        groupUsers[msg?.from?.id] = (groupUsers[msg?.from?.id] ?? 0) + 1;
        if (groupUsers[msg?.from?.id] > PROMO_MAX_PER_HOUR) {
            return true;
        }

        callsTimestamps.push(Date.now());
        callsTimestamps = callsTimestamps.filter((stamp) => Date.now() - stamp < 60000);
        if (callsTimestamps.length >= PROMO_MAX_PER_MINUTE) {
            console.error("Abuse [1 minute] detected for ", msg.chat.id);
            bot.sendMessage(process.env.ADMIN_ID, "Abuse [1 minute] detected for " + chatId);
            opened[msg.chat.id] = new Date();
            return true;
        }
    }
};

const translate = async (text, target) => {
    try {
        const request = {
            parent: GOOGLE_PROJECT,
            contents: [text],
            mimeType: "text/plain",
            targetLanguageCode: target,
        };

        const [response] = await translation.translateText(request);
        return response.translations[0]?.translatedText;
    } catch (e) {
        console.error(e.message);
    }
};

const getReport = () => {
    let result = "";
    const add = (s) => {
        result += s + "\n";
    };

    add("Operational costs");
    add("------------------");
    const totalMoney = Object.keys(opened)
        .filter((t) => money[t])
        .map((k) => {
            add(k + " " + money[k].toFixed(2) + "$");
            return money[k];
        })
        .reduce((a, b) => a + b);
    add("Total " + totalMoney.toFixed(2) + "$");
    add("");

    add("Profit");
    add("------------------");
    const revenue = Object.keys(opened).length * PRICE;
    add(revenue + "$ - " + totalMoney.toFixed(2) + "$ = " + (revenue - totalMoney).toFixed(2) + "$");

    return result;
};

process.env["NTBA_FIX_350"] = 1;
process.env["NODE_NO_WARNINGS"] = 1;