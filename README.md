# Supabase ➜ Telegram bildirimci

`credit_purchases` tablosuna `currency != 'BONUS'` olan her yeni kayıt için Telegram mesajı yollar.

## Kurulum
- Gerekli dosyalar: `.env` (aşağıdaki değişkenlerle) ve `node_modules`.
- Ortam değişkenlerini ayarla: `.env.example` dosyasını kopyalayıp doldurun.
  - `SUPABASE_URL`: Supabase projesi.
  - `SUPABASE_SERVICE_ROLE_KEY`: Tercih edilen anahtar (RLS engelini aşar).
  - `SUPABASE_ANON_KEY`: Service key kullanmayacaksanız anon key.
  - `TELEGRAM_BOT_TOKEN`: Bot token.
  - `TELEGRAM_CHAT_ID`: Mesajın gideceği kullanıcı/grup numeric chat id.

### Telegram chat id nasıl alınır?
1. Botunuza `/start` yazın (kendi kullanıcı hesabınızdan).
2. Ardından şu komutu çalıştırın:
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates"
   ```
3. Dönen JSON içinde `message.chat.id` değeri chat id’dir.

## Çalıştırma
```bash
npm install
npm run start
```

Çalışırken `currency=BONUS` olmayan INSERT olaylarını Supabase Realtime ile dinler ve mesaj yollar. Kapatmak için `Ctrl+C`.

## Docker ile çalıştırma
1. `.env` dosyan hazır olsun (veya `--env-file` olmadan `-e KEY=VALUE` kullan).
2. Build:
   ```bash
   docker build -t bildirim-notifier .
   ```
3. Çalıştır:
   ```bash
   docker run --name bildirim-notifier --env-file .env bildirim-notifier
   ```
   Container loglarında “Telegram bildirimi hazır.” ve “Başlangıç test mesajı gönderildi.” satırlarını görmelisin.

## Realtime’i açmayı unutmayın
- Supabase Dashboard → Database → Replication → `credit_purchases` için Realtime yayını açık olsun.
- RLS aktifse: ya service role key kullanın, ya da `anon`/`authenticated` için `SELECT` izni veren politika ekleyin; aksi halde Realtime eventleri gelmez.

## Sorun giderme
- Konsolda `Insert alındı...` logu yoksa: Realtime açık mı, RLS policy var mı, doğru key mi (service key önerilir)?
- Telegram 404/401 görürseniz token’ı doğrulayın, chat id’yi `getUpdates` ile kontrol edin.
