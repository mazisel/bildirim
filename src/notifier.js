import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const SUPABASE_URL = required('SUPABASE_URL');
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  (() => {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  })();
const TELEGRAM_BOT_TOKEN = required('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = required('TELEGRAM_CHAT_ID');

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    'Supabase service role key kullanılmıyor. RLS aktifse Realtime eventleri gelmeyebilir.'
  );
}

const supabase = createClient(SUPABASE_URL, supabaseKey);
const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

function formatPurchase(row) {
  const lines = [
    'Yeni kredi satışı (currency != BONUS)',
    `Kullanıcı: ${row.user_id}`,
    `Kredi: ${row.credits}`,
    `Fiyat: ${row.price} ${row.currency}`,
    row.purchase_type ? `Tip: ${row.purchase_type}` : null,
    row.status ? `Durum: ${row.status}` : null,
    `ID: ${row.id}`,
    `Tarih: ${row.created_at}`
  ].filter(Boolean);

  if (row.metadata) {
    lines.push(`Metadata: ${JSON.stringify(row.metadata)}`);
  }

  return lines.join('\n');
}

async function sendTelegramMessage(text) {
  const response = await fetch(telegramUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text
    })
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = body.description || response.statusText;
    throw new Error(`Telegram API error: ${reason}`);
  }

  return body;
}

async function sendStartupTest() {
  try {
    await sendTelegramMessage('Supabase ➜ Telegram bildirimi başladı (test mesajı)');
    console.log('Başlangıç test mesajı gönderildi.');
  } catch (error) {
    console.error('Başlangıç test mesajı gönderilemedi:', error.message);
  }
}

async function handleInsert(payload) {
  const { new: row } = payload;

  if (!row) {
    console.warn('Beklenmeyen payload, new row yok:', payload);
    return;
  }

  if (row.currency === 'BONUS') {
    console.log('BONUS kaydı atlandı:', row.id);
    return;
  }

  try {
    console.log('Insert alındı, currency:', row.currency, 'id:', row.id);
    const message = formatPurchase(row);
    await sendTelegramMessage(message);
    console.log('Telegram bildirimi gönderildi:', row.id);
  } catch (error) {
    console.error('Telegram bildirimi gönderilirken hata:', error.message);
  }
}

function startListener() {
  console.log('Supabase Realtime dinleniyor (INSERT, currency != BONUS filtre kodda)...');
  const channel = supabase
    .channel('credit_purchases_telegram')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'credit_purchases'
      },
      handleInsert
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Telegram bildirimi hazır.');
        sendStartupTest();
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('Supabase Realtime kanal hatası, yeniden başlatın.');
      }
      if (status === 'TIMED_OUT') {
        console.error('Supabase Realtime zaman aşımı, yeniden bağlanmayı deneyin.');
      }
    });

  const shutdown = async () => {
    console.log('Kapatılıyor, Supabase kanalından çıkılıyor...');
    await supabase.removeChannel(channel);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

try {
  startListener();
} catch (error) {
  console.error('Başlatılırken hata:', error.message);
  process.exit(1);
}
