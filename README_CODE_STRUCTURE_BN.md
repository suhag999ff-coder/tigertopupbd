# TIGER TOPUP PRO — আলাদা HTML, CSS, JavaScript

## ফোল্ডার কাঠামো
- `public/index.html` — User Panel-এর HTML structure
- `public/assets/css/user.css` — User Panel-এর CSS
- `public/assets/js/user.js` — User Panel-এর JavaScript
- `public/admin.html` — Admin Panel-এর HTML structure
- `public/assets/css/admin.css` — Admin Panel-এর CSS
- `public/assets/js/admin.js` — Admin Panel-এর JavaScript
- `functions/index.js` — Telegram notification এবং protected server-side API
- `functions/package.json` — Cloud Functions dependencies
- `firebase.json` — Hosting ও API rewrite configuration

## গুরুত্বপূর্ণ নিরাপত্তা কথা
HTML/CSS/JavaScript আলাদা করলে কোড গুছানো থাকে, কিন্তু website-এর browser-এ পাঠানো frontend file visitor DevTools/Network থেকে দেখতে বা download করতে পারে। Minify/obfuscate করলেও সেটি পুরোপুরি আটকানো যায় না। তাই Bot Token, private API key, admin secret, payment verification বা balance পরিবর্তনের নিয়ম কখনো frontend JavaScript-এ রাখবেন না। এগুলো server-side Cloud Functions-এ রাখুন; Firestore Rules-এ সঠিক permission দিন। Firebase web config সাধারণত secret নয়—আসল সুরক্ষা Rules ও server-side authorization।

এই build-এ Telegram bot token backend-এ encrypted রাখার design রাখা হয়েছে। User/admin frontend-এর বিদ্যমান Firebase client logic-এর সব business rule server-side-এ migrate করা হয়নি; real-money চালুর আগে balance/order/deposit mutation server-side-এ নিয়ে যেতে হবে।

## Deploy
আগের `README_BN.md` এবং `DEPLOY_CHECKLIST.txt`-এর Firebase setup/deploy steps অনুসরণ করুন। Deploy করার আগে নিজের project-এ test করুন।
