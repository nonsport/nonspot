const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const yts = require('yt-search');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG = {
    BOT_TOKEN: '7719507411:AAFZAYH-CQo8l5bOddMX4Zz7Mw85gTcVApo',
    WEATHER_KEY: '347ca3880bea43e6115162fb92126520'
};

const bot = new Telegraf(CONFIG.BOT_TOKEN);

const userAgreements = new Set();
const userLanguages = new Map();
const userStats = new Map();

// Проверка yt-dlp
function checkYtDlp() {
    exec('yt-dlp --version', (error, stdout) => {
        if (error) {
            console.error('❌ yt-dlp не установлен!');
            console.error('Установите: pip install yt-dlp');
        } else {
            console.log(`✅ yt-dlp версия: ${stdout.trim()}`);
        }
    });
}

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
        botInfo: `🎵 *NonSpot Music Bot*\n\n🔍 Просто напиши что хочешь услышать\n\n*Примеры:*\n• Imagine Dragons Believer\n• sad music\n• lofi hip hop`,
        searchMusic: '🎵 Поиск',
        statistics: '📊 Статистика',
        help: 'ℹ️ Помощь',
        helpText: `📚 *Как пользоваться*\n\n• Напиши название песни\n• Или описание: "грустная музыка"\n\n*Примеры:*\nsad music\nImagine Dragons\nlofi hip hop`,
        enterQuery: '🎵 Что ищем?',
        searching: '🔍 Ищу...',
        downloading: '📥 Загрузка',
        sending: '📤 Отправка...',
        canceled: '🚫 Отменено',
        error: '❌ Ошибка. Попробуй другой запрос.',
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
        rulesText: `📜 Terms of Use\n\n1. Bot searches music on YouTube\n2. Files deleted after sending\n\nClick "Accept" to agree.`,
        accept: '✅ Accept',
        decline: '❌ Decline',
        rulesBtn: '📄 Rules',
        acceptRules: '⚠️ Accept terms',
        accessDenied: '❌ Access denied\n\nSend /start',
        botInfo: `🎵 *NonSpot Music Bot*\n\n🔍 Just type what you want to hear\n\n*Examples:*\n• Imagine Dragons Believer\n• sad music\n• lofi hip hop`,
        searchMusic: '🎵 Search',
        statistics: '📊 Stats',
        help: 'ℹ️ Help',
        helpText: `📚 *How to use*\n\n• Type a song name\n• Or description: "sad music"\n\n*Examples:*\nsad music\nImagine Dragons\nlofi hip hop`,
        enterQuery: '🎵 What to search?',
        searching: '🔍 Searching...',
        downloading: '📥 Downloading',
        sending: '📤 Sending...',
        canceled: '🚫 Canceled',
        error: '❌ Error. Try another query.',
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

const languageKB = Markup.inlineKeyboard([
    [Markup.button.callback('🇷🇺 Русский', 'lang_ru')],
    [Markup.button.callback('🇬🇧 English', 'lang_en')]
]);

const getAgreementKB = (userId) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(getText(userId, 'accept'), 'agree_yes'),
         Markup.button.callback(getText(userId, 'decline'), 'agree_no')],
        [Markup.button.callback(getText(userId, 'rulesBtn'), 'show_rules')]
    ]);
};

const getMainMenuInline = (userId) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(getText(userId, 'searchMusic'), 'menu_search')],
        [Markup.button.callback(getText(userId, 'statistics'), 'menu_stats')],
        [Markup.button.callback(getText(userId, 'help'), 'menu_help')]
    ]);
};

const getMainReplyKB = (userId) => {
    return Markup.keyboard([
        [getText(userId, 'searchMusic')],
        [getText(userId, 'statistics'), getText(userId, 'help')]
    ]).resize();
};

const showMainMenu = async (ctx, userId) => {
    await ctx.reply(getText(userId, 'continueSearch'), getMainReplyKB(userId));
    await ctx.reply(getText(userId, 'botInfo'), { parse_mode: 'Markdown', ...getMainMenuInline(userId) });
};

const getCancelKB = (userId) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(getText(userId, 'cancel'), 'action_cancel')]
    ]);
};

const getBackKB = (userId) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(getText(userId, 'back'), 'back_to_menu')]
    ]);
};

const updateStats = (userId, action) => {
    if (!userStats.has(userId)) {
        userStats.set(userId, { searches: 0, downloads: 0 });
    }
    const stats = userStats.get(userId);
    if (action === 'search') stats.searches++;
    if (action === 'download') stats.downloads++;
    userStats.set(userId, stats);
};

bot.start((ctx) => {
    const userId = ctx.from.id;
    if (!userLanguages.has(userId)) {
        return ctx.reply('🌍 Выберите язык:', languageKB);
    }
    if (!userAgreements.has(userId)) {
        return ctx.reply(getText(userId, 'acceptRules'), getAgreementKB(userId));
    }
    ctx.reply(getText(userId, 'welcome'));
    showMainMenu(ctx, userId);
});

bot.action(/lang_(.+)/, async (ctx) => {
    const lang = ctx.match[1];
    const userId = ctx.from.id;
    userLanguages.set(userId, lang);
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply(getText(userId, 'languageSelected'));
    await ctx.reply(getText(userId, 'welcome'));
    await ctx.reply(getText(userId, 'acceptRules'), getAgreementKB(userId));
});

bot.action('show_rules', (ctx) => {
    const userId = ctx.from.id;
    ctx.answerCbQuery();
    ctx.reply(getText(userId, 'rulesText'), getAgreementKB(userId));
});

bot.action('agree_yes', async (ctx) => {
    const userId = ctx.from.id;
    userAgreements.add(userId);
    await ctx.answerCbQuery('✅');
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply(getText(userId, 'welcome'));
    await showMainMenu(ctx, userId);
});

bot.action('agree_no', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply(getText(userId, 'accessDenied'));
});

bot.action('back_to_menu', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
    await showMainMenu(ctx, userId);
});

bot.action('menu_search', (ctx) => {
    const userId = ctx.from.id;
    ctx.answerCbQuery();
    ctx.reply(getText(userId, 'enterQuery'), Markup.removeKeyboard());
});

bot.action('menu_stats', (ctx) => {
    const userId = ctx.from.id;
    ctx.answerCbQuery();
    const stats = userStats.get(userId) || { searches: 0, downloads: 0 };
    ctx.reply(
        `📊 *${getText(userId, 'yourStats')}*\n\n` +
        `🔍 ${getText(userId, 'searches')}: ${stats.searches}\n` +
        `⬇️ ${getText(userId, 'downloads')}: ${stats.downloads}`,
        { parse_mode: 'Markdown', ...getBackKB(userId) }
    );
});

bot.action('menu_help', (ctx) => {
    const userId = ctx.from.id;
    ctx.answerCbQuery();
    ctx.reply(getText(userId, 'helpText'), { parse_mode: 'Markdown', ...getBackKB(userId) });
});

bot.hears(/^(🎵 Поиск|🎵 Search)$/, (ctx) => {
    const userId = ctx.from.id;
    if (!userAgreements.has(userId)) return ctx.reply(getText(userId, 'acceptRules'), getAgreementKB(userId));
    ctx.reply(getText(userId, 'enterQuery'), Markup.removeKeyboard());
});

bot.hears(/^(ℹ️ Помощь|ℹ️ Help)$/, (ctx) => {
    const userId = ctx.from.id;
    if (!userAgreements.has(userId)) return ctx.reply(getText(userId, 'acceptRules'), getAgreementKB(userId));
    ctx.reply(getText(userId, 'helpText'), { parse_mode: 'Markdown', ...getBackKB(userId) });
});

bot.hears(/^(📊 Статистика|📊 Stats)$/, (ctx) => {
    const userId = ctx.from.id;
    if (!userAgreements.has(userId)) return ctx.reply(getText(userId, 'acceptRules'), getAgreementKB(userId));
    const stats = userStats.get(userId) || { searches: 0, downloads: 0 };
    ctx.reply(
        `📊 *${getText(userId, 'yourStats')}*\n\n` +
        `🔍 ${getText(userId, 'searches')}: ${stats.searches}\n` +
        `⬇️ ${getText(userId, 'downloads')}: ${stats.downloads}`,
        { parse_mode: 'Markdown', ...getBackKB(userId) }
    );
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;
    
    if (!userAgreements.has(userId)) {
        return ctx.reply(getText(userId, 'acceptRules'), getAgreementKB(userId));
    }

    const menuButtons = [getText(userId, 'searchMusic'), getText(userId, 'statistics'), getText(userId, 'help')];
    if (menuButtons.includes(text)) return;

    console.log(`🔍 Поиск: "${text}"`);

    const loadingMsg = await ctx.reply(getText(userId, 'searching'), getCancelKB(userId)).catch(() => {});
    if (!loadingMsg) return;

    try {
        // Поиск трека
        const r = await yts(text);
        const track = r.videos[0];
        
        if (!track) {
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
            await ctx.reply(getText(userId, 'notFound'));
            return showMainMenu(ctx, userId);
        }

        console.log(`✅ Найден трек: ${track.title}`);

        const filePath = path.join(os.tmpdir(), `${Date.now()}.mp3`);
        
        // Простая команда без лишних флагов
        const cmd = `yt-dlp -f "ba" -x --audio-format mp3 --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --extractor-retries 3 --retries 3 -o "${filePath}" "https://youtu.be/${track.videoId}"`;

        console.log(`📥 Загрузка: ${track.videoId}`);

        const child = exec(cmd, { timeout: 120000 });

        child.on('exit', async (code) => {
            if (code !== 0 || !fs.existsSync(filePath)) {
                console.error(`❌ Ошибка загрузки, код: ${code}`);
                await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
                await ctx.reply(getText(userId, 'error'));
                return showMainMenu(ctx, userId);
            }

            try {
                await ctx.telegram.editMessageText(
                    ctx.chat.id, loadingMsg.message_id, null,
                    getText(userId, 'sending')
                ).catch(() => {});

                updateStats(userId, 'search');
                updateStats(userId, 'download');
                
                const lang = userLanguages.get(userId) || 'ru';
                const fromText = translations[lang].from;

                await ctx.replyWithAudio(
                    { source: filePath },
                    {
                        title: track.title,
                        performer: track.author.name,
                        caption: `🎵 ${track.title} ${fromText} NonSpot\n👤 ${track.author.name}\n⏱ ${track.timestamp}`
                    }
                );

                await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
                await ctx.reply(getText(userId, 'ready'));
                await showMainMenu(ctx, userId);

            } catch (e) {
                console.error('Send error:', e);
                await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
                await ctx.reply(getText(userId, 'error'));
                return showMainMenu(ctx, userId);
            } finally {
                if (fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch(e) {}
                }
            }
        });

    } catch (e) {
        console.error('Search error:', e);
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
        await ctx.reply(getText(userId, 'error'));
        return showMainMenu(ctx, userId);
    }
});

bot.action('action_cancel', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply(getText(userId, 'canceled'));
    await showMainMenu(ctx, userId);
    await ctx.answerCbQuery();
});

checkYtDlp();
bot.launch().then(() => {
    console.log('🚀 Бот запущен');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
