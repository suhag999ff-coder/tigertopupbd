const firebaseConfig = {
  apiKey: "AIzaSyCToUghMTET8xXEhKZlZOgrVCc46kg6FJU",
  authDomain: "tiger-topup-a5a57.firebaseapp.com",
  databaseURL: "https://tiger-topup-a5a57-default-rtdb.firebaseio.com",
  projectId: "tiger-topup-a5a57",
  storageBucket: "tiger-topup-a5a57.firebasestorage.app",
  messagingSenderId: "625064331537",
  appId: "1:625064331537:web:f91cb3e00ff6187a52a4b0"
};

const DEFAULT_METHOD_LOGO = {
  bkash: "https://i.ibb.co.com/9kCCTNsx/1656227518bkash-logo-png.png",
  nagad: "https://i.ibb.co.com/VcqJTvpn/Nagad-Logo-horizontally-og.png",
  rocket: "https://i.ibb.co.com/wFZkNM48/rocket-color-logo-mobile-banking-icon-free-png.png"
};

const METHODS = {
  bkash: { name: "bKash", ussd: "*247#", heroBg: "linear-gradient(135deg,#e2136e,#ff4b8b)", instBg: "linear-gradient(135deg,#d81b60,#e91e63)", verify: "linear-gradient(135deg,#8b0000,#b91c1c)" },
  nagad: { name: "Nagad", ussd: "*167#", heroBg: "linear-gradient(135deg,#ec1c24,#ff5a5a)", instBg: "linear-gradient(135deg,#c81010,#ec1c24)", verify: "linear-gradient(135deg,#8b0000,#b91c1c)" },
  rocket: { name: "Rocket", ussd: "*322#", heroBg: "linear-gradient(135deg,#6638e8,#8b6df0)", instBg: "linear-gradient(135deg,#5b2cc4,#7c3aed)", verify: "linear-gradient(135deg,#4c1d95,#6638e8)" }
};

const DEFAULT_RANKS = [
  { name: "Bronze",       min: 0,       max: 100,       tagline: "Start your journey", color: "#b45309", icon: "fa-medal",  image: "" },
  { name: "Silver",       min: 101,     max: 1000,      tagline: "Keep grinding",      color: "#64748b", icon: "fa-medal",  image: "" },
  { name: "Gold",         min: 1001,    max: 5000,      tagline: "Shine brighter",     color: "#f59e0b", icon: "fa-crown",  image: "" },
  { name: "Platinum",     min: 5001,    max: 10000,     tagline: "Elite status",       color: "#0891b2", icon: "fa-gem",    image: "" },
  { name: "Diamond",      min: 10001,   max: 25000,     tagline: "Premium glow",       color: "#a855f7", icon: "fa-gem",    image: "" },
  { name: "Heroic",       min: 25001,   max: 50000,     tagline: "Legendary",          color: "#ef4444", icon: "fa-dragon", image: "" },
  { name: "Master",       min: 50001,   max: 100000,    tagline: "Top tier",           color: "#8b5cf6", icon: "fa-crown",  image: "" },
  { name: "Grand Master", min: 100001,  max: 999999999, tagline: "Ultimate",           color: "#eab308", icon: "fa-crown",  image: "" }
];

const INPUT_TYPES = {
  uid: { label: "Player ID / UID", placeholder: "Enter your ID", icon: "fa-id-card", help: "সঠিক UID দিন।" },
  freefire: { label: "Free Fire UID", placeholder: "e.g. 2535040417", icon: "fa-fire", help: "Free Fire এর UID দিন।" },
  pubg: { label: "PUBG Player ID", placeholder: "e.g. 5123456789", icon: "fa-crosshairs", help: "PUBG Player ID দিন।" },
  custom: { label: "Your Information", placeholder: "Enter here", icon: "fa-keyboard", help: "" }
};

let db, auth;
try { if (!firebase.apps.length) firebase.initializeApp(firebaseConfig); db=firebase.firestore(); auth=firebase.auth(); } catch(e){ console.error(e); }

let currentUser=null, userData={};
let userBalance=0, totalSpend=0, weeklySpend=0;
let selectedProduct=null, selectedGameId=null, selectedGameName="";
let selectedPayOption='wallet', selectedPayMethod='bkash';
let allCategories=[], allGames=[], gamesData={};
let paymentNumbers={}, paymentLogos={};
let supportItems=[], supportOpen=false;
let ranksList=[], currentRank=null, nextRank=null;
let listenersStarted=false;
let globalWalletLogo='', globalInstantLogo='';
let addmoneyAmount=0;
let amSelectedMethod='bkash';

const $=(id)=>document.getElementById(id);
const setText=(id,v)=>{const el=$(id); if(el) el.textContent=v;};
const toast=(icon,title)=>Swal.fire({toast:true,icon,title,position:'top',showConfirmButton:false,timer:1700,background:'#fff',color:'#003d2d'});

function lockBodyScroll(){const y=window.scrollY; document.body.style.top=`-${y}px`; document.body.classList.add('modal-open');}
function unlockBodyScroll(){const y=document.body.style.top; document.body.classList.remove('modal-open'); document.body.style.top=''; if(y) window.scrollTo(0,parseInt(y||'0')*-1);}

/* AUTH */
function toggleAuth(v){const l=$('login-form'),r=$('register-form'); if(v==='login'){l.classList.remove('hidden');r.classList.add('hidden');$('btn-login-view').classList.add('on');$('btn-reg-view').classList.remove('on');}else{l.classList.add('hidden');r.classList.remove('hidden');$('btn-reg-view').classList.add('on');$('btn-login-view').classList.remove('on');}}
function togglePass(id,btn){const inp=$(id),i=btn.querySelector('i'); if(inp.type==='password'){inp.type='text';i.classList.replace('fa-eye','fa-eye-slash');}else{inp.type='password';i.classList.replace('fa-eye-slash','fa-eye');}}

function handleRegister(){
  const name=$('reg-name').value.trim(),email=$('reg-email').value.trim(),phone=$('reg-phone').value.trim(),pass=$('reg-pass').value;
  if(!name||!email||!phone||!pass) return Swal.fire({icon:'error',title:'Error',text:'সব ফিল্ড পূরণ করুন',confirmButtonColor:'#006a4e'});
  if(pass.length<6) return Swal.fire({icon:'error',title:'Error',text:'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর',confirmButtonColor:'#006a4e'});
  Swal.showLoading();
  auth.createUserWithEmailAndPassword(email,pass).then(c=>db.collection('users').doc(c.user.uid).set({name,email,phone,balance:0,totalSpend:0,weeklySpend:0,totalOrders:0,supportPin:Math.floor(10000+Math.random()*90000),createdAt:new Date()})).then(()=>Swal.fire({icon:'success',title:'Success',text:'Account Created!',confirmButtonColor:'#006a4e'})).catch(e=>Swal.fire({icon:'error',title:'Error',text:e.message,confirmButtonColor:'#006a4e'}));
}
function handleLogin(){
  const e=$('login-email').value.trim(),p=$('login-pass').value;
  if(!e||!p) return Swal.fire({icon:'warning',title:'Warning',text:'ইমেইল ও পাসওয়ার্ড দিন',confirmButtonColor:'#006a4e'});
  Swal.showLoading();
  auth.signInWithEmailAndPassword(e,p).catch(e=>Swal.fire({icon:'error',title:'Login Failed',text:e.message,confirmButtonColor:'#006a4e'}));
}
function handleLogout(){Swal.fire({title:'Log Out?',icon:'question',showCancelButton:true,confirmButtonText:'Yes',confirmButtonColor:'#006a4e',cancelButtonColor:'#64748b'}).then(r=>{if(r.isConfirmed)auth.signOut().then(()=>location.reload());});}
function hideNotice(){const el=$('notice-bar'); if(el) el.style.display='none';}

/* PROMO */
function showPromo(d){
  if($('promo-img')) $('promo-img').src=d.popupImage;
  setText('promo-title',d.popupTitle||"Special Offer");
  setText('promo-desc',d.popupDesc||"");
  const b=$('promo-btn');
  if(b){ if(d.popupLink){b.href=d.popupLink;b.style.display='flex';} else b.style.display='none'; }
  $('promo-modal').classList.remove('hidden'); lockBodyScroll();
  sessionStorage.setItem('promoShown','1');
}
function closePromo(){$('promo-modal').classList.add('hidden'); unlockBodyScroll();}

function toggleSupport(){const box=$('support-bubbles'),ic=$('support-icon'); supportOpen=!supportOpen; if(supportOpen){box.classList.add('bubbles-open');ic.classList.replace('fa-headset','fa-times');}else{box.classList.remove('bubbles-open');ic.classList.replace('fa-times','fa-headset');}}

function showSec(id){
  document.querySelectorAll('main > section').forEach(s=>s.classList.add('hidden'));
  document.querySelectorAll('.nvi').forEach(n=>n.classList.remove('on'));
  const sec=$(id+'-sec'); if(sec) sec.classList.remove('hidden');
  const btn=$('nav-'+id); if(btn) btn.classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'});
  if(id==='orders') loadMyOrders();
  if(id==='codes') loadMyCodes();
  if(id==='account') computeRank();
  if(id==='addmoney') resetAddMoneyView();
}
function refreshBalance(){toast('success','Balance refreshed');}
function resetAddMoneyView(){$('am-view-1').classList.remove('hidden'); $('am-view-2').classList.add('hidden');}

/* LOGO HELPERS */
function getWalletLogo(){ if(globalWalletLogo && globalWalletLogo.trim()) return globalWalletLogo.trim(); return 'https://placehold.co/200x80/006a4e/ffffff?text=Wallet+Pay'; }
function getInstantLogo(){ if(globalInstantLogo && globalInstantLogo.trim()) return globalInstantLogo.trim(); return 'https://placehold.co/200x80/006a4e/ffffff?text=Instant+Pay'; }
function getMethodLogo(k){ if(paymentLogos[k] && paymentLogos[k].trim()) return paymentLogos[k].trim(); return DEFAULT_METHOD_LOGO[k]; }

function getPkgIcon(name){
  if(!name) return {icon:'fa-gem',color:'#006a4e'};
  const n=name.toLowerCase();
  if(n.includes('diamond')||n.includes('dia')||n.includes('robux')||n.includes('gem')) return {icon:'fa-gem',color:'#006a4e'};
  if(n.includes('uc')) return {icon:'fa-star',color:'#f59e0b'};
  if(n.includes('coin')||n.includes('gold')||n.includes('silver')) return {icon:'fa-coins',color:'#f59e0b'};
  if(n.includes('weekly')||n.includes('week')) return {icon:'fa-calendar-week',color:'#006a4e'};
  if(n.includes('monthly')||n.includes('month')) return {icon:'fa-calendar-days',color:'#00875f'};
  if(n.includes('pass')||n.includes('bp')||n.includes('royal')) return {icon:'fa-ticket',color:'#10b981'};
  if(n.includes('vip')) return {icon:'fa-crown',color:'#f59e0b'};
  return {icon:'fa-gem',color:'#006a4e'};
}

/* TOPUP */
function openTopUpPage(gameId){
  const game=gamesData[gameId]; if(!game) return;
  selectedGameId=gameId; selectedGameName=game.name; selectedProduct=null;
  setText('total-price','0'); setText('topup-balance',userBalance);
  $('game-player-id').value='';
  setText('topup-game-title',game.name); setText('topup-sub-title',game.name);
  $('topup-game-img').src=game.image;

  const cfg=INPUT_TYPES[(game.inputType||'uid').toLowerCase()]||INPUT_TYPES.uid;
  setText('input-field-label',game.inputLabel||cfg.label);
  setText('input-field-help',game.inputHelp||cfg.help);
  const inp=$('game-player-id'); if(inp) inp.placeholder=game.inputPlaceholder||cfg.placeholder;
  if($('input-field-icon')) $('input-field-icon').className='fas '+cfg.icon+' absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs';

  const rulesBox=$('game-rules-box'),rulesList=$('game-rules-text');
  if(game.rules && game.rules.trim()){
    rulesList.innerHTML=game.rules.split('\n').map(x=>x.trim()).filter(Boolean).map(l=>'<div class="rule-item"><div class="rule-bullet"></div><p>'+l+'</p></div>').join('');
    rulesBox.classList.remove('hidden');
  } else rulesBox.classList.add('hidden');

  const gw=(game.walletLogo&&game.walletLogo.trim())?game.walletLogo.trim():getWalletLogo();
  $('wallet-opt-logo').src=gw;
  $('wallet-opt-logo').onerror=function(){this.src='https://placehold.co/200x80/006a4e/ffffff?text=Wallet+Pay';};

  const gi=(game.instantLogo&&game.instantLogo.trim())?game.instantLogo.trim():getInstantLogo();
  $('instant-opt-logo').src=gi;
  $('instant-opt-logo').onerror=function(){this.src='https://placehold.co/200x80/006a4e/ffffff?text=Instant+Pay';};

  selectPayOption('wallet');
  showSec('topup');

  const grid=$('products-grid'),loader=$('product-loader');
  grid.innerHTML=''; loader.classList.remove('hidden');
  db.collection('services').doc(gameId).collection('products').orderBy('price','asc').get()
    .then(snap=>{
      loader.classList.add('hidden');
      if(snap.empty){grid.innerHTML='<div class="col-span-2 text-center text-gray-400 py-8 text-sm">No packages available</div>'; return;}
      const frag=document.createDocumentFragment();
      snap.forEach(doc=>{
        const p=doc.data(); const card=document.createElement('div');
        const inStock=p.stock!==false && p.stock!=='out';
        card.className="pkg-card"+(inStock?'':' out-of-stock');
        const auto=getPkgIcon(p.name);
        let iconHtml;
        if(p.icon && p.icon.trim()){iconHtml='<div class="pkg-icon-box"><img src="'+p.icon+'" onerror="this.outerHTML=\'<i class=&quot;fas '+auto.icon+'&quot; style=&quot;color:'+auto.color+'&quot;></i>\'"></div>';}
        else {iconHtml='<div class="pkg-icon-box"><i class="fas '+auto.icon+'" style="color:'+auto.color+';"></i></div>';}
        card.innerHTML=iconHtml+'<div class="pkg-title">'+(p.name||'-')+'</div><div class="pkg-price">৳ '+p.price+'</div><div class="pkg-stock-pill'+(inStock?'':' out')+'"><i class="fas fa-circle"></i> '+(inStock?'In Stock':'Out')+'</div>';
        if(inStock){card.onclick=()=>selectProduct(card,p,doc.id);}
        else {card.onclick=()=>toast('warning','Stock Out!');}
        frag.appendChild(card);
      });
      grid.appendChild(frag);
    }).catch(err=>{loader.classList.add('hidden'); grid.innerHTML='<div class="col-span-2 text-center text-red-400 py-6 text-xs">'+err.message+'</div>';});
}
function selectProduct(el,prod,id){
  if(prod.stock===false||prod.stock==='out') return toast('warning','Stock Out!');
  document.querySelectorAll('.pkg-card').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');
  selectedProduct={id:id,name:prod.name,price:parseInt(prod.price||0)};
  setText('total-price',selectedProduct.price);
}
function selectPayOption(o){selectedPayOption=o; document.querySelectorAll('.pay-option').forEach(e=>e.classList.remove('on')); const el=$('pay-opt-'+o); if(el) el.classList.add('on');}

function buyNowClick(){
  const pid=$('game-player-id').value.trim();
  if(!pid) return Swal.fire({icon:'warning',title:'Missing',text:'আইডি / তথ্য দিন!',confirmButtonColor:'#006a4e'});
  if(!selectedProduct) return Swal.fire({icon:'warning',title:'Select Package',text:'একটি প্যাকেজ সিলেক্ট করুন!',confirmButtonColor:'#006a4e'});
  if(selectedPayOption==='wallet'){
    if(userBalance<selectedProduct.price){
      return Swal.fire({
        icon:'error',title:'Low Balance',
        html:'ব্যালেন্স: <b>৳'+userBalance+'</b><br>প্রয়োজন: <b>৳'+selectedProduct.price+'</b>',
        showCancelButton:true,confirmButtonText:'Add Money',cancelButtonText:'Cancel',confirmButtonColor:'#006a4e',cancelButtonColor:'#64748b'
      }).then(r=>{if(r.isConfirmed) showSec('addmoney');});
    }
    confirmWalletOrder();
  } else {
    openPaymentPage();
  }
}
function confirmWalletOrder(){
  const pid=$('game-player-id').value.trim();
  Swal.fire({
    title:'Confirm Order?',
    html:'<div style="text-align:left;font-size:13px;line-height:1.9;padding:6px 0"><b>Game:</b> '+selectedGameName+'<br><b>ID:</b> '+pid+'<br><b>Package:</b> '+selectedProduct.name+'<br><b>Price:</b> ৳'+selectedProduct.price+'<br><b>Payment:</b> Wallet</div>',
    icon:'question',showCancelButton:true,confirmButtonColor:'#006a4e',cancelButtonColor:'#64748b',confirmButtonText:'Confirm'
  }).then(res=>{
    if(!res.isConfirmed) return;
    Swal.showLoading();
    const orderData={userId:currentUser.uid,userName:userData.name||currentUser.email,userEmail:currentUser.email,gameId:selectedGameId,gameName:selectedGameName,playerId:pid,productId:selectedProduct.id,productName:selectedProduct.name,price:selectedProduct.price,status:'pending',paymentType:'wallet',paymentMethod:'wallet',trxId:'',date:new Date()};
    const newBal=userBalance-selectedProduct.price;
    const newSpend=totalSpend+selectedProduct.price;
    const newWeekly=weeklySpend+selectedProduct.price;
    const newOrders=(userData.totalOrders||0)+1;
    db.collection('users').doc(currentUser.uid).update({balance:newBal,totalSpend:newSpend,weeklySpend:newWeekly,totalOrders:newOrders})
      .then(()=>db.collection('orders').add(orderData))
      .then(()=>{Swal.fire({icon:'success',title:'Order Placed!',text:'Admin verify করবে।',timer:2200,showConfirmButton:false,confirmButtonColor:'#006a4e'}); showSec('home');})
      .catch(e=>Swal.fire({icon:'error',title:'Error',text:e.message,confirmButtonColor:'#006a4e'}));
  });
}

/* PAYMENT */
function openPaymentPage(){
  setText('pp-amount',selectedProduct.price);
  setText('pp-amount-2',selectedProduct.price);
  renderPpTabs();
  selectPpMethod('bkash');
  showSec('payment');
}
function renderPpTabs(){
  const box=$('pp-method-tabs'); if(!box) return;
  box.innerHTML='';
  ['bkash','nagad','rocket'].forEach(k=>{
    const logo=getMethodLogo(k);
    const btn=document.createElement('div');
    btn.className='method-tab'+(k==='bkash'?' on':'');
    btn.dataset.method=k;
    btn.onclick=()=>selectPpMethod(k);
    btn.innerHTML='<img src="'+logo+'" onerror="this.style.display=\'none\'"><div class="mname">'+METHODS[k].name+'</div>';
    box.appendChild(btn);
  });
}
function selectPpMethod(k){
  selectedPayMethod=k;
  const m=METHODS[k];
  document.querySelectorAll('#pp-method-tabs .method-tab').forEach(t=>t.classList.toggle('on',t.dataset.method===k));
  $('pp-hero-bg').style.background=m.heroBg;
  $('pp-inst-bg').style.background=m.instBg;
  $('pp-verify-btn').style.background=m.verify;
  const logo=getMethodLogo(k);
  $('pp-brand-logo').src=logo;
  $('pp-brand-logo').onerror=function(){this.src=DEFAULT_METHOD_LOGO[k];};
  setText('pp-ussd',m.ussd);
  setText('pp-m1',m.name); setText('pp-m2',m.name);
  setText('pp-number',paymentNumbers[k]||"01XXXXXXXXX");
  $('pp-trx').value='';
}
function copyPpNumber(btn){
  navigator.clipboard.writeText($('pp-number').textContent).then(()=>{
    const orig=btn.innerHTML; btn.innerHTML='<i class="fas fa-check"></i> কপি';
    setTimeout(()=>btn.innerHTML=orig,1200);
  });
}
function submitInstantOrder(){
  const trx=$('pp-trx').value.trim();
  if(!trx) return Swal.fire({icon:'warning',title:'Warning',text:'Transaction ID দিন',confirmButtonColor:'#006a4e'});
  if(trx.length<4) return Swal.fire({icon:'warning',title:'Warning',text:'সঠিক TrxID দিন',confirmButtonColor:'#006a4e'});
  const pid=$('game-player-id').value.trim();
  Swal.fire({
    title:'Confirm Order?',
    html:'<div style="text-align:left;font-size:13px;line-height:1.9;padding:6px 0"><b>Game:</b> '+selectedGameName+'<br><b>ID:</b> '+pid+'<br><b>Package:</b> '+selectedProduct.name+'<br><b>Price:</b> ৳'+selectedProduct.price+'<br><b>Method:</b> '+METHODS[selectedPayMethod].name+'</div>',
    icon:'question',showCancelButton:true,confirmButtonColor:'#006a4e',cancelButtonColor:'#64748b',confirmButtonText:'Confirm'
  }).then(res=>{
    if(!res.isConfirmed) return;
    Swal.showLoading();
    db.collection('orders').add({
      userId:currentUser.uid,userName:userData.name||currentUser.email,userEmail:currentUser.email,
      gameId:selectedGameId,gameName:selectedGameName,playerId:pid,
      productId:selectedProduct.id,productName:selectedProduct.name,price:selectedProduct.price,
      status:'pending',paymentType:'direct',paymentMethod:selectedPayMethod,trxId:trx,date:new Date()
    }).then(()=>{
      Swal.fire({icon:'success',title:'Submitted!',text:'Admin verify করবে।',timer:2400,showConfirmButton:false,confirmButtonColor:'#006a4e'});
      showSec('home');
    }).catch(e=>Swal.fire({icon:'error',title:'Error',text:e.message,confirmButtonColor:'#006a4e'}));
  });
}
function backFromPaymentPage(){showSec('topup');}

/* ADD MONEY */
function quickAmt(a){const i=$('dep-amount'); if(i) i.value=(parseInt(i.value)||0)+a;}
function goToAmountNext(){
  const amt=parseInt($('dep-amount').value);
  if(!amt||amt<10) return Swal.fire({icon:'warning',title:'Warning',text:'সর্বনিম্ন ১০ টাকা দিন',confirmButtonColor:'#006a4e'});
  addmoneyAmount=amt;
  setText('am-amount-show',amt);
  $('am-view-1').classList.add('hidden');
  $('am-view-2').classList.remove('hidden');
  renderAmMethods();
  window.scrollTo({top:0,behavior:'smooth'});
}
function backToAmount(){
  $('am-view-2').classList.add('hidden');
  $('am-view-1').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderAmMethods(){
  const box=$('am-methods-list'); if(!box) return;
  box.innerHTML='';
  ['bkash','nagad','rocket'].forEach((k,i)=>{
    const logo=getMethodLogo(k);
    const div=document.createElement('div');
    div.className='method-row'+(i===0?' on':'');
    div.dataset.method=k;
    div.onclick=()=>openAmPayment(k);
    div.innerHTML='<div class="m-logo"><img src="'+logo+'" onerror="this.src=\''+DEFAULT_METHOD_LOGO[k]+'\'"></div><div class="m-info"><div class="m-name">'+METHODS[k].name+'</div><div class="m-sub">Tap to continue</div></div><div class="m-arrow"><i class="fas fa-chevron-right"></i></div>';
    box.appendChild(div);
  });
}
function openAmPayment(k){
  amSelectedMethod=k;
  setText('ap-amount',addmoneyAmount);
  setText('ap-amount-2',addmoneyAmount);
  renderApTabs();
  selectApMethod(k);
  showSec('am-payment');
}
function renderApTabs(){
  const box=$('ap-method-tabs'); if(!box) return;
  box.innerHTML='';
  ['bkash','nagad','rocket'].forEach(k=>{
    const logo=getMethodLogo(k);
    const btn=document.createElement('div');
    btn.className='method-tab'+(k===amSelectedMethod?' on':'');
    btn.dataset.method=k;
    btn.onclick=()=>selectApMethod(k);
    btn.innerHTML='<img src="'+logo+'" onerror="this.style.display=\'none\'"><div class="mname">'+METHODS[k].name+'</div>';
    box.appendChild(btn);
  });
}
function selectApMethod(k){
  amSelectedMethod=k;
  const m=METHODS[k];
  document.querySelectorAll('#ap-method-tabs .method-tab').forEach(t=>t.classList.toggle('on',t.dataset.method===k));
  $('ap-hero-bg').style.background=m.heroBg;
  $('ap-inst-bg').style.background=m.instBg;
  $('ap-verify-btn').style.background=m.verify;
  const logo=getMethodLogo(k);
  $('ap-brand-logo').src=logo;
  $('ap-brand-logo').onerror=function(){this.src=DEFAULT_METHOD_LOGO[k];};
  setText('ap-ussd',m.ussd);
  setText('ap-m1',m.name);
  setText('ap-number',paymentNumbers[k]||"01XXXXXXXXX");
  $('ap-trx').value='';
}
function copyApNumber(btn){
  navigator.clipboard.writeText($('ap-number').textContent).then(()=>{
    const orig=btn.innerHTML; btn.innerHTML='<i class="fas fa-check"></i> কপি';
    setTimeout(()=>btn.innerHTML=orig,1200);
  });
}
function backFromAmPayment(){showSec('addmoney');}
function submitAddMoney(){
  const sender=$('ap-sender').value.trim();
  const trx=$('ap-trx').value.trim().toUpperCase();
  if(!addmoneyAmount||addmoneyAmount<10) return Swal.fire({icon:'warning',title:'Warning',text:'সর্বনিম্ন ১০ টাকা দিন',confirmButtonColor:'#006a4e'});
  if(!/^01\d{9}$/.test(sender)) return Swal.fire({icon:'warning',title:'Warning',text:'সঠিক ১১ ডিজিটের Sender Number দিন',confirmButtonColor:'#006a4e'});
  if(!trx||trx.length<4) return Swal.fire({icon:'warning',title:'Warning',text:'সঠিক Transaction ID দিন',confirmButtonColor:'#006a4e'});
  Swal.showLoading();
  db.collection('deposits').add({
    userId:currentUser.uid,userEmail:currentUser.email,
    amount:addmoneyAmount,sender:sender,trxId:trx,
    method:METHODS[amSelectedMethod].name,methodKey:amSelectedMethod,
    status:'pending',date:new Date()
  }).then(()=>{
    Swal.fire({icon:'success',title:'Request Submitted!',html:'Admin verify করবে ৫-১০ মিনিটে।',confirmButtonColor:'#006a4e'});
    $('dep-amount').value=''; $('ap-sender').value=''; $('ap-trx').value='';
    showSec('addmoney');
    backToAmount();
  }).catch(e=>Swal.fire({icon:'error',title:'Error',text:e.message,confirmButtonColor:'#006a4e'}));
}
function openHowToVideo(){
  db.collection('settings').doc('general').get().then(d=>{
    const link=d.exists?d.data().howToVideo:null;
    if(link) window.open(link,'_blank');
    else Swal.fire({icon:'info',title:'Info',text:'Video coming soon',confirmButtonColor:'#006a4e'});
  }).catch(()=>Swal.fire({icon:'info',title:'Info',text:'Video coming soon',confirmButtonColor:'#006a4e'}));
}

/* ORDERS */
function loadMyOrders(){
  const list=$('my-orders-list'); if(!list||!currentUser) return;
  list.innerHTML='<div class="text-center py-8"><div class="spinner"></div></div>';
  db.collection('orders').where('userId','==',currentUser.uid).limit(50).get().then(snap=>{
    if(snap.empty){list.innerHTML='<div class="empty-state"><i class="fas fa-shopping-basket"></i><p>No orders yet</p></div>'; return;}
    let arr=[]; snap.forEach(d=>arr.push(Object.assign({id:d.id},d.data())));
    arr.sort((a,b)=>{const da=a.date&&a.date.toDate?a.date.toDate():new Date(a.date||0); const db2=b.date&&b.date.toDate?b.date.toDate():new Date(b.date||0); return db2-da;});
    const frag=document.createDocumentFragment();
    arr.forEach(d=>{
      const st=(d.status||'pending').toLowerCase();
      let s='';
      if(['success','complete','completed'].includes(st)) s='<span class="bdg-done"><i class="fas fa-check-circle"></i> Completed</span>';
      else if(['cancel','canceled','rejected','refunded'].includes(st)) s='<span class="bdg-cancel"><i class="fas fa-times-circle"></i> '+st+'</span>';
      else s='<span class="bdg-pend"><i class="fas fa-clock"></i> Pending</span>';
      let ds='N/A'; if(d.date){const dt=d.date.toDate?d.date.toDate():new Date(d.date); ds=dt.toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});}
      const card=document.createElement('div'); card.className='od-card';
      card.innerHTML='<div class="od-head"><div class="flex items-center gap-2"><i class="fas fa-cube text-[#006a4e]"></i><h4 class="font-black text-[#003d2d] text-sm">Order #'+d.id.slice(-6).toUpperCase()+'</h4></div>'+s+'</div><div class="od-row border-t border-dashed border-gray-200"><span class="lbl"><i class="fas fa-box"></i> Package</span><span class="val">'+(d.productName||'-')+'</span></div><div class="od-row"><span class="lbl"><i class="fas fa-money-bill-wave"></i> Price</span><span class="val">৳'+(d.price||0).toLocaleString()+'</span></div><div class="od-row"><span class="lbl"><i class="fas fa-user"></i> Player ID</span><span class="val font-mono">'+(d.playerId||'-')+'</span></div><div class="od-row"><span class="lbl"><i class="fas fa-calendar"></i> Date</span><span class="val text-[10px]">'+ds+'</span></div>';
      frag.appendChild(card);
    });
    list.innerHTML=''; list.appendChild(frag);
  }).catch(e=>{list.innerHTML='<div class="text-center text-red-500 py-6 text-xs">'+e.message+'</div>';});
}

/* CODES */
function loadMyCodes(){
  const list=$('codes-list'); if(!list||!currentUser) return;
  db.collection('codes').where('usedBy','==',currentUser.uid).get().then(snap=>{
    if(snap.empty){list.innerHTML='<div class="bg-white rounded-3xl border border-gray-100 p-8 text-center shadow-sm"><div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#d1fae5] to-[#a7f3d0] flex items-center justify-center"><i class="fas fa-ticket-alt text-[#006a4e] text-2xl"></i></div><p class="text-lg font-black text-[#003d2d] mb-4">No code data found!</p><button type="button" onclick="showSec(\'home\')" class="bg-gradient-to-r from-[#006a4e] to-[#00875f] text-white px-8 py-3 rounded-full font-bold">ORDER NOW</button></div>'; return;}
    const frag=document.createDocumentFragment();
    snap.forEach(doc=>{const d=doc.data(); const div=document.createElement('div'); div.className='bg-white rounded-2xl border border-gray-100 p-4 mb-3 shadow-sm';
      div.innerHTML='<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500"><i class="fas fa-ticket-alt"></i></div><div class="flex-1 min-w-0"><p class="font-black text-[#003d2d] text-sm font-mono truncate">'+d.code+'</p><p class="text-[10px] text-gray-400">৳'+(d.amount||0)+'</p></div><span class="bdg-done"><i class="fas fa-check-circle text-[10px]"></i> Used</span></div>';
      frag.appendChild(div);});
    list.innerHTML=''; list.appendChild(frag);
  }).catch(()=>{});
}
function openRedeemModal(){$('redeem-modal').classList.remove('hidden'); $('redeem-code').value=''; lockBodyScroll();}
function closeRedeemModal(){$('redeem-modal').classList.add('hidden'); unlockBodyScroll();}
async function redeemCode(){
  const code=$('redeem-code').value.trim().toUpperCase();
  if(!code) return Swal.fire({icon:'warning',title:'Warning',text:'Enter code',confirmButtonColor:'#006a4e'});
  Swal.showLoading();
  try {
    const snap=await db.collection('codes').where('code','==',code).limit(1).get();
    if(snap.empty) return Swal.fire({icon:'error',title:'Invalid',text:'Code not found',confirmButtonColor:'#006a4e'});
    const r=snap.docs[0], data=r.data();
    if(data.used) return Swal.fire({icon:'warning',title:'Used',text:'Already used',confirmButtonColor:'#006a4e'});
    const amt=parseInt(data.amount||0);
    if(amt<=0) return Swal.fire({icon:'error',title:'Error',text:'Invalid amount',confirmButtonColor:'#006a4e'});
    await db.collection('users').doc(currentUser.uid).update({balance:userBalance+amt});
    await r.ref.update({used:true,usedBy:currentUser.uid,usedAt:new Date()});
    Swal.fire({icon:'success',title:'Success!',html:'৳'+amt+' added',confirmButtonColor:'#006a4e'});
    closeRedeemModal(); loadMyCodes();
  } catch(e){Swal.fire({icon:'error',title:'Error',text:e.message,confirmButtonColor:'#006a4e'});}
}

/* RANKS — Topup Buzz Style with image support */
function computeRank(){
  if(!ranksList.length) return;
  let cur=ranksList[0],nxt=null;
  for(let i=0;i<ranksList.length;i++){const r=ranksList[i]; const mn=parseInt(r.min)||0,mx=parseInt(r.max)||999999999; if(totalSpend>=mn&&totalSpend<=mx){cur=r;nxt=ranksList[i+1]||null;break;}}
  currentRank=cur; nextRank=nxt; updateRankUI(); renderRankJourney();
}
function buildRankIconHtml(rank, size, opts){
  if(!rank) return '';
  opts = opts || {};
  size = size || 20;
  const hasImage = rank.image && rank.image.trim();
  const icon = rank.icon || 'fa-medal';
  const color = rank.color || '#006a4e';
  if(hasImage){
    const errHtml = '<i class=&quot;fas '+icon+'&quot; style=&quot;color:'+color+';font-size:'+size+'px&quot;></i>';
    return '<img src="'+rank.image.trim()+'" alt="'+rank.name+'" style="width:100%;height:100%;object-fit:contain;'+(opts.padding?'padding:'+opts.padding+';':'')+'" onerror="this.outerHTML=\''+errHtml+'\'">';
  }
  return '<i class="fas '+icon+'" style="color:'+color+';font-size:'+size+'px"></i>';
}
function updateRankUI(){
  if(!currentRank) return;
  const bw=$('acc-rank-badge-wrap');
  if(bw){
    const iconHtml = (currentRank.image && currentRank.image.trim())
      ? '<img src="'+currentRank.image.trim()+'" style="width:16px;height:16px;object-fit:contain" onerror="this.outerHTML=\'<i class=&quot;fas '+(currentRank.icon||'fa-medal')+'&quot; style=&quot;color:'+currentRank.color+';font-size:11px&quot;></i>\'">'
      : '<i class="fas '+(currentRank.icon||'fa-medal')+'" style="color:'+currentRank.color+';font-size:11px"></i>';
    bw.innerHTML='<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:'+currentRank.color+'20;border:1.5px solid '+currentRank.color+'60">'+iconHtml+'<span style="font-size:10px;font-weight:800;color:'+currentRank.color+'">'+currentRank.name+'</span></span>';
  }
  setText('acc-member-rank',currentRank.name+' Member');
  setText('acc-member-level',ranksList.indexOf(currentRank)+1);
  const ri=$('acc-rank-icon');
  if(ri){
    const hasImg = currentRank.image && currentRank.image.trim();
    ri.style.background = hasImg ? '#fff' : 'linear-gradient(135deg,'+currentRank.color+'30,'+currentRank.color+'60)';
    ri.style.border = '2px solid '+currentRank.color+'60';
    ri.innerHTML = buildRankIconHtml(currentRank, 22, {padding:'3px'});
  }
  setText('acc-rank-name-big',currentRank.name);
  setText('acc-rank-tagline',currentRank.tagline||'');
  const bi=$('acc-rank-icon-big');
  if(bi){
    bi.style.width='100%'; bi.style.height='100%';
    bi.style.display='flex'; bi.style.alignItems='center'; bi.style.justifyContent='center';
    bi.innerHTML = buildRankIconHtml(currentRank, 28, {padding:'3px'});
  }
  setText('acc-rank-range',parseInt(currentRank.min).toLocaleString()+' - '+parseInt(currentRank.max).toLocaleString()+' ৳');
  const mn=parseInt(currentRank.min)||0,mx=parseInt(currentRank.max)||100;
  const pct=Math.min(100,Math.max(0,Math.round(((totalSpend-mn)/Math.max(1,mx-mn))*100)));
  setText('acc-rank-percent',pct+'%');
  const bar=$('acc-rank-progress-bar'); if(bar) bar.style.width=pct+'%';
  if(nextRank){setText('acc-rank-remaining',Math.max(0,parseInt(nextRank.min)-totalSpend).toLocaleString()); setText('acc-rank-next',nextRank.name);}
  else {setText('acc-rank-remaining',0); setText('acc-rank-next','MAX');}
  setText('stat-rank',currentRank.name);
  setText('rank-journey-progress',ranksList.filter(r=>totalSpend>=parseInt(r.min)).length+'/'+ranksList.length);
}
function renderRankJourney(){
  const list=$('rank-journey-list'); if(!list) return;
  const existingLine = list.querySelector('.rank-journey-line');
  list.innerHTML = '';
  if(existingLine) list.appendChild(existingLine);
  else {
    const line = document.createElement('div');
    line.className = 'rank-journey-line';
    list.appendChild(line);
  }
  const frag=document.createDocumentFragment();
  ranksList.forEach(r=>{
    const mn=parseInt(r.min)||0,mx=parseInt(r.max)||0;
    const un=totalSpend>=mn, isc=currentRank&&currentRank.name===r.name;
    let cls='rk-item',st='';
    if(isc){cls+=' current';st='<span class="rk-pill current"><i class="fas fa-check"></i> Current</span>';}
    else if(un){cls+=' unlocked';st='<span class="rk-pill unlocked"><i class="fas fa-check"></i> Unlocked</span>';}
    else {cls+=' locked';st='<span class="rk-pill locked"><i class="fas fa-lock"></i> Locked</span>';}
    const hasImg = r.image && r.image.trim();
    const wrapBg = hasImg ? '#fff' : r.color+'25';
    const wrapBorder = r.color+'70';
    const iconInner = buildRankIconHtml(r, 20, {padding:'3px'});
    const div=document.createElement('div'); div.className=cls;
    div.innerHTML='<div class="rk-icon-wrap" style="background:'+wrapBg+';border-color:'+wrapBorder+'">'+iconInner+'</div><div class="flex-1 min-w-0"><p class="font-extrabold text-[#003d2d] text-sm">'+r.name+'</p><p class="text-[10px] text-gray-500 mt-0.5">'+mn.toLocaleString()+' - '+mx.toLocaleString()+' ৳</p></div>'+st;
    frag.appendChild(div);
  });
  list.appendChild(frag);
}

function renderSupportBubbles(){
  const box=$('support-bubbles'); if(!box) return;
  let items=supportItems;
  if(items.length===0){items=[{name:'WhatsApp',logo:'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',link:'#'},{name:'Telegram',logo:'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg',link:'#'}];}
  const frag=document.createDocumentFragment();
  items.forEach(s=>{
    const a=document.createElement('a'); a.href=s.link||'#'; a.target='_blank'; a.className='bubble-wrap flex items-center gap-2';
    a.innerHTML='<span class="bg-white text-[10px] font-extrabold text-[#003d2d] px-3 py-2 rounded-full shadow-lg border border-green-100 whitespace-nowrap flex items-center gap-1.5">'+s.name+' <i class="fas fa-arrow-up text-[8px]"></i></span><div class="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center border-2 border-green-100"><img src="'+s.logo+'" class="w-7 h-7 object-contain" onerror="this.src=\'https://placehold.co/40?text=?\'"></div>';
    frag.appendChild(a);
  });
  box.innerHTML=''; box.appendChild(frag);
}

function renderCategories(){
  const c=$('categories-container'); if(!c) return;
  const grouped={};
  allGames.forEach(g=>{const cn=(g.category||'Other').trim(); if(!grouped[cn]) grouped[cn]=[]; grouped[cn].push(g);});
  const ordered=[];
  allCategories.forEach(x=>{if(grouped[x.name]){ordered.push({name:x.name,items:grouped[x.name]}); delete grouped[x.name];}});
  Object.keys(grouped).forEach(k=>ordered.push({name:k,items:grouped[k]}));
  if(ordered.length===0){c.innerHTML='<div class="empty-state"><i class="fas fa-gamepad"></i><p>No products available</p></div>'; return;}
  const frag=document.createDocumentFragment();
  ordered.forEach(cat=>{
    const section=document.createElement('div');
    let h='';
    cat.items.forEach(it=>{
      h+='<div onclick="openTopUpPage(\''+it.id+'\')" class="gcard"><div class="relative"><img src="'+it.image+'" class="gimg" onerror="this.src=\'https://placehold.co/200/eaf2ee/006a4e?text=Game\'">'+(it.badge?'<span class="gbadge '+(it.badgeType==='new'?'new':it.badgeType==='hot'?'hot':'')+'">'+it.badge+'</span>':'')+'</div><div class="gname">'+it.name+'</div></div>';
    });
    section.innerHTML='<h2 class="cat-h">'+cat.name+'</h2><div class="grid grid-cols-3 gap-3 pb-2">'+h+'</div>';
    frag.appendChild(section);
  });
  c.innerHTML=''; c.appendChild(frag);
}

let sliderTimer=null;
function startSlider(){
  clearInterval(sliderTimer);
  const w=$('slider-wrapper'); if(!w) return;
  const n=w.children.length; if(n<2) return;
  let idx=0; const dots=document.querySelectorAll('#slider-dots .dot');
  const up=()=>{w.style.transform='translateX(-'+(idx*100)+'%)'; dots.forEach((d,i)=>{d.classList.toggle('bg-white',i===idx); d.classList.toggle('w-4',i===idx); d.classList.toggle('bg-white/60',i!==idx);});};
  up(); sliderTimer=setInterval(()=>{idx=(idx+1)%n; up();},3800);
}
function loadRecentOrders(){
  const c=$('recent-orders-list'); if(!c) return;
  db.collection('orders').orderBy('date','desc').limit(8).onSnapshot(snap=>{
    if(snap.empty){c.innerHTML='<div class="empty-state" style="padding:20px"><i class="fas fa-inbox" style="font-size:28px"></i><p style="font-size:11px">No orders yet</p></div>'; return;}
    const frag=document.createDocumentFragment();
    snap.forEach(doc=>{
      const d=doc.data(); let nm="Customer";
      if(d.userName) nm=d.userName.indexOf('@')>-1?d.userName.split('@')[0]:d.userName;
      let st=(d.status||'pending').toLowerCase(),bh='';
      if(['success','complete','completed'].indexOf(st)>-1) bh='<span class="bdg-done"><i class="fas fa-check-circle"></i> Done</span>';
      else if(['cancel','canceled','rejected','refunded'].indexOf(st)>-1) bh='<span class="bdg-cancel"><i class="fas fa-times-circle"></i> Cancel</span>';
      else bh='<span class="bdg-pend"><i class="fas fa-clock"></i> Pending</span>';
      const div=document.createElement('div'); div.className='ord-item';
      div.innerHTML='<div class="ord-av">'+nm.charAt(0).toUpperCase()+'</div><div class="flex-1 min-w-0"><p class="font-bold text-[#003d2d] text-[12.5px] truncate">'+nm+'</p><p class="text-gray-500 text-[10.5px] truncate mt-0.5">'+(d.productName||'-')+' - ৳'+d.price+'</p></div>'+bh;
      frag.appendChild(div);
    });
    c.innerHTML=''; c.appendChild(frag);
  });
}
function listenUser(uid){
  db.collection('users').doc(uid).onSnapshot(doc=>{
    if(!doc.exists) return;
    const d=doc.data(); userData=d;
    userBalance=parseInt(d.balance||0); totalSpend=parseInt(d.totalSpend||0); weeklySpend=parseInt(d.weeklySpend||0);
    setText('header-balance',userBalance); setText('header-avatar',(d.name||'U').charAt(0).toUpperCase());
    setText('acc-balance',userBalance); setText('acc-name',d.name||'User'); setText('acc-email',d.email||'');
    setText('acc-avatar',(d.name||'U').charAt(0).toUpperCase()); setText('acc-pin',d.supportPin||uid.slice(-5));
    setText('info-name',d.name||'-'); setText('info-phone',d.phone||'-'); setText('info-email',d.email||'-');
    setText('stat-orders',d.totalOrders||0);
    setText('stat-spend',totalSpend.toLocaleString()+' ৳'); setText('stat-weekly',weeklySpend.toLocaleString()+' ৳');
    setText('topup-balance',userBalance);
    computeRank();
  });
}

function startAppListeners(){
  if(listenersStarted) return;
  listenersStarted=true;

  db.collection('settings').doc('general').onSnapshot(doc=>{
    const d=doc.exists?doc.data():{};
    const fallback='https://placehold.co/150x50/006a4e/fff?text=TIGER+TOPUP';
    const homeUrl=d.userLogoUrl||d.logoUrl||fallback;
    const siteName=d.siteName||'TIGER TOPUP';
    if($('header-logo-img')) $('header-logo-img').src=homeUrl;
    setText('auth-site-name',siteName);
    setText('footer-site-name',siteName); setText('footer-site-name-2',siteName);
    setText('am-brand',siteName);
    document.title=siteName;
    if(d.notice) setText('notice-text',d.notice);
    if(d.howToThumb && $('how-to-thumb')) $('how-to-thumb').src=d.howToThumb;

    globalWalletLogo = d.walletLogo || '';
    globalInstantLogo = d.instantLogo || '';

    if($('wallet-opt-logo') && globalWalletLogo) $('wallet-opt-logo').src=globalWalletLogo;
    if($('instant-opt-logo') && globalInstantLogo) $('instant-opt-logo').src=globalInstantLogo;

    const tg=d.telegram||'#';
    const sh=(id,u)=>{const e=$(id);if(e)e.href=u;};
    sh('ft-fb',d.facebook||'#'); sh('ft-insta',d.instagram||'#'); sh('ft-yt',d.youtube||'#');
    sh('ft-support',tg); sh('home-support-tg',tg); sh('home-group',d.groupLink||tg); sh('ft-mail','mailto:'+(d.email||''));

    if(d.popupEnabled && d.popupImage && !sessionStorage.getItem('promoShown')){
      setTimeout(()=>showPromo(d),1400);
    }
  });

  db.collection('settings').doc('support').onSnapshot(doc=>{supportItems=(doc.exists&&Array.isArray(doc.data().items))?doc.data().items:[]; renderSupportBubbles();});
  db.collection('settings').doc('ranks').onSnapshot(doc=>{
    if(doc.exists && Array.isArray(doc.data().ranks) && doc.data().ranks.length>0){ranksList = doc.data().ranks;}
    else {ranksList = DEFAULT_RANKS;}
    computeRank();
  });
  db.collection('admin').doc('payment').onSnapshot(doc=>{
    if(doc.exists){const d=doc.data();
      paymentNumbers={bkash:d.bkash||'',nagad:d.nagad||'',rocket:d.rocket||''};
      paymentLogos={bkash:d.logoBkash||'',nagad:d.logoNagad||'',rocket:d.logoRocket||''};
    }
  });
  db.collection('categories').orderBy('order','asc').onSnapshot(snap=>{allCategories=[]; snap.forEach(doc=>allCategories.push(Object.assign({id:doc.id},doc.data()))); renderCategories();});
  db.collection('services').onSnapshot(snap=>{allGames=[]; gamesData={}; snap.forEach(doc=>{const d=doc.data();gamesData[doc.id]=d;allGames.push(Object.assign({id:doc.id},d));}); renderCategories();});
  db.collection('banners').onSnapshot(snap=>{
    const w=$('slider-wrapper'),dt=$('slider-dots'); if(!w||!dt) return;
    let h='',dh='';
    snap.forEach(doc=>{const img=doc.data().image; if(!img) return;
      h+='<img src="'+img+'" class="w-full h-full object-cover flex-shrink-0" onerror="this.src=\'https://placehold.co/600x300/eaf2ee/006a4e?text=TIGER\'">';
      dh+='<span class="dot w-1.5 h-1.5 rounded-full bg-white/60 transition-all"></span>';});
    if(h){w.innerHTML=h; dt.innerHTML=dh; startSlider();}
  });
  loadRecentOrders();
}

auth.onAuthStateChanged(user=>{
  if(user){
    currentUser=user;
    $('auth-sec').classList.add('hidden');
    $('app-content').classList.remove('hidden');
    listenUser(user.uid);
    startAppListeners();
  } else {
    currentUser=null;
    $('auth-sec').classList.remove('hidden');
    $('app-content').classList.add('hidden');
  }
});

document.addEventListener('DOMContentLoaded',()=>{
  const y=new Date().getFullYear();
  setText('footer-year',y); setText('footer-year-2',y);
  ranksList=DEFAULT_RANKS;
});
