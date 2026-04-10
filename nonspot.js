const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const yts = require('yt-search');
const http = require('http');

// Health check для Railway (чтобы сервер не засыпал)
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
}).listen(process.env.PORT || 3000);

const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY // Убедись, что в Railway переменная называется именно так
};

if (!CONFIG.BOT_TOKEN || !CONFIG.RAPIDAPI_KEY) {
    console.error("❌ ОШИБКА: Проверьте переменные BOT_TOKEN и RAPIDAPI_KEY в Railway!");
    process.exit(1);
}

const bot = new Telegraf(CONFIG.BOT_TOKEN);
const userAgreements = new Set();
const userLanguages = new Map();
const userStats = new Map();

const translations = {
    ru: {
        welcome: '👋 Добро пожаловать в NonSpot Music Bot',
        rulesText: `📜 *Правила использования*\n\n1. Бот ищет музыку через YouTube.\n2. Используется высокоскоростное API.\n\nНажимая "Принять", вы соглашаетесь с правилами.`,
        accept: '✅ Принять',
        decline: '❌ Отказаться',
        rulesBtn: '📄 Правила',
        botInfo: `🎵 *NonSpot Music Bot*\n\n🔍 Напиши название песни или исполнителя.\nЯ найду лучшее совпадение и пришлю аудио.`,
        searchMusic: '🎵 Поиск',
        statistics: '📊 Статистика',
        help: 'ℹ️ Помощь',
        helpText: `📚 *Как пользоваться*\n\nПросто отправь мне текст, например: \n_"Miyagi Fire"_`,
        enterQuery: '🎵 Что ищем? Введи название:',
        searching: '🔍 Ищу в YouTube...',
        downloading: '📥 Подготовка аудио...',
        sending: '📤 Отправка в Telegram...',
        error: '❌ Ошибка. Видео недоступно или лимит API исчерпан.',
        notFound: '❌ Ничего не найдено.',
        yourStats: '📊 Ваша статистика',
        searches: 'Поисков',
        downloads: 'Загрузок',
        from: 'через'
    },
    en: {
        welcome: '👋 Welcome to NonSpot Music Bot',
        rulesText: `📜 *Terms of Use*\n\n1. Bot searches music via YouTube.\n2. High-speed API is used.`,
        accept: '✅ Accept',
        decline: '❌ Decline',
        rulesBtn: '📄 Rules',
        botInfo: `🎵 *NonSpot Music Bot*\n\n🔍 Type a song name or artist.`,
        searchMusic: '🎵 Search',
        statistics: '📊 Stats',
        help: 'ℹ️ Help',
        helpText: `📚 *How to use*\n\nJust send me a text, for example: \n_"Interstellar theme"_`,
        enterQuery: '🎵 What to search?',
        searching: '🔍 Searching YouTube...',
        downloading: '📥 Preparing audio...',
        sending: '📤 Sending to Telegram...',
        error: '❌ Error. Video unavailable or API limit reached.',
        notFound: '❌ Nothing found.',
        yourStats: '📊 Your statistics',
        searches: 'Searches',
        downloads: 'Downloads',
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

const showMainMenu = async (ctx, userId) => {
    const replyKB = Markup.keyboard([
        [getText(userId, 'searchMusic')],
        [getText(userId, 'statistics'), getText(userId, 'help')]
    ]).resize();
    
    await ctx.reply(getText(userId, 'welcome'), replyKB);
    await ctx.replyWithMarkdown(getText(userId, 'botInfo'));
};

// --- Команды ---

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
    await showMainMenu(ctx, userId);
});

bot.action('agree_no', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('❌ Доступ ограничен без принятия правил.');
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (!userAgreements.has(userId)) return ctx.reply('⚠️ Сначала /start');

    // Кнопки меню
    if (text.includes('Статистика') || text.includes('Stats')) {
        const stats = userStats.get(userId) || { searches: 0, downloads: 0 };
        return ctx.replyWithMarkdown(`📊 *${getText(userId, 'yourStats')}*\n\n🔍 ${getText(userId, 'searches')}: ${stats.searches}\n⬇️ ${getText(userId, 'downloads')}: ${stats.downloads}`);
    }
    if (text.includes('Помощь') || text.includes('Help')) {
        return ctx.replyWithMarkdown(getText(userId, 'helpText'));
    }
    if (text.includes('Поиск') || text.includes('Search')) {
        return ctx.reply(getText(userId, 'enterQuery'));
    }

    // ЛОГИКА ПОИСКА И ЗАГРУЗКИ
    const loadingMsg = await ctx.reply(getText(userId, 'searching'));

    try {
        // 1. Поиск видео через yt-search (оставляем твой метод)
        const r = await yts(text);
        const track = r.videos[0];
        if (!track) return ctx.reply(getText(userId, 'notFound'));

        updateStats(userId, 'search');

        // 2. Запрос к RapidAPI вместо yt-dlp
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

        if (!downloadUrl) throw new Error("API returned no link");

        // 3. Отправка аудио
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, getText(userId, 'sending'));

        await ctx.replyWithAudio(
            { url: downloadUrl },
            {
                title: track.title,
                performer: track.author.name,
                caption: `🎵 ${track.title}\n👤 ${track.author.name}\n\n✅ ${getText(userId, 'from')} NonSpot Bot`
            }
        );

        updateStats(userId, 'download');
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    } catch (e) {
        console.error('Download Error:', e.message);
        ctx.reply(getText(userId, 'error'));
        ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
    }
});

bot.launch().then(() => console.log('🚀 Бот запущен на RapidAPI + Railway'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

