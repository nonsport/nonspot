const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const yts = require('yt-search');
const http = require('http');

// Health check для Railway
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
}).listen(process.env.PORT || 3000);

const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY
};

if (!CONFIG.BOT_TOKEN || !CONFIG.RAPIDAPI_KEY) {
    console.error("❌ Переменные BOT_TOKEN или RAPIDAPI_KEY не найдены в Railway!");
    process.exit(1);
}

const bot = new Telegraf(CONFIG.BOT_TOKEN);
const userAgreements = new Set();
const userLanguages = new Map();
const userStats = new Map();

const translations = {
    ru: {
        welcome: '👋 Добро пожаловать в NonSpot Music Bot',
        rulesText: `📜 *Правила использования*\n\n1. Бот ищет музыку через YouTube.\n2. Мы используем прямое API для быстрой загрузки.`,
        accept: '✅ Принять',
        decline: '❌ Отказаться',
        botInfo: `🎵 *NonSpot Music Bot*\n\n🔍 Просто напиши название песни.`,
        searchMusic: '🎵 Поиск',
        statistics: '📊 Статистика',
        help: 'ℹ️ Помощь',
        enterQuery: '🎵 Что ищем? Введи название:',
        searching: '🔍 Ищу в YouTube...',
        downloading: '📥 Подготовка MP3...',
        sending: '📤 Отправка...',
        error: '❌ Ошибка. Попробуй другое видео или проверь RapidAPI.',
        notFound: '❌ Ничего не найдено',
        from: 'через'
    },
    en: {
        welcome: '👋 Welcome to NonSpot Music Bot',
        rulesText: `📜 *Terms of Use*\n\n1. Bot searches music via YouTube.\n2. Fast API is used for downloading.`,
        accept: '✅ Accept',
        decline: '❌ Decline',
        botInfo: `🎵 *NonSpot Music Bot*\n\n🔍 Just type a song name.`,
        searchMusic: '🎵 Search',
        statistics: '📊 Stats',
        help: 'ℹ️ Help',
        enterQuery: '🎵 What to search?',
        searching: '🔍 Searching YouTube...',
        downloading: '📥 Preparing MP3...',
        sending: '📤 Sending...',
        error: '❌ Error. Try another video.',
        notFound: '❌ Nothing found',
        from: 'via'
    }
};

const getText = (userId, key) => {
    const lang = userLanguages.get(userId) || 'ru';
    return translations[lang][key] || translations.ru[key];
};

const updateStats = (userId, action) => {
    if (!userStats.has(userId)) userStats.set(userId, { searches: 0, downloads: 0 });
    const stats = userStats.get(userId);
    if (action === 'search') stats.searches++;
    if (action === 'download') stats.downloads++;
    userStats.set(userId, stats);
};

bot.start((ctx) => {
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('🇷🇺 Русский', 'lang_ru')],
        [Markup.button.callback('🇬🇧 English', 'lang_en')]
    ]);
    ctx.reply('🌍 Выберите язык / Choose language:', kb);
});

bot.action(/lang_(.+)/, async (ctx) => {
    const lang = ctx.match[1];
    const userId = ctx.from.id;
    userLanguages.set(userId, lang);
    await ctx.answerCbQuery();
    const agreeKB = Markup.inlineKeyboard([
        [Markup.button.callback(getText(userId, 'accept'), 'agree_yes'), Markup.button.callback(getText(userId, 'decline'), 'agree_no')]
    ]);
    await ctx.replyWithMarkdown(getText(userId, 'rulesText'), agreeKB);
});

bot.action('agree_yes', async (ctx) => {
    const userId = ctx.from.id;
    userAgreements.add(userId);
    await ctx.answerCbQuery();
    const replyKB = Markup.keyboard([[getText(userId, 'searchMusic')], [getText(userId, 'statistics'), getText(userId, 'help')]]).resize();
    await ctx.reply(getText(userId, 'welcome'), replyKB);
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (!userAgreements.has(userId)) return ctx.reply('⚠️ Сначала /start');

    if (text.includes('Статистика') || text.includes('Stats')) {
        const stats = userStats.get(userId) || { searches: 0, downloads: 0 };
        return ctx.reply(`📊 Поисков: ${stats.searches} | Загрузок: ${stats.downloads}`);
    }

    const loadingMsg = await ctx.reply(getText(userId, 'searching'));

    try {
        const r = await yts(text);
        const track = r.videos[0];
        if (!track) return ctx.reply(getText(userId, 'notFound'));

        updateStats(userId, 'search');
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, getText(userId, 'downloading'));

        const options = {
            method: 'GET',
            url: 'https://youtube-mp310.p.rapidapi.com/download/mp3',
            params: { url: track.url },
            headers: {
                'x-rapidapi-key': CONFIG.RAPIDAPI_KEY,
                'x-rapidapi-host': 'youtube-mp310.p.rapidapi.com'
            }
        };

        const response = await axios.request(options);
        const downloadUrl = response.data.downloadUrl || response.data.url;

        if (downloadUrl) {
            await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, getText(userId, 'sending'));
            await ctx.replyWithAudio({ url: downloadUrl }, {
                title: track.title,
                performer: track.author.name,
                caption: `🎵 ${track.title} ${getText(userId, 'from')} NonSpot`
            });
            updateStats(userId, 'download');
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
        } else {
            throw new Error("No link");
        }
    } catch (e) {
        ctx.reply(getText(userId, 'error'));
        ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
    }
});

bot.launch().then(() => console.log('🚀 Бот запущен!'));

