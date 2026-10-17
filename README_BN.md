# TIGER TOPUP PRO — Bangla Setup Guide

এই ZIP-এ আপনার দেওয়া User Panel (`public/index.html`) এবং Admin Panel (`public/admin.html`) base হিসেবে রাখা হয়েছে। Admin Panel-এ Telegram Dual Alerts যোগ করা হয়েছে এবং Bot Token backend-এ AES-256-GCM দিয়ে encrypt করে রাখা হয়। User browser থেকে Telegram Bot Token পড়তে পারে না।

## কী কী আছে
- User panel: আপনার দেওয়া TIGER TOPUP user-side UI ও Firebase integration
- Admin panel: আপনার দেওয়া admin UI, user/deposit/order/game management এবং নতুন Telegram Dual Alerts card
- Telegram settings: Bot Token, Admin Chat ID 1, Group/Channel Chat ID 2, Save, Test 1, Test 2
- Auto notifications: নতুন `users/{uid}`, `orders/{orderId}`, `deposits/{depositId}` document তৈরি হলে দুই Chat ID-তে notification
- Firebase Cloud Functions backend; Telegram token client-side JavaScript-এ রাখা হয় না

## 1. Firebase ও Admin setup
1. Firebase Console-এ project `tiger-topup-a5a57` খুলুন। অন্য project ব্যবহার করলে `.firebaserc`-এর project ID পরিবর্তন করুন।
2. Authentication → Sign-in method-এ Email/Password চালু করুন।
3. Authentication → Users থেকে আপনার Admin user তৈরি করুন/UID কপি করুন।
4. Firestore-এ `admins` collection তৈরি করে Document ID হিসেবে ওই Admin UID দিন। Fields: `enabled` = boolean `true`, `active` = boolean `true` (দুটির একটি true হলেই এই code Admin হিসেবে গ্রহণ করবে), `role` = string `super_admin`।
5. আপনার existing Firestore Rules আগে backup নিন। `firestore.rules.example` একটি starting template—এটি blind copy/deploy করবেন না। বর্তমান User Panel client-side balance update করে; template-এর profile-only update rule দিলে সেই balance update/order flow fail করতে পারে। Real money চালুর আগে balance/order approval Cloud Functions-এ migrate করা জরুরি।

## 2. Telegram Bot তৈরি
1. Telegram-এ `@BotFather` খুলে `/newbot` দিয়ে Bot তৈরি করুন।
2. BotFather থেকে পাওয়া Bot Token কপি করুন। Token কাউকে পাঠাবেন না এবং source HTML/JS-এ বসাবেন না।
3. Admin Chat ID বের করতে Bot-কে private-এ `/start` দিন; Telegram bot updates/API ব্যবহার করে Chat ID দেখুন।
4. Group/Channel-এর জন্য bot-কে group-এ যোগ করুন; channel হলে প্রয়োজনীয় post permission দিন। Group Chat ID সাধারণত `-100...` দিয়ে শুরু হতে পারে।
5. Admin Panel → Settings → General Settings → Telegram Dual Alerts-এ Token ও Chat ID দিন। Save, Test 1, Test 2 ব্যবহার করুন। Token আগে save করা থাকলে শুধু Chat ID বদলাতে Bot Token field ফাঁকা রাখুন।

## 3. Cloud Functions deploy (Telegram-এর জন্য দরকার)
কম্পিউটার/টার্মিনালে Node.js 20 ও Firebase CLI লাগবে। Firebase Functions deploy করতে project-এ billing/Blaze enable করতে হতে পারে; usage free quota-র মধ্যে থাকলেও billing account চাইতে পারে।

```bash
npm install -g firebase-tools
firebase login
firebase use tiger-topup-a5a57
cd functions
npm install
cd ..
```

একটি 32-byte encryption key তৈরি করুন (Linux/macOS/Git Bash):

```bash
openssl rand -hex 32
```

তারপর command চালিয়ে output key secret হিসেবে দিন:

```bash
firebase functions:secrets:set TELEGRAM_ENCRYPTION_KEY
```

CLI prompt-এ `openssl rand -hex 32` থেকে পাওয়া 64-character hex key paste করুন। Key-টি chat/source code-এ রাখবেন না। এরপর:

```bash
firebase deploy --only functions,hosting
```

Functions চালু হওয়ার পর Admin Panel থেকে Telegram settings save করুন। Secret তৈরি না করলে Telegram settings save/test ও event notifications কাজ করবে না।

## 4. Hosting
- User website: `/` বা `/index.html`
- Admin panel: `/admin.html`
- Telegram admin API: `/api/telegram/admin` (Firebase Hosting rewrite দিয়ে Cloud Function-এ যাবে)

## গুরুত্বপূর্ণ Security Notes
- Bot Token `privateSettings/telegram`-এ encrypted data হিসেবে থাকে; encryption key Firebase Secret Manager-এ থাকে।
- `admins/{uid}`-এ `enabled:true` বা `active:true` না থাকলে Admin Panel access বন্ধ হবে।
- Telegram alerts কেবল নতুন Firestore documents তৈরি হওয়ার event-এ পাঠানো হয়। আগে থেকে থাকা document-এ notification যাবে না।
- User Panel-এর existing wallet/balance/order logic client-side; browser tampering ঠেকাতে এটি production money flow হিসেবে নিরাপদ নয়। বাস্তব পেমেন্ট নেওয়ার আগে server-side transaction ও strict Firestore Rules দরকার।
- ZIP-এর code syntax-check করা হয়েছে, কিন্তু live Firebase project credentials/permissions এবং real Telegram chats-এ deployment test করা হয়নি।
