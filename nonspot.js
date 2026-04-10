const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const yts = require('yt-search');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// Health check для Railway
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
}).listen(process.env.PORT || 3000);

const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    WEATHER_KEY: process.env.WEATHER_KEY
};

if (!CONFIG.BOT_TOKEN) {
    console.error("❌ BOT_TOKEN не найден в Variables!");
    process.exit(1);
}

const bot = new Telegraf(CONFIG.BOT_TOKEN);
const userAgreements = new Set();
const userLanguages = new Map();
const userStats = new Map();

const translations = {
    ru: {
        welcome: '👋 Добро пожаловать в NonSpot Music Bot',
        chooseLanguage: '🌍 Выберите язык:',
        languageSelected: '✅ Язык: Русский',
        rulesText: `📜 Правила использования\n\n1. Бот ищет музыку в YouTube\n2. Файлы удаляются сразу после отправки\n\nНажимая "Принять", вы соглашаетесь с правилами.`,
        accept: '✅ Принять',
        decline: '❌ Отказаться',
        rulesBtn: '📄 Правила',
        acceptRules: '⚠️ Примите правила',
        accessDenied: '❌ Доступ запрещен\n\nОтправьте /start',
        botInfo: `🎵 *NonSpot Music Bot*\n\n🔍 Просто напиши что хочешь услышать\n\n*Примеры:*\n• Imagine Dragons Believer\n• lofi hip hop`,
        searchMusic: '🎵 Поиск',
        statistics: '📊 Статистика',
        help: 'ℹ️ Помощь',
        helpText: `📚 *Как пользоваться*\n\n• Напиши название песни\n• Или описание: "грустная музыка"`,
        enterQuery: '🎵 Что ищем?',
        searching: '🔍 Ищу...',
        downloading: '📥 Загрузка',
        sending: '📤 Отправка...',
        canceled: '🚫 Отменено',
        error: '❌ Ошибка загрузки. Попробуй другой запрос.',
        notFound: '❌ Ничего не найдено',
        ready: '✅ Готово',
        continueSearch: '👇 Продолжить поиск:',
        yourStats: '📊 Ваша статистика',
        searches: '🔍 Поисков',
        downloads: '⬇️ Загрузок',
        from: 'из',
        cancel: '❌ Отменить',
        back: '🔙 Назад'
    },
    en: {
        welcome: '👋 Welcome to NonSpot Music Bot',
        chooseLanguage: '🌍 Choose language:',
        languageSelected: '✅ Language: English',
        rulesText: `📜 Terms of Use\n\n1. Bot searches music on YouTube\n2. Files deleted after sending`,
        accept: '✅ Accept',
        decline: '❌ Decline',
        rulesBtn: '📄 Rules',
        acceptRules: '⚠️ Accept terms',
        accessDenied: '❌ Access denied',
        botInfo: `🎵 *NonSpot Music Bot*\n\n🔍 Just type what you want to hear`,
        searchMusic: '🎵 Search',
        statistics: '📊 Stats',
        help: 'ℹ️ Help',
        helpText: `📚 *How to use*\n\n• Type a song name\n• Or description: "sad music"`,
        enterQuery: '🎵 What to search?',
        searching: '🔍 Searching...',
        downloading: '📥 Downloading',
        sending: '📤 Sending...',
        canceled: '🚫 Canceled',
        error: '❌ Download error. Try another query.',
        notFound: '❌ Nothing found',
        ready: '✅ Done',
        continueSearch: '👇 Continue search:',
        yourStats: '📊 Your statistics',
        searches: '🔍 Searches',
        downloads: '⬇️ Downloads',
        from: 'from',
        cancel: '❌ Cancel',
        back: '🔙 Back'
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
    const replyKB = Markup.keyboard([[getText(userId, 'searchMusic')], [getText(userId, 'statistics'), getText(userId, 'help')]]).resize();
    const inlineKB = Markup.inlineKeyboard([
        [Markup.button.callback(getText(userId, 'searchMusic'), 'menu_search')],
        [Markup.button.callback(getText(userId, 'statistics'), 'menu_stats')],
        [Markup.button.callback(getText(userId, 'help'), 'menu_help')]
    ]);
    await ctx.reply(getText(userId, 'continueSearch'), replyKB);
    await ctx.reply(getText(userId, 'botInfo'), { parse_mode: 'Markdown', ...inlineKB });
};

// --- Команды ---

bot.start((ctx) => {
    const userId = ctx.from.id;
    const kb = Markup.inlineKeyboard([[Markup.button.callback('🇷🇺 Русский', 'lang_ru')], [Markup.button.callback('🇬🇧 English', 'lang_en')]]);
    ctx.reply('🌍 Выберите язык / Choose language:', kb);
});

bot.action(/lang_(.+)/, async (ctx) => {
    const lang = ctx.match[1];
    const userId = ctx.from.id;
    userLanguages.set(userId, lang);
    await ctx.answerCbQuery();
    const agreeKB = Markup.inlineKeyboard([
        [Markup.button.callback(getText(userId, 'accept'), 'agree_yes'), Markup.button.callback(getText(userId, 'decline'), 'agree_no')],
        [Markup.button.callback(getText(userId, 'rulesBtn'), 'show_rules')]
    ]);
    await ctx.reply(getText(userId, 'rulesText'), agreeKB);
});

bot.action('agree_yes', async (ctx) => {
    const userId = ctx.from.id;
    userAgreements.add(userId);
    await ctx.answerCbQuery();
    await showMainMenu(ctx, userId);
});

bot.action('menu_stats', (ctx) => {
    const userId = ctx.from.id;
    const stats = userStats.get(userId) || { searches: 0, downloads: 0 };
    ctx.reply(`📊 *${getText(userId, 'yourStats')}*\n\n🔍 ${getText(userId, 'searches')}: ${stats.searches}\n⬇️ ${getText(userId, 'downloads')}: ${stats.downloads}`, { parse_mode: 'Markdown' });
    ctx.answerCbQuery();
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (!userAgreements.has(userId)) return ctx.reply('⚠️ Сначала /start');
    if ([getText(userId, 'searchMusic'), getText(userId, 'statistics'), getText(userId, 'help'), '🎵 Поиск', '📊 Статистика', 'ℹ️ Помощь'].includes(text)) {
        if (text.includes('Статистика') || text.includes('Stats')) {
            const stats = userStats.get(userId) || { searches: 0, downloads: 0 };
            return ctx.reply(`📊 ${stats.searches} | ⬇️ ${stats.downloads}`);
        }
        return ctx.reply(getText(userId, 'enterQuery'), Markup.removeKeyboard());
    }

    const loadingMsg = await ctx.reply(getText(userId, 'searching'));

    try {
        const r = await yts(text);
        const track = r.videos[0];
        if (!track) return ctx.reply(getText(userId, 'notFound'));

        const filePath = path.join(os.tmpdir(), `${Date.now()}.mp3`);
        const cmd = `yt-dlp -f "ba" -x --audio-format mp3 --no-check-certificates --geo-bypass --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -o "${filePath}" "https://www.youtube.com/watch?v=${track.videoId}"`;

        // ПРАВИЛЬНЫЙ ПОРЯДОК:
        const child = exec(cmd, { timeout: 120000 });

        child.stderr.on('data', (data) => {
            console.error(`yt-dlp: ${data}`);
        });

        child.on('exit', async (code) => {
            if (code !== 0 || !fs.existsSync(filePath)) {
                await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
                return ctx.reply(getText(userId, 'error'));
            }

            try {
                updateStats(userId, 'search');
                updateStats(userId, 'download');
                
                await ctx.replyWithAudio({ source: filePath }, {
                    title: track.title,
                    performer: track.author.name,
                    caption: `🎵 ${track.title} ${getText(userId, 'from')} NonSpot`
                });
                await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
            } catch (e) {
                console.error('Send error:', e);
            } finally {
                if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch(e) {}
            }
        });

    } catch (e) {
        console.error('Global error:', e);
        ctx.reply(getText(userId, 'error'));
    }
});

bot.launch().then(() => console.log('🚀 Бот успешно запущен на Railway'));

