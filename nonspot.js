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
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || '80b22b9b7bmshcd0386192ef8e9ep1356ecjsn690a6092574b'
};

const bot = new Telegraf(CONFIG.BOT_TOKEN);
const userAgreements = new Set();

// --- Интерфейс ---
const getMenu = () => Markup.keyboard([['🎵 Поиск'], ['📊 Статистика', 'ℹ️ Помощь']]).resize();

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>👋 Привет, ${ctx.from.first_name}!</b>\nПринимай правила и погнали.`, 
    Markup.inlineKeyboard([[Markup.button.callback('✅ Принять правила', 'agree')]]));
});

bot.action('agree', (ctx) => {
    userAgreements.add(ctx.from.id);
    ctx.answerCbQuery();
    ctx.reply('Принято! Что хочешь послушать? Просто напиши название или скинь ссылку.', getMenu());
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (!userAgreements.has(userId)) return ctx.reply('⚠️ Нажми /start и прими правила.');
    if (['🎵 Поиск', '📊 Статистика', 'ℹ️ Помощь'].includes(text)) return ctx.reply('Просто отправь название песни!');

    const statusMsg = await ctx.reply('🔍 Ищу...');

    try {
        // 1. Поиск
        const r = await yts(text);
        const video = r.videos[0];
        if (!video) return ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, '❌ Ничего не найдено.');

        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `⏳ Качаю: ${video.title}...`);

        // 2. Запрос к RapidAPI
        const options = {
            method: 'GET',
            url: 'https://youtube-mp310.p.rapidapi.com/download/mp3',
            params: { url: video.url },
            headers: {
                'x-rapidapi-key': CONFIG.RAPIDAPI_KEY,
                'x-rapidapi-host': 'youtube-mp310.p.rapidapi.com'
            }
        };

        const result = await axios.request(options);
        
        // Бывает, что ссылка лежит в разных полях в зависимости от ответа API
        const downloadUrl = result.data.downloadUrl || result.data.url || result.data.link;

        if (downloadUrl) {
            await ctx.replyWithAudio({ url: downloadUrl }, { 
                title: video.title, 
                performer: video.author.name,
                caption: `✅ Готово! Наслаждайся.`
            });
            ctx.deleteMessage(statusMsg.message_id).catch(() => {});
        } else {
            console.log('ОТВЕТ API БЕЗ ССЫЛКИ:', result.data);
            ctx.reply('⚠️ Сервер API сейчас перегружен или не может обработать это видео. Попробуй другое.');
        }

    } catch (e) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА:', e.response ? e.response.data : e.message);
        ctx.reply('❌ Ошибка связи с сервером. Проверь подписку на YouTube MP310 в RapidAPI.');
    }
});

bot.launch().then(() => console.log('🚀 Бот в сети!'));

