const firebaseConfig = {
  apiKey: "AIzaSyCToUghMTET8xXEhKZlZOgrVCc46kg6FJU",
  authDomain: "tiger-topup-a5a57.firebaseapp.com",
  databaseURL: "https://tiger-topup-a5a57-default-rtdb.firebaseio.com",
  projectId: "tiger-topup-a5a57",
  storageBucket: "tiger-topup-a5a57.firebasestorage.app",
  messagingSenderId: "625064331537",
  appId: "1:625064331537:web:f91cb3e00ff6187a52a4b0"
};

let db, auth;
try { if (!firebase.apps.length) firebase.initializeApp(firebaseConfig); db=firebase.firestore(); auth=firebase.auth(); } catch(e){ console.error(e); }

const $ = (id) => document.getElementById(id);
const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
const fmtDate = (dv) => { if(!dv) return 'N/A'; const d=dv.toDate?dv.toDate():new Date(dv); return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}); };

function floatToast(msg, color='#006a4e'){ const el=document.createElement('div'); el.className='toast-float'; el.style.background=color; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>{el.style.transition='opacity .4s';el.style.opacity='0';setTimeout(()=>el.remove(),400);},1400); }

let allUsers=[], allCategories=[], allProducts=[], allBanners=[], allCodes=[], allSupport=[], allRanks=[];
let paymentNumbers={}, settingsData={};
let currentUserView=null, currentEditingProduct=null;
let cpSelectedCategory='', cpSelectedType='uid';
let depositFilter='pending', orderFilter='pending';
let listenersStarted=false, confirmCallback=null;
let productsCache={}, currentPackagesUnsub=null;
let newItemIds=new Set();
let siteName='';
let editingRankIndex = -1;

function markNew(id){ newItemIds.add(id); setTimeout(()=>newItemIds.delete(id),2500); }
function lockBodyScroll(){ const y=window.scrollY; document.body.style.top=`-${y}px`; document.body.classList.add('modal-open'); }
function unlockBodyScroll(){ const y=document.body.style.top; document.body.classList.remove('modal-open'); document.body.style.top=''; if(y) window.scrollTo(0,parseInt(y||'0')*-1); }
const observer=new MutationObserver(()=>{ const anyOpen=document.querySelectorAll('.modal-overlay:not(.hidden)').length>0; if(anyOpen&&!document.body.classList.contains('modal-open')) lockBodyScroll(); else if(!anyOpen&&document.body.classList.contains('modal-open')) unlockBodyScroll(); });

/* AUTH */
function adminLogin(){ const e=$('admin-email').value.trim(),p=$('admin-pass').value; if(!e||!p) return Swal.fire('Error','Empty credentials','warning'); Swal.showLoading(); auth.signInWithEmailAndPassword(e,p).catch(err=>Swal.fire('Login Failed',err.message,'error')); }
function togglePass(id,btn){ const inp=$(id),i=btn.querySelector('i'); if(inp.type==='password'){inp.type='text';i.classList.replace('fa-eye','fa-eye-slash');}else{inp.type='password';i.classList.replace('fa-eye-slash','fa-eye');} }
function adminLogout(){ Swal.fire({title:'Log Out?',icon:'question',showCancelButton:true,confirmButtonText:'Yes',confirmButtonColor:'#006a4e'}).then(r=>{if(r.isConfirmed)auth.signOut().then(()=>location.reload());}); }
auth.onAuthStateChanged(async user=>{
  if(!user){ $('login-sec').classList.remove('hidden'); $('admin-app').classList.add('hidden'); return; }
  try {
    const adminSnap = await db.collection('admins').doc(user.uid).get();
    const adminData = adminSnap.exists ? adminSnap.data() : {};
    if (!(adminData.enabled === true || adminData.active === true)) {
      await auth.signOut();
      $('login-sec').classList.remove('hidden'); $('admin-app').classList.add('hidden');
      Swal.fire({icon:'error',title:'Access Denied',text:'এই অ্যাকাউন্টটি Admin হিসেবে অনুমোদিত নয়। Firebase-এ admins/{UID} ডকুমেন্টে enabled:true সেট করুন।',background:'#14141e',color:'#f3f4f6'});
      return;
    }
    $('login-sec').classList.add('hidden'); $('admin-app').classList.remove('hidden');
    startAllListeners(); updateDashDate(); loadTelegramSettings();
  } catch(err) {
    await auth.signOut().catch(()=>{});
    $('login-sec').classList.remove('hidden'); $('admin-app').classList.add('hidden');
    Swal.fire({icon:'error',title:'Admin যাচাই হয়নি',text:err.message||'Firebase Rules পরীক্ষা করুন।',background:'#14141e',color:'#f3f4f6'});
  }
});
function updateDashDate(){ const d=new Date(); const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const el=$('dash-date'); if(el) el.textContent=`${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`; }

/* NAV */
function navTo(tab){ document.querySelectorAll('main > section').forEach(s=>s.classList.add('hidden')); document.querySelectorAll('.nvi').forEach(n=>n.classList.remove('on')); const v=$('view-'+tab); if(v) v.classList.remove('hidden'); const b=$('nav-'+tab); if(b) b.classList.add('on'); window.scrollTo({top:0,behavior:'smooth'}); if(tab==='ranks') resetRankForm(); }
function openSettingPage(name){ document.querySelectorAll('main > section').forEach(s=>s.classList.add('hidden')); const v=$('view-settings-'+name); if(v) v.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }
function showConfirm(t,m,cb){ setText('confirm-title',t); setText('confirm-msg',m||''); confirmCallback=cb; $('confirm-modal').classList.remove('hidden'); lockBodyScroll(); }
function closeConfirm(){ $('confirm-modal').classList.add('hidden'); confirmCallback=null; unlockBodyScroll(); }

/* LISTENERS */
function startAllListeners(){
  if(listenersStarted) return; listenersStarted=true;

  db.collection('users').onSnapshot(snap=>{ allUsers=[]; snap.forEach(doc=>allUsers.push(Object.assign({id:doc.id},doc.data()))); allUsers.sort((a,b)=>(a.name||'').localeCompare(b.name||'')); setText('dash-users',allUsers.length); renderUsers(allUsers); });
  db.collection('deposits').onSnapshot(snap=>{ const arr=[]; snap.forEach(doc=>arr.push(Object.assign({id:doc.id},doc.data()))); window._allDeposits=arr; setText('dash-pending-dep',arr.filter(d=>d.status==='pending').length); const ap=arr.filter(d=>d.status==='approved').reduce((s,d)=>s+parseInt(d.amount||0),0); setText('dash-total-dep','৳ '+ap.toLocaleString()); renderDeposits(); });
  db.collection('orders').onSnapshot(snap=>{
    const arr=[]; snap.forEach(doc=>arr.push(Object.assign({id:doc.id},doc.data()))); window._allOrders=arr;
    setText('dash-orders',arr.length);
    setText('dash-pending-ord',arr.filter(o=>o.status==='pending').length);
    let revenue=0,todayCount=0; const today=new Date(); today.setHours(0,0,0,0);
    arr.forEach(o=>{ if(['success','complete','completed'].includes((o.status||'').toLowerCase())) revenue+=parseInt(o.price||0); if(o.date){const d=o.date.toDate?o.date.toDate():new Date(o.date); if(d>=today) todayCount++;} });
    setText('dash-revenue','৳ '+revenue.toLocaleString());
    setText('dash-today-orders',todayCount);
    renderOrders(); renderRecentActivity();
  });
  db.collection('categories').orderBy('order','asc').onSnapshot(snap=>{ allCategories=[]; snap.forEach(doc=>allCategories.push(Object.assign({id:doc.id},doc.data()))); setText('kpi-categories',allCategories.length); renderCategories(); renderCategorySelector(); });
  db.collection('services').onSnapshot(snap=>{ allProducts=[]; productsCache={}; snap.forEach(doc=>{ const d=Object.assign({id:doc.id},doc.data()); allProducts.push(d); productsCache[doc.id]=d; }); setText('kpi-products',allProducts.length); renderProducts(); if(currentEditingProduct) setText('pm-game-title',(productsCache[currentEditingProduct]||{}).name||'Game'); });
  db.collection('banners').onSnapshot(snap=>{ allBanners=[]; snap.forEach(doc=>allBanners.push(Object.assign({id:doc.id},doc.data()))); setText('kpi-banners',allBanners.length); renderBanners(); });
  db.collection('codes').onSnapshot(snap=>{ allCodes=[]; snap.forEach(doc=>allCodes.push(Object.assign({id:doc.id},doc.data()))); setText('kpi-codes',allCodes.filter(c=>!c.used).length); renderCodes(); });
  db.collection('settings').doc('general').onSnapshot(doc=>{ settingsData=doc.exists?doc.data():{}; siteName=settingsData.siteName||''; if(siteName){ setText('dash-welcome',siteName+' Admin'); } loadSettingsUI(settingsData); });
  db.collection('settings').doc('ranks').onSnapshot(doc=>{
    allRanks = (doc.exists && Array.isArray(doc.data().ranks)) ? doc.data().ranks : [];
    renderRanks();
    if(editingRankIndex >= 0 && editingRankIndex >= allRanks.length){ resetRankForm(); }
  });
  db.collection('admin').doc('payment').onSnapshot(doc=>{
    paymentNumbers=doc.exists?doc.data():{};
    if($('set-bkash')) $('set-bkash').value=paymentNumbers.bkash||'';
    if($('set-nagad')) $('set-nagad').value=paymentNumbers.nagad||'';
    if($('set-rocket')) $('set-rocket').value=paymentNumbers.rocket||'';
    if($('set-logo-bkash')) $('set-logo-bkash').value=paymentNumbers.logoBkash||'';
    if($('set-logo-nagad')) $('set-logo-nagad').value=paymentNumbers.logoNagad||'';
    if($('set-logo-rocket')) $('set-logo-rocket').value=paymentNumbers.logoRocket||'';
    updatePreview('preview-logo-bkash',paymentNumbers.logoBkash);
    updatePreview('preview-logo-nagad',paymentNumbers.logoNagad);
    updatePreview('preview-logo-rocket',paymentNumbers.logoRocket);
  });
  db.collection('settings').doc('support').onSnapshot(doc=>{ allSupport=(doc.exists&&Array.isArray(doc.data().items))?doc.data().items:[]; renderSupport(); });
}

/* USERS */
function renderUsers(arr){ const l=$('users-list'); if(!l) return; if(arr.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-users"></i><p>No users</p></div>'; return; } const f=document.createDocumentFragment(); arr.slice(0,100).forEach(u=>{ const d=document.createElement('div'); d.className='user-row'; d.innerHTML='<div class="user-av">'+(u.name||u.email||'U').charAt(0).toUpperCase()+'</div><div class="flex-1 min-w-0"><p class="font-bold text-[13px] text-[#003d2d] truncate">'+(u.name||'User')+'</p><p class="text-[10px] text-gray-400 truncate">'+(u.email||u.id)+'</p><p class="text-[11px] text-[#006a4e] font-extrabold mt-0.5">৳'+(u.balance||0)+'</p></div><button type="button" class="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-[10px] font-extrabold" onclick="viewUser(\''+u.id+'\')">View</button>'; f.appendChild(d); }); l.innerHTML=''; l.appendChild(f); }
function searchUser(){ const q=($('user-search').value||'').toLowerCase(); renderUsers(allUsers.filter(u=>(u.email||'').toLowerCase().includes(q)||(u.name||'').toLowerCase().includes(q)||(u.id||'').toLowerCase().includes(q))); }
function viewUser(uid){ currentUserView=allUsers.find(u=>u.id===uid); if(!currentUserView) return; const u=currentUserView; setText('m-avatar',(u.name||'U').charAt(0).toUpperCase()); setText('m-name',u.name||'User'); setText('m-email',u.email||'-'); setText('m-uid',u.id); setText('m-balance',u.balance||0); setText('m-orders',u.totalOrders||0); setText('m-spent',u.totalSpend||0); $('edit-user-name').value=u.name||''; $('edit-user-phone').value=u.phone||''; $('bal-amount').value=''; $('user-modal').classList.remove('hidden'); lockBodyScroll(); }
function closeUserModal(){ $('user-modal').classList.add('hidden'); currentUserView=null; unlockBodyScroll(); }
function quickBal(a){ $('bal-amount').value=a; }
async function updateBalance(s){ if(!currentUserView) return; const a=parseInt($('bal-amount').value); if(!a||a<=0) return floatToast('Enter valid amount','#dc2626'); const f=s*a; Swal.showLoading(); try { const r=db.collection('users').doc(currentUserView.id); let nb; await db.runTransaction(async t=>{ const d=await t.get(r); const c=d.exists?(d.data().balance||0):0; nb=c+f; t.update(r,{balance:nb}); }); setText('m-balance',nb); $('bal-amount').value=''; Swal.fire({icon:'success',title:'Updated!',text:(f>0?'+':'')+'৳'+f+' → ৳'+nb,timer:1500,showConfirmButton:false}); } catch(e){ Swal.fire('Error',e.message,'error'); } }
function saveUserInfo(){ if(!currentUserView) return; const n=$('edit-user-name').value.trim(),p=$('edit-user-phone').value.trim(); if(!n) return floatToast('Name required','#dc2626'); db.collection('users').doc(currentUserView.id).update({name:n,phone:p}).then(()=>{ setText('m-name',n); floatToast('Saved ✓','#10b981'); }).catch(e=>Swal.fire('Error',e.message,'error')); }
function deleteUser(){ if(!currentUserView) return; showConfirm('Delete User?','Cannot be undone.',async()=>{ try { await db.collection('users').doc(currentUserView.id).delete(); closeUserModal(); floatToast('Deleted','#dc2626'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }
function openCreateUser(){ ['new-user-name','new-user-email','new-user-phone','new-user-pass'].forEach(id=>{ if($(id)) $(id).value=''; }); $('new-user-balance').value='0'; $('create-user-modal').classList.remove('hidden'); lockBodyScroll(); }
function closeCreateUser(){ $('create-user-modal').classList.add('hidden'); unlockBodyScroll(); }
async function createUser(){ const n=$('new-user-name').value.trim(),e=$('new-user-email').value.trim(),p=$('new-user-phone').value.trim(),pw=$('new-user-pass').value,b=parseInt($('new-user-balance').value)||0; if(!n||!e||!p||!pw) return floatToast('All fields required','#dc2626'); if(pw.length<6) return floatToast('Password 6+ chars','#dc2626'); Swal.showLoading(); try { const sa=firebase.apps.find(a=>a.name==='secondary')||firebase.initializeApp(firebaseConfig,'secondary'); const sc=firebase.auth(sa); const cr=await sc.createUserWithEmailAndPassword(e,pw); await db.collection('users').doc(cr.user.uid).set({name:n,email:e,phone:p,balance:b,totalSpend:0,weeklySpend:0,totalOrders:0,supportPin:Math.floor(10000+Math.random()*90000),createdAt:new Date()}); await sc.signOut(); Swal.fire({icon:'success',title:'User Created!',text:n,timer:1600,showConfirmButton:false}); closeCreateUser(); } catch(e){ Swal.fire('Error',e.message,'error'); } }

/* DEPOSITS */
function filterDeposits(f){ depositFilter=f; document.querySelectorAll('[id^="dep-tab-"]').forEach(b=>b.classList.remove('on')); const btn=$('dep-tab-'+f); if(btn) btn.classList.add('on'); renderDeposits(); }
function renderDeposits(){ const l=$('deposits-list'); if(!l) return; const arr=(window._allDeposits||[]).filter(d=>d.status===depositFilter).sort((a,b)=>{ const da=a.date&&a.date.toDate?a.date.toDate():new Date(a.date||0); const db2=b.date&&b.date.toDate?b.date.toDate():new Date(b.date||0); return db2-da; }); if(arr.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>No '+depositFilter+' deposits</p></div>'; return; } const f=document.createDocumentFragment(); arr.forEach(d=>{ const c=document.createElement('div'); c.className='card !mb-2.5'; c.innerHTML='<div class="flex justify-between items-start mb-2"><div><p class="text-[9.5px] font-extrabold text-gray-400 uppercase tracking-widest">'+(d.method||'Bank')+'</p><p class="text-xl font-black text-[#006a4e] mt-0.5">৳ '+d.amount+'</p></div><span class="bdg-info font-mono">'+(d.trxId||'-')+'</span></div><div class="bg-gray-50 rounded-lg p-2.5 mb-2.5 space-y-1"><p class="text-[10px] text-gray-500 flex items-center gap-1.5"><i class="fas fa-user text-gray-400 w-3"></i>'+(d.userEmail||d.userId)+'</p>'+(d.sender?'<p class="text-[10px] text-gray-500 flex items-center gap-1.5"><i class="fas fa-phone text-gray-400 w-3"></i>Sender: '+d.sender+'</p>':'')+'<p class="text-[10px] text-gray-400 flex items-center gap-1.5"><i class="far fa-clock text-gray-400 w-3"></i>'+fmtDate(d.date)+'</p></div>'+(d.status==='pending'?'<div class="grid grid-cols-2 gap-2"><button type="button" class="bg-red-50 text-red-500 py-2 rounded-lg text-[11px] font-extrabold" onclick="rejectDeposit(\''+d.id+'\')"><i class="fas fa-times mr-1"></i>Reject</button><button type="button" class="bg-green-500 text-white py-2 rounded-lg text-[11px] font-extrabold shadow" onclick="approveDeposit(\''+d.id+'\',\''+d.userId+'\','+d.amount+')"><i class="fas fa-check mr-1"></i>Approve</button></div>':'<div class="flex items-center justify-center gap-1.5 '+(d.status==='approved'?'bdg-done':'bdg-cancel')+' w-full py-2"><i class="fas fa-'+(d.status==='approved'?'check-circle':'times-circle')+'"></i> '+d.status.toUpperCase()+'</div>'); f.appendChild(c); }); l.innerHTML=''; l.appendChild(f); }
async function approveDeposit(docId,userId,amount){ Swal.fire({title:'Approve Deposit?',html:'Add <b>৳'+amount+'</b>?',icon:'warning',showCancelButton:true,confirmButtonColor:'#22c55e',confirmButtonText:'Yes'}).then(async r=>{ if(!r.isConfirmed) return; Swal.showLoading(); try { const ur=db.collection('users').doc(userId); await db.runTransaction(async t=>{ const ud=await t.get(ur); const c=ud.exists?(ud.data().balance||0):0; if(ud.exists) t.update(ur,{balance:c+parseInt(amount)}); else t.set(ur,{balance:parseInt(amount)}); t.update(db.collection('deposits').doc(docId),{status:'approved',approvedAt:new Date()}); }); Swal.fire('Approved','৳'+amount+' added','success'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }
function rejectDeposit(docId){ showConfirm('Reject Deposit?','User will not receive money.',async()=>{ try { await db.collection('deposits').doc(docId).update({status:'rejected',rejectedAt:new Date()}); floatToast('Rejected','#dc2626'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }

/* ORDERS */
function filterOrders(f){ orderFilter=f; ['pending','success','refunded','all'].forEach(k=>{ const b=$('ord-tab-'+k); if(b) b.classList.remove('on'); }); const btn=$('ord-tab-'+f); if(btn) btn.classList.add('on'); renderOrders(); }
function renderOrders(){ const l=$('orders-list'); if(!l) return; let arr=window._allOrders||[]; if(orderFilter!=='all') arr=arr.filter(o=>o.status===orderFilter); arr=arr.sort((a,b)=>{ const da=a.date&&a.date.toDate?a.date.toDate():new Date(a.date||0); const db2=b.date&&b.date.toDate?b.date.toDate():new Date(b.date||0); return db2-da; }); if(arr.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-shopping-bag"></i><p>No '+orderFilter+' orders</p></div>'; return; } const f=document.createDocumentFragment(); arr.slice(0,100).forEach(o=>{ const st=(o.status||'pending').toLowerCase(); let cls='order-card'; if(['success','complete','completed'].includes(st)) cls+=' done'; else if(['cancel','canceled','rejected','refunded'].includes(st)) cls+=' cancel'; let sh=''; if(['success','complete','completed'].includes(st)) sh='<span class="bdg-done"><i class="fas fa-check-circle"></i> Done</span>'; else if(['cancel','canceled','rejected','refunded'].includes(st)) sh='<span class="bdg-cancel"><i class="fas fa-times-circle"></i> '+st+'</span>'; else sh='<span class="bdg-pend"><i class="fas fa-clock"></i> Pending</span>'; const c=document.createElement('div'); c.className=cls; c.innerHTML='<div class="flex items-start justify-between mb-1.5"><div class="min-w-0 flex-1"><h4 class="font-extrabold text-[13px] text-[#003d2d] truncate"><i class="fas fa-gamepad text-[#006a4e] text-[10px] mr-1"></i>'+(o.gameName||'-')+'</h4><p class="text-[10px] text-gray-400 mt-0.5">'+fmtDate(o.date)+'</p></div><span class="font-black text-[#006a4e] text-base ml-2 whitespace-nowrap">৳'+o.price+'</span></div><div class="flex flex-wrap gap-1 mb-1.5">'+sh+'<span class="bdg-info">'+(o.paymentType==='direct'?(o.paymentMethod||'Direct').toUpperCase():'WALLET')+'</span>'+(o.trxId?'<span class="bdg-info font-mono">'+o.trxId+'</span>':'')+'</div><div class="order-info"><p class="k">Package</p><p class="v">'+(o.productName||'-')+'</p><p class="k mt-1.5">Player ID</p><p class="v font-mono">'+(o.playerId||'-')+'</p><p class="k mt-1.5">User</p><p class="v text-[10.5px] truncate">'+(o.userEmail||o.userName||'-')+'</p></div>'+(st==='pending'?'<div class="grid grid-cols-2 gap-2"><button type="button" class="bg-red-50 text-red-500 py-2 rounded-lg text-[11px] font-extrabold" onclick="refundOrder(\''+o.id+'\',\''+o.userId+'\','+o.price+')"><i class="fas fa-undo mr-1"></i>Refund</button><button type="button" class="bg-green-600 text-white py-2 rounded-lg text-[11px] font-extrabold shadow" onclick="completeOrder(\''+o.id+'\')"><i class="fas fa-check mr-1"></i>Complete</button></div>':'<button type="button" class="w-full bg-gray-50 text-gray-400 py-1.5 rounded-lg text-[10px] font-extrabold" onclick="deleteOrder(\''+o.id+'\')"><i class="fas fa-trash mr-1"></i>Delete</button>'); f.appendChild(c); }); l.innerHTML=''; l.appendChild(f); }
function completeOrder(id){ showConfirm('Mark as Complete?','User will see this as completed.',async()=>{ try { await db.collection('orders').doc(id).update({status:'success',completedAt:new Date()}); floatToast('Order completed ✓','#10b981'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }
function refundOrder(id,uid,amt){ showConfirm('Refund Order?','Return ৳'+amt+' to user wallet?',async()=>{ Swal.showLoading(); try { const ur=db.collection('users').doc(uid); await db.runTransaction(async t=>{ const ud=await t.get(ur); const c=ud.exists?(ud.data().balance||0):0; if(ud.exists) t.update(ur,{balance:c+parseInt(amt)}); t.update(db.collection('orders').doc(id),{status:'refunded',refundedAt:new Date()}); }); Swal.fire('Refunded','৳'+amt+' returned','success'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }
function deleteOrder(id){ showConfirm('Delete Order?','Cannot be undone.',async()=>{ try { await db.collection('orders').doc(id).delete(); floatToast('Deleted','#dc2626'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }
function renderRecentActivity(){ const el=$('dash-recent'); if(!el) return; const arr=(window._allOrders||[]).sort((a,b)=>{ const da=a.date&&a.date.toDate?a.date.toDate():new Date(a.date||0); const db2=b.date&&b.date.toDate?b.date.toDate():new Date(b.date||0); return db2-da; }).slice(0,5); if(arr.length===0){ el.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>No recent activity</p></div>'; return; } const f=document.createDocumentFragment(); arr.forEach(o=>{ const st=(o.status||'pending').toLowerCase(); let bdg='bdg-pend'; if(['success','complete','completed'].includes(st)) bdg='bdg-done'; else if(['cancel','canceled','rejected','refunded'].includes(st)) bdg='bdg-cancel'; const d=document.createElement('div'); d.className='activity-item'; d.innerHTML='<div class="activity-av">'+((o.userName||'U').charAt(0).toUpperCase())+'</div><div class="flex-1 min-w-0"><p class="font-bold text-[11.5px] text-[#003d2d] truncate">'+(o.productName||'-')+'</p><p class="text-[10px] text-gray-400 truncate">'+(o.userEmail||'-')+'</p></div><div class="text-right flex-shrink-0 ml-2"><p class="text-sm font-black text-[#006a4e]">৳'+o.price+'</p><span class="'+bdg+' mt-0.5">'+st+'</span></div>'; f.appendChild(d); }); el.innerHTML=''; el.appendChild(f); }

/* CATEGORIES */
function addCategory(){ const n=$('cat-name').value.trim(),o=parseInt($('cat-order').value)||999; if(!n) return floatToast('Category name required','#dc2626'); const tid='temp-'+Date.now(); allCategories.push({id:tid,name:n,order:o}); renderCategories(); markNew(tid); $('cat-name').value=''; $('cat-order').value=''; db.collection('categories').add({name:n,order:o,createdAt:new Date()}).then(()=>floatToast('Category added ✓','#10b981')).catch(e=>{ allCategories=allCategories.filter(c=>c.id!==tid); renderCategories(); Swal.fire('Error',e.message,'error'); }); }
function renderCategories(){ const l=$('categories-list'); if(!l) return; if(allCategories.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-layer-group"></i><p>No categories yet</p></div>'; return; } const f=document.createDocumentFragment(); allCategories.forEach(c=>{ const d=document.createElement('div'); d.className='bg-white rounded-xl p-2.5 border border-gray-100 flex items-center gap-2.5 mb-2'+(newItemIds.has(c.id)?' new-flash':''); d.innerHTML='<div class="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-[#006a4e] text-sm"><i class="fas fa-folder"></i></div><div class="flex-1 min-w-0"><p class="font-extrabold text-[12.5px] text-[#003d2d] truncate">'+c.name+'</p><p class="text-[10px] text-gray-400">Order: '+(c.order||'-')+'</p></div><button type="button" class="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center" onclick="deleteCategory(\''+c.id+'\')"><i class="fas fa-trash text-[10px]"></i></button>'; f.appendChild(d); }); l.innerHTML=''; l.appendChild(f); }
function deleteCategory(id){ showConfirm('Delete Category?','Products will remain.',async()=>{ try { await db.collection('categories').doc(id).delete(); floatToast('Deleted','#dc2626'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }
function renderCategorySelector(){ const b=$('cp-cat-selector'); if(!b) return; b.innerHTML=''; if(allCategories.length===0){ b.innerHTML='<p class="text-[11px] text-gray-400 py-1">No categories yet ↓</p>'; return; } allCategories.forEach(c=>{ const btn=document.createElement('button'); btn.type='button'; btn.className='cat-selector-btn'+(cpSelectedCategory===c.name?' on':''); btn.innerHTML='<i class="fas fa-folder text-[9px]"></i> '+c.name; btn.onclick=()=>{ cpSelectedCategory=c.name; $('cp-category').value=c.name; renderCategorySelector(); }; b.appendChild(btn); }); }
function toggleAddCategoryInline(){ const b=$('cp-add-cat-inline'),l=$('cp-add-cat-btn-label'); if(b.classList.contains('hidden')){ b.classList.remove('hidden'); l.textContent='Hide'; $('cp-new-cat-name').focus(); } else { b.classList.add('hidden'); l.textContent='Add new category'; } }
function cancelAddCategoryInline(){ $('cp-add-cat-inline').classList.add('hidden'); $('cp-add-cat-btn-label').textContent='Add new category'; $('cp-new-cat-name').value=''; }
async function addCategoryFromProduct(){ const n=$('cp-new-cat-name').value.trim(); if(!n) return floatToast('Enter category name','#dc2626'); const e=allCategories.find(c=>c.name.toLowerCase()===n.toLowerCase()); if(e){ cpSelectedCategory=e.name; $('cp-category').value=e.name; cancelAddCategoryInline(); return floatToast('Category exists','#f59e0b'); } Swal.showLoading(); try { await db.collection('categories').add({name:n,order:allCategories.length+1,createdAt:new Date()}); cpSelectedCategory=n; $('cp-category').value=n; cancelAddCategoryInline(); Swal.fire({icon:'success',title:'Category created',timer:1000,showConfirmButton:false}); } catch(e){ Swal.fire('Error',e.message,'error'); } }

/* CREATE PRODUCT */
function openCreateProduct(){ ['cp-name','cp-image','cp-badge','cp-input-label','cp-rules','cp-new-cat-name','cp-wallet-logo','cp-instant-logo'].forEach(id=>{ if($(id)) $(id).value=''; }); $('cp-badge-type').value=''; cpSelectedCategory=''; cpSelectedType='uid'; $('cp-category').value=''; $('cp-input-type').value='uid'; renderCategorySelector(); selectTypeTile('uid'); cancelAddCategoryInline(); $('create-product-modal').classList.remove('hidden'); lockBodyScroll(); }
function closeCreateProduct(){ $('create-product-modal').classList.add('hidden'); unlockBodyScroll(); }
function selectTypeTile(v){ cpSelectedType=v; $('cp-input-type').value=v; document.querySelectorAll('#cp-type-selector .type-tile').forEach(el=>el.classList.toggle('on',el.dataset.value===v)); }
async function submitCreateProduct(){ const n=$('cp-name').value.trim(),i=$('cp-image').value.trim(),c=$('cp-category').value||cpSelectedCategory; if(!n) return floatToast('Product name required','#dc2626'); if(!i) return floatToast('Image URL required','#dc2626'); if(!c) return floatToast('Select a category','#dc2626'); const btn=$('cp-submit-btn'); btn.innerHTML='<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Adding...'; btn.disabled=true; const payload={name:n,image:i,category:c,badge:$('cp-badge').value.trim(),badgeType:$('cp-badge-type').value,inputType:cpSelectedType,inputLabel:$('cp-input-label').value.trim(),walletLogo:$('cp-wallet-logo').value.trim(),instantLogo:$('cp-instant-logo').value.trim(),rules:$('cp-rules').value.trim(),createdAt:new Date()}; try { const tid='temp-'+Date.now(); allProducts.push(Object.assign({id:tid},payload)); productsCache[tid]=Object.assign({id:tid},payload); markNew(tid); renderProducts(); closeCreateProduct(); floatToast('Product added ✓','#10b981'); await db.collection('services').add(payload); } catch(e){ allProducts=allProducts.filter(p=>p.id.indexOf('temp-')!==0); renderProducts(); Swal.fire('Error',e.message,'error'); } finally { btn.innerHTML='<i class="fas fa-check"></i> Create'; btn.disabled=false; } }
function openEditProduct(id){ const p=productsCache[id]; if(!p) return; $('ep-id').value=id; $('ep-name').value=p.name||''; $('ep-image').value=p.image||''; $('ep-wallet-logo').value=p.walletLogo||''; $('ep-instant-logo').value=p.instantLogo||''; $('ep-rules').value=p.rules||''; $('ep-input-label').value=p.inputLabel||''; $('edit-product-modal').classList.remove('hidden'); lockBodyScroll(); }
function closeEditProduct(){ $('edit-product-modal').classList.add('hidden'); unlockBodyScroll(); }
async function saveEditProduct(){ const id=$('ep-id').value; if(!id) return; Swal.showLoading(); try { await db.collection('services').doc(id).update({name:$('ep-name').value.trim(),image:$('ep-image').value.trim(),walletLogo:$('ep-wallet-logo').value.trim(),instantLogo:$('ep-instant-logo').value.trim(),rules:$('ep-rules').value.trim(),inputLabel:$('ep-input-label').value.trim()}); floatToast('Saved ✓','#10b981'); closeEditProduct(); } catch(e){ Swal.fire('Error',e.message,'error'); } }
function renderProducts(){ const l=$('products-grid-list'); if(!l) return; if(allProducts.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-gamepad"></i><p>No products yet</p></div>'; return; } const f=document.createDocumentFragment(); allProducts.forEach(p=>{ const d=document.createElement('div'); d.className='bg-white rounded-xl p-2.5 border border-gray-100 shadow-sm flex items-center gap-2.5 mb-2'+(newItemIds.has(p.id)?' new-flash':''); d.innerHTML='<img src="'+p.image+'" class="w-12 h-12 rounded-lg object-cover bg-gray-100 border border-gray-100 flex-shrink-0" onerror="this.src=\'https://placehold.co/60?text=Game\'"><div class="flex-1 min-w-0"><p class="font-extrabold text-[12.5px] text-[#003d2d] truncate">'+p.name+'</p><span class="cat-chip mt-0.5"><i class="fas fa-folder text-[8px]"></i> '+(p.category||'-')+'</span></div><div class="flex flex-col gap-1 flex-shrink-0"><button type="button" class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md text-[9.5px] font-extrabold" onclick="openEditProduct(\''+p.id+'\')"><i class="fas fa-edit"></i> Edit</button><button type="button" class="bg-green-50 text-[#006a4e] px-2.5 py-1 rounded-md text-[9.5px] font-extrabold" onclick="openPackages(\''+p.id+'\')"><i class="fas fa-boxes"></i> Pkgs</button><button type="button" class="bg-red-50 text-red-500 px-2.5 py-1 rounded-md text-[9.5px] font-extrabold" onclick="deleteProduct(\''+p.id+'\')"><i class="fas fa-trash"></i> Del</button></div>'; f.appendChild(d); }); l.innerHTML=''; l.appendChild(f); }
function deleteProduct(id){ showConfirm('Delete Product?','Packages will also be removed.',async()=>{ try { const p=await db.collection('services').doc(id).collection('products').get(); await Promise.all(p.docs.map(d=>d.ref.delete())); await db.collection('services').doc(id).delete(); floatToast('Deleted','#dc2626'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }

/* PACKAGES */
function openPackages(pid){ currentEditingProduct=pid; const p=productsCache[pid]; if(!p) return; setText('pm-game-title',p.name); $('products-main-view').classList.add('hidden'); $('packages-manager-view').classList.remove('hidden'); renderPackages(pid); window.scrollTo({top:0,behavior:'smooth'}); }
function closePackagesView(){ if(currentPackagesUnsub){ currentPackagesUnsub(); currentPackagesUnsub=null; } currentEditingProduct=null; $('packages-manager-view').classList.add('hidden'); $('products-main-view').classList.remove('hidden'); }
function renderPackages(pid){ const l=$('packages-list'); if(!l) return; if(currentPackagesUnsub){ currentPackagesUnsub(); currentPackagesUnsub=null; } l.innerHTML='<div class="text-center py-6"><div class="spinner"></div></div>'; currentPackagesUnsub=db.collection('services').doc(pid).collection('products').orderBy('price','asc').onSnapshot(snap=>{ if(snap.empty){ l.innerHTML='<div class="empty-state"><i class="fas fa-cube"></i><p>No packages yet</p></div>'; setText('pkg-count',''); return; } setText('pkg-count','('+snap.size+')'); const f=document.createDocumentFragment(); snap.forEach(doc=>{ const p=doc.data(),pkgId=doc.id,inSt=p.stock!==false&&p.stock!=='out'; const auto=getPkgIcon(p.name); let ih; if(p.icon&&p.icon.trim()){ ih='<div class="pkg-manage-icon"><img src="'+p.icon+'" onerror="this.outerHTML=\'<i class=&quot;fas '+auto.icon+'&quot; style=&quot;color:'+auto.color+'&quot;></i>\'"></div>'; } else { ih='<div class="pkg-manage-icon"><i class="fas '+auto.icon+'" style="color:'+auto.color+';"></i></div>'; } const c=document.createElement('div'); c.className='pkg-manage-card'+(newItemIds.has(pkgId)?' new-flash':''); c.innerHTML='<div class="pkg-manage-head">'+ih+'<div class="flex-1 min-w-0"><p class="font-extrabold text-[13px] text-[#003d2d] truncate">'+(p.name||'-')+'</p><p class="text-base font-black text-[#006a4e] mt-0.5">৳ '+p.price+'</p></div><span class="stock-toggle '+(inSt?'in':'out')+'" onclick="toggleStock(\''+pid+'\',\''+pkgId+'\','+inSt+')"><i class="fas fa-'+(inSt?'check-circle':'times-circle')+'"></i> '+(inSt?'IN STOCK':'OUT')+'</span></div><div class="flex gap-2"><input type="text" id="pkg-icon-'+pkgId+'" class="inp !text-[11px] flex-1" placeholder="Icon URL" value="'+(p.icon||'')+'"><button type="button" class="mini-icon-btn bg-blue-100 text-blue-600" onclick="savePkgIcon(\''+pid+'\',\''+pkgId+'\')"><i class="fas fa-save"></i></button><button type="button" class="mini-icon-btn bg-red-100 text-red-500" onclick="deletePackage(\''+pid+'\',\''+pkgId+'\')"><i class="fas fa-trash"></i></button></div>'; f.appendChild(c); }); l.innerHTML=''; l.appendChild(f); }, err=>{ l.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>'+err.message+'</p></div>'; }); }
function getPkgIcon(n){ if(!n) return {icon:'fa-gem',color:'#006a4e'}; const l=n.toLowerCase(); if(l.includes('diamond')||l.includes('dia')||l.includes('robux')||l.includes('gem')) return {icon:'fa-gem',color:'#006a4e'}; if(l.includes('uc')) return {icon:'fa-star',color:'#f59e0b'}; if(l.includes('coin')||l.includes('gold')||l.includes('silver')) return {icon:'fa-coins',color:'#f59e0b'}; if(l.includes('weekly')||l.includes('week')) return {icon:'fa-calendar-week',color:'#006a4e'}; if(l.includes('monthly')||l.includes('month')) return {icon:'fa-calendar-days',color:'#00875f'}; if(l.includes('pass')||l.includes('bp')||l.includes('royal')) return {icon:'fa-ticket',color:'#10b981'}; if(l.includes('vip')) return {icon:'fa-crown',color:'#f59e0b'}; return {icon:'fa-gem',color:'#006a4e'}; }
async function addPackage(){ if(!currentEditingProduct) return; const n=$('pkg-name').value.trim(),p=parseInt($('pkg-price').value),i=$('pkg-icon').value.trim(); if(!n) return floatToast('Package name required','#dc2626'); if(!p||p<=0) return floatToast('Valid price required','#dc2626'); const btn=$('pkg-add-btn'); btn.innerHTML='<div class="spinner" style="width:14px;height:14px;border-width:2px"></div>'; btn.disabled=true; try { $('pkg-name').value=''; $('pkg-price').value=''; $('pkg-icon').value=''; await db.collection('services').doc(currentEditingProduct).collection('products').add({name:n,price:p,icon:i,stock:true,createdAt:new Date()}); floatToast('Package added ✓','#10b981'); } catch(e){ Swal.fire('Error',e.message,'error'); } finally { btn.innerHTML='<i class="fas fa-plus"></i> Add Package'; btn.disabled=false; } }
function toggleStock(pid,pkgId,curr){ const ns=!curr; db.collection('services').doc(pid).collection('products').doc(pkgId).update({stock:ns}).then(()=>floatToast(ns?'In Stock ✓':'Out of Stock',ns?'#10b981':'#dc2626')).catch(e=>Swal.fire('Error',e.message,'error')); }
function savePkgIcon(pid,pkgId){ const i=$('pkg-icon-'+pkgId).value.trim(); db.collection('services').doc(pid).collection('products').doc(pkgId).update({icon:i}).then(()=>floatToast('Icon saved ✓','#10b981')).catch(e=>Swal.fire('Error',e.message,'error')); }
function deletePackage(pid,pkgId){ showConfirm('Delete Package?','',async()=>{ try { await db.collection('services').doc(pid).collection('products').doc(pkgId).delete(); floatToast('Deleted','#dc2626'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }

/* BANNERS */
function addBanner(){ const u=$('banner-url').value.trim(); if(!u) return floatToast('Image URL required','#dc2626'); const tid='temp-'+Date.now(); allBanners.push({id:tid,image:u}); renderBanners(); markNew(tid); $('banner-url').value=''; db.collection('banners').add({image:u,createdAt:new Date()}).then(()=>floatToast('Banner added ✓','#10b981')).catch(e=>{ allBanners=allBanners.filter(b=>b.id!==tid); renderBanners(); Swal.fire('Error',e.message,'error'); }); }
function renderBanners(){ const l=$('banners-list'); if(!l) return; if(allBanners.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-image"></i><p>No banners</p></div>'; return; } const f=document.createDocumentFragment(); allBanners.forEach(b=>{ const d=document.createElement('div'); d.className='relative rounded-xl overflow-hidden bg-gray-100 border border-gray-100 shadow-sm mb-2.5'+(newItemIds.has(b.id)?' new-flash':''); d.innerHTML='<img src="'+b.image+'" class="w-full h-24 object-cover" onerror="this.src=\'https://placehold.co/600x300?text=Banner\'"><button type="button" class="absolute top-1.5 right-1.5 bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center" onclick="deleteBanner(\''+b.id+'\')"><i class="fas fa-times text-[10px]"></i></button>'; f.appendChild(d); }); l.innerHTML=''; l.appendChild(f); }
function deleteBanner(id){ showConfirm('Delete Banner?','',async()=>{ try { await db.collection('banners').doc(id).delete(); floatToast('Deleted','#dc2626'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }

/* RANKS */
function updateRankPreview(){
  const img = ($('rk-image') && $('rk-image').value.trim()) || '';
  const name = ($('rk-name') && $('rk-name').value.trim()) || 'Rank Name';
  const color = ($('rk-color') && $('rk-color').value.trim()) || '#006a4e';
  const min = ($('rk-min') && $('rk-min').value) || 0;
  const max = ($('rk-max') && $('rk-max').value) || 0;
  const tagline = ($('rk-tagline') && $('rk-tagline').value.trim()) || '';
  const icon = ($('rk-icon') && $('rk-icon').value.trim()) || 'fa-medal';

  const pv = $('rank-live-preview');
  if(pv){
    const iconHtml = img
      ? '<img src="'+img+'" style="width:100%;height:100%;object-fit:contain;padding:3px" onerror="this.outerHTML=\'<i class=&quot;fas '+icon+'&quot; style=&quot;color:'+color+';font-size:20px&quot;></i>\'">'
      : '<i class="fas '+icon+'" style="color:'+color+';font-size:20px"></i>';
    const wrapBg = img ? '#fff' : color+'25';
    pv.innerHTML =
      '<div style="width:48px;height:48px;border-radius:50%;background:'+wrapBg+';border:2px solid '+color+'70;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">'+iconHtml+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<p style="font-weight:900;color:#003d2d;font-size:13px">'+name+'</p>'+
        '<p style="font-size:10.5px;color:#64748b;margin-top:2px">'+parseInt(min).toLocaleString()+' - '+parseInt(max).toLocaleString()+' ৳</p>'+
        (tagline ? '<p style="font-size:9.5px;color:#94a3b8;margin-top:2px;font-style:italic">'+tagline+'</p>' : '')+
      '</div>'+
      '<span style="font-size:9.5px;font-weight:800;padding:5px 10px;border-radius:20px;background:#dcfce7;color:#166534">Unlocked</span>';
  }
  updatePreview('preview-rank-img', img);
}
function resetRankForm(){
  editingRankIndex = -1;
  const ids = ['rk-name','rk-image','rk-min','rk-max','rk-tagline'];
  ids.forEach(id => { if($(id)) $(id).value = ''; });
  if($('rk-icon')) $('rk-icon').value = 'fa-medal';
  if($('rk-color')) $('rk-color').value = '#006a4e';
  if($('rk-edit-index')) $('rk-edit-index').value = '-1';
  setText('rank-form-title','Create New Rank');
  if($('rk-save-btn')) $('rk-save-btn').innerHTML = '<i class="fas fa-save"></i> Save Rank';
  updateRankPreview();
}
async function saveRank(){
  const name = $('rk-name').value.trim();
  const image = $('rk-image').value.trim();
  const min = parseInt($('rk-min').value) || 0;
  const max = parseInt($('rk-max').value) || 0;
  const tagline = $('rk-tagline').value.trim();
  const icon = $('rk-icon').value.trim() || 'fa-medal';
  const color = $('rk-color').value.trim() || '#006a4e';

  if(!name) return floatToast('Rank name required','#dc2626');
  if(!image) return floatToast('Rank PNG image URL required','#dc2626');
  if(max <= min) return floatToast('Max spend must be greater than Min','#dc2626');

  const rank = { name, image, min, max, tagline, icon, color };
  let newRanks = allRanks.slice();

  if(editingRankIndex >= 0){
    newRanks[editingRankIndex] = rank;
  } else {
    if(newRanks.some(r => (r.name||'').toLowerCase() === name.toLowerCase())){
      return floatToast('Rank already exists','#f59e0b');
    }
    newRanks.push(rank);
  }

  newRanks.sort((a,b) => (parseInt(a.min)||0) - (parseInt(b.min)||0));

  Swal.showLoading();
  try {
    await db.collection('settings').doc('ranks').set({ ranks: newRanks }, { merge: true });
    Swal.close();
    floatToast(editingRankIndex >= 0 ? 'Rank updated ✓' : 'Rank created ✓', '#10b981');
    resetRankForm();
  } catch(e){
    Swal.fire('Error', e.message, 'error');
  }
}
function editRank(index){
  const r = allRanks[index];
  if(!r) return;
  editingRankIndex = index;
  $('rk-name').value = r.name || '';
  $('rk-image').value = r.image || '';
  $('rk-min').value = r.min || 0;
  $('rk-max').value = r.max || 0;
  $('rk-tagline').value = r.tagline || '';
  $('rk-icon').value = r.icon || 'fa-medal';
  $('rk-color').value = r.color || '#006a4e';
  $('rk-edit-index').value = index;
  setText('rank-form-title','Edit Rank');
  if($('rk-save-btn')) $('rk-save-btn').innerHTML = '<i class="fas fa-check"></i> Update Rank';
  updateRankPreview();
  window.scrollTo({top:0,behavior:'smooth'});
}
function deleteRank(index){
  const r = allRanks[index];
  if(!r) return;
  showConfirm('Delete Rank?','"'+r.name+'" will be permanently removed.', async()=>{
    const newRanks = allRanks.slice();
    newRanks.splice(index, 1);
    try {
      await db.collection('settings').doc('ranks').set({ ranks: newRanks }, { merge: true });
      floatToast('Rank deleted','#dc2626');
      if(editingRankIndex === index) resetRankForm();
      else if(editingRankIndex > index) editingRankIndex--;
    } catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}
function moveRank(index, dir){
  const newIndex = index + dir;
  if(newIndex < 0 || newIndex >= allRanks.length) return;
  const newRanks = allRanks.slice();
  const tmp = newRanks[index];
  newRanks[index] = newRanks[newIndex];
  newRanks[newIndex] = tmp;
  db.collection('settings').doc('ranks').set({ ranks: newRanks }, { merge: true })
    .then(() => floatToast('Reordered ✓','#10b981'))
    .catch(e => Swal.fire('Error',e.message,'error'));
}
function loadDefaultRanks(){
  const defaults = [
    { name: "Bronze",       min: 0,       max: 100,       tagline: "Start your journey", color: "#b45309", icon: "fa-medal",  image: "https://cdn-icons-png.flaticon.com/512/2583/2583344.png" },
    { name: "Silver",       min: 101,     max: 1000,      tagline: "Keep grinding",      color: "#64748b", icon: "fa-medal",  image: "https://cdn-icons-png.flaticon.com/512/2583/2583382.png" },
    { name: "Gold",         min: 1001,    max: 5000,      tagline: "Shine brighter",     color: "#f59e0b", icon: "fa-crown",  image: "https://cdn-icons-png.flaticon.com/512/2583/2583434.png" },
    { name: "Platinum",     min: 5001,    max: 10000,     tagline: "Elite status",       color: "#0891b2", icon: "fa-gem",    image: "https://cdn-icons-png.flaticon.com/512/2583/2583319.png" },
    { name: "Diamond",      min: 10001,   max: 25000,     tagline: "Premium glow",       color: "#a855f7", icon: "fa-gem",    image: "https://cdn-icons-png.flaticon.com/512/2583/2583369.png" },
    { name: "Heroic",       min: 25001,   max: 50000,     tagline: "Legendary",          color: "#ef4444", icon: "fa-dragon", image: "https://cdn-icons-png.flaticon.com/512/2583/2583444.png" },
    { name: "Master",       min: 50001,   max: 100000,    tagline: "Top tier",           color: "#8b5cf6", icon: "fa-crown",  image: "https://cdn-icons-png.flaticon.com/512/2583/2583410.png" },
    { name: "Grand Master", min: 100001,  max: 999999999, tagline: "Ultimate",           color: "#eab308", icon: "fa-crown",  image: "https://cdn-icons-png.flaticon.com/512/2583/2583468.png" }
  ];
  showConfirm('Load Default Ranks?','This will REPLACE all current ranks with 8 default ranks.', async()=>{
    try {
      await db.collection('settings').doc('ranks').set({ ranks: defaults }, { merge: true });
      floatToast('Default ranks loaded ✓','#10b981');
      resetRankForm();
    } catch(e){ Swal.fire('Error',e.message,'error'); }
  });
}
function renderRanks(){
  const l = $('ranks-list'); if(!l) return;
  if(allRanks.length === 0){
    l.innerHTML = '<div class="empty-state"><i class="fas fa-medal"></i><p>No ranks configured</p><button type="button" onclick="loadDefaultRanks()" class="btn-navy" style="max-width:220px;margin:14px auto 0"><i class="fas fa-magic"></i> Load Default Ranks</button></div>';
    setText('ranks-count','');
    return;
  }
  setText('ranks-count','('+allRanks.length+')');
  const f = document.createDocumentFragment();
  allRanks.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'bg-white rounded-xl p-3 border border-gray-100 mb-2 flex items-center gap-3';
    const iconHtml = (r.image && r.image.trim())
      ? '<img src="'+r.image+'" style="width:100%;height:100%;object-fit:contain;padding:2px" onerror="this.outerHTML=\'<i class=&quot;fas '+(r.icon||'fa-medal')+'&quot; style=&quot;color:'+r.color+';font-size:18px&quot;></i>\'">'
      : '<i class="fas '+(r.icon||'fa-medal')+'" style="color:'+r.color+';font-size:18px"></i>';
    const wrapBg = (r.image && r.image.trim()) ? '#fff' : r.color+'25';
    d.innerHTML =
      '<div style="width:46px;height:46px;border-radius:50%;background:'+wrapBg+';border:2px solid '+r.color+'70;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">'+iconHtml+'</div>'+
      '<div class="flex-1 min-w-0">'+
        '<p class="font-extrabold text-[13px] text-[#003d2d] truncate">'+(i+1)+'. '+r.name+'</p>'+
        '<p class="text-[10px] text-gray-500 mt-0.5"><i class="fas fa-coins text-amber-500 text-[9px]"></i> '+parseInt(r.min).toLocaleString()+' - '+parseInt(r.max).toLocaleString()+' ৳</p>'+
        (r.tagline ? '<p class="text-[9.5px] text-gray-400 italic mt-0.5 truncate">'+r.tagline+'</p>' : '')+
      '</div>'+
      '<div class="flex flex-col gap-1 flex-shrink-0">'+
        '<div class="flex gap-1">'+
          '<button type="button" class="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center '+(i===0?'opacity-30 pointer-events-none':'')+'" onclick="moveRank('+i+',-1)"><i class="fas fa-chevron-up text-[9px]"></i></button>'+
          '<button type="button" class="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center '+(i===allRanks.length-1?'opacity-30 pointer-events-none':'')+'" onclick="moveRank('+i+',1)"><i class="fas fa-chevron-down text-[9px]"></i></button>'+
        '</div>'+
        '<div class="flex gap-1">'+
          '<button type="button" class="w-7 h-7 rounded-md bg-green-50 text-green-600 flex items-center justify-center" onclick="editRank('+i+')"><i class="fas fa-edit text-[9px]"></i></button>'+
          '<button type="button" class="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center" onclick="deleteRank('+i+')"><i class="fas fa-trash text-[9px]"></i></button>'+
        '</div>'+
      '</div>';
    f.appendChild(d);
  });
  l.innerHTML=''; l.appendChild(f);
}

/* CODES */
function addRedeemCode(){ const c=$('code-value').value.trim().toUpperCase(),a=parseInt($('code-amount').value); if(!c) return floatToast('Code required','#dc2626'); if(!a) return floatToast('Amount required','#dc2626'); const tid='temp-'+Date.now(); allCodes.push({id:tid,code:c,amount:a,used:false}); renderCodes(); markNew(tid); $('code-value').value=''; $('code-amount').value=''; db.collection('codes').where('code','==',c).limit(1).get().then(snap=>{ if(!snap.empty){ allCodes=allCodes.filter(x=>x.id!==tid); renderCodes(); return floatToast('Code already exists','#f59e0b'); } return db.collection('codes').add({code:c,amount:a,used:false,usedBy:null,createdAt:new Date()}).then(()=>floatToast('Code created ✓','#10b981')); }).catch(e=>{ allCodes=allCodes.filter(x=>x.id!==tid); renderCodes(); Swal.fire('Error',e.message,'error'); }); }
function renderCodes(){ const l=$('codes-list'); if(!l) return; if(allCodes.length===0){ l.innerHTML='<div class="empty-state"><i class="fas fa-ticket-alt"></i><p>No codes</p></div>'; return; } const sorted=allCodes.slice().sort((a,b)=>{ const da=a.createdAt&&a.createdAt.toDate?a.createdAt.toDate():new Date(a.createdAt||0); const db2=b.createdAt&&b.createdAt.toDate?b.createdAt.toDate():new Date(b.createdAt||0); return db2-da; }); const f=document.createDocumentFragment(); sorted.forEach(c=>{ const d=document.createElement('div'); d.className='bg-white rounded-xl p-2.5 border border-gray-100 flex items-center gap-2.5 mb-2'+(newItemIds.has(c.id)?' new-flash':''); d.innerHTML='<div class="w-9 h-9 rounded-lg '+(c.used?'bg-red-50 text-red-500':'bg-green-50 text-green-500')+' flex items-center justify-center text-sm"><i class="fas fa-ticket-alt"></i></div><div class="flex-1 min-w-0"><p class="font-extrabold text-[12.5px] text-[#003d2d] font-mono truncate">'+c.code+'</p><p class="text-[10px] text-gray-400">৳'+c.amount+' · '+(c.used?'Used':'Available')+'</p></div><button type="button" class="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center" onclick="deleteCode(\''+c.id+'\')"><i class="fas fa-trash text-[10px]"></i></button>'; f.appendChild(d); }); l.innerHTML=''; l.appendChild(f); }
function deleteCode(id){ showConfirm('Delete Code?','',async()=>{ try { await db.collection('codes').doc(id).delete(); floatToast('Deleted','#dc2626'); } catch(e){ Swal.fire('Error',e.message,'error'); } }); }

/* SETTINGS LOAD */
function loadSettingsUI(d){
  if($('set-site-name')) $('set-site-name').value=d.siteName||'';
  if($('set-tagline')) $('set-tagline').value=d.tagline||'';
  if($('set-user-login-url')) $('set-user-login-url').value=d.userLoginUrl||d.logoUrl||'';
  if($('set-user-logo-url')) $('set-user-logo-url').value=d.userLogoUrl||d.logoUrl||'';
  if($('set-notice')) $('set-notice').value=d.notice||'';
  if($('set-howto-video')) $('set-howto-video').value=d.howToVideo||'';
  if($('set-howto-thumb')) $('set-howto-thumb').value=d.howToThumb||'';
  if($('set-app-link')) $('set-app-link').value=d.appLink||'';
  if($('set-telegram')) $('set-telegram').value=d.telegram||'';
  if($('set-group-link')) $('set-group-link').value=d.groupLink||'';
  if($('set-fb')) $('set-fb').value=d.facebook||'';
  if($('set-insta')) $('set-insta').value=d.instagram||'';
  if($('set-yt')) $('set-yt').value=d.youtube||'';
  if($('set-email')) $('set-email').value=d.email||'';
  if($('set-primary-color')) $('set-primary-color').value=d.primaryColor||'#006a4e';
  if($('set-accent-color')) $('set-accent-color').value=d.accentColor||'#f42a41';
  if($('set-popup-enabled')) $('set-popup-enabled').checked=!!d.popupEnabled;
  if($('set-popup-image')) $('set-popup-image').value=d.popupImage||'';
  if($('set-popup-title')) $('set-popup-title').value=d.popupTitle||'';
  if($('set-popup-desc')) $('set-popup-desc').value=d.popupDesc||'';
  if($('set-popup-link')) $('set-popup-link').value=d.popupLink||'';
  if($('set-wallet-logo')) $('set-wallet-logo').value=d.walletLogo||'';
  if($('set-instant-logo')) $('set-instant-logo').value=d.instantLogo||'';
  updatePreview('preview-wallet-logo',d.walletLogo);
  updatePreview('preview-instant-logo',d.instantLogo);
  updatePreview('preview-popup-image',d.popupImage);
  updatePreview('preview-howto-thumb',d.howToThumb);
  updateLoginPreview(d.userLoginUrl||d.logoUrl);
  updateHomePreview(d.userLogoUrl||d.logoUrl);
}
function updatePreview(boxId,url){ const b=$(boxId); if(!b) return; if(url&&url.trim()){ b.classList.add('has-img'); b.innerHTML='<img src="'+url+'" onerror="this.parentNode.innerHTML=\'<span class=&quot;img-hint&quot;>⚠ Error</span>\'">'; } else { b.classList.remove('has-img'); b.innerHTML='<span class="img-hint"><i class="fas fa-image text-lg mb-1 block"></i>No image set</span>'; } }
function updateLoginPreview(u){ const b=$('preview-login-img'); if(!b) return; if(u){ b.classList.add('has-img'); b.innerHTML='<img src="'+u+'" onerror="this.parentNode.innerHTML=\'<span class=&quot;img-hint&quot;>⚠ Invalid URL</span>\'">'; } else { b.classList.remove('has-img'); b.innerHTML='<span class="img-hint"><i class="fas fa-image text-lg mb-1 block"></i>No image set</span>'; } }
function updateHomePreview(u){ const b=$('preview-home-img'); if(!b) return; if(u){ b.classList.add('has-img'); b.innerHTML='<img src="'+u+'" onerror="this.parentNode.innerHTML=\'<span class=&quot;img-hint&quot;>⚠ Invalid URL</span>\'">'; } else { b.classList.remove('has-img'); b.innerHTML='<span class="img-hint"><i class="fas fa-image text-lg mb-1 block"></i>No logo set</span>'; } }

document.addEventListener('input',(e)=>{
  if(e.target.id==='set-user-login-url') updateLoginPreview(e.target.value.trim());
  else if(e.target.id==='set-user-logo-url') updateHomePreview(e.target.value.trim());
  else if(e.target.id==='set-wallet-logo') updatePreview('preview-wallet-logo',e.target.value.trim());
  else if(e.target.id==='set-instant-logo') updatePreview('preview-instant-logo',e.target.value.trim());
  else if(e.target.id==='set-popup-image') updatePreview('preview-popup-image',e.target.value.trim());
  else if(e.target.id==='set-howto-thumb') updatePreview('preview-howto-thumb',e.target.value.trim());
  else if(e.target.id==='set-logo-bkash') updatePreview('preview-logo-bkash',e.target.value.trim());
  else if(e.target.id==='set-logo-nagad') updatePreview('preview-logo-nagad',e.target.value.trim());
  else if(e.target.id==='set-logo-rocket') updatePreview('preview-logo-rocket',e.target.value.trim());
});

/* SAVE FUNCTIONS */
function saveSiteInfo(){ db.collection('settings').doc('general').set({siteName:$('set-site-name').value.trim(),tagline:$('set-tagline').value.trim()},{merge:true}).then(()=>floatToast('Saved ✓','#10b981')).catch(e=>Swal.fire('Error',e.message,'error')); }
function saveBranding(){ const lu=$('set-user-login-url').value.trim(),hu=$('set-user-logo-url').value.trim(); updateLoginPreview(lu); updateHomePreview(hu); db.collection('settings').doc('general').set({userLoginUrl:lu,userLogoUrl:hu,logoUrl:hu},{merge:true}).then(()=>floatToast('Branding saved ✓','#10b981')).catch(e=>Swal.fire('Error',e.message,'error')); }
function saveAppearance(){ db.collection('settings').doc('general').set({primaryColor:$('set-primary-color').value.trim(),accentColor:$('set-accent-color').value.trim()},{merge:true}).then(()=>floatToast('Theme saved ✓','#10b981')); }
function savePayment(){ db.collection('admin').doc('payment').set({bkash:$('set-bkash').value.trim(),nagad:$('set-nagad').value.trim(),rocket:$('set-rocket').value.trim()},{merge:true}).then(()=>floatToast('Numbers saved ✓','#10b981')); }
function saveLogos(){ const w=$('set-wallet-logo').value.trim(),i=$('set-instant-logo').value.trim(),lb=$('set-logo-bkash').value.trim(),ln=$('set-logo-nagad').value.trim(),lr=$('set-logo-rocket').value.trim(); db.collection('settings').doc('general').set({walletLogo:w,instantLogo:i},{merge:true}).then(()=>db.collection('admin').doc('payment').set({logoBkash:lb,logoNagad:ln,logoRocket:lr},{merge:true})).then(()=>floatToast('All logos saved ✓','#10b981')).catch(e=>Swal.fire('Error',e.message,'error')); }
function saveGeneral(){ db.collection('settings').doc('general').set({notice:$('set-notice').value.trim(),howToVideo:$('set-howto-video').value.trim(),howToThumb:$('set-howto-thumb').value.trim(),appLink:$('set-app-link').value.trim(),email:$('set-email').value.trim()},{merge:true}).then(()=>floatToast('Config saved ✓','#10b981')); }
function saveSocial(){ db.collection('settings').doc('general').set({telegram:$('set-telegram').value.trim(),groupLink:$('set-group-link').value.trim(),facebook:$('set-fb').value.trim(),instagram:$('set-insta').value.trim(),youtube:$('set-yt').value.trim()},{merge:true}).then(()=>floatToast('Social links saved ✓','#10b981')); }
function savePopup(){ db.collection('settings').doc('general').set({popupEnabled:$('set-popup-enabled').checked,popupImage:$('set-popup-image').value.trim(),popupTitle:$('set-popup-title').value.trim(),popupDesc:$('set-popup-desc').value.trim(),popupLink:$('set-popup-link').value.trim()},{merge:true}).then(()=>floatToast('Popup saved ✓','#10b981')); }

function addSupport(){ const n=$('sup-name').value.trim(),l=$('sup-logo').value.trim(),lnk=$('sup-link').value.trim(); if(!n||!l||!lnk) return floatToast('All fields required','#dc2626'); const a=allSupport.concat([{name:n,logo:l,link:lnk}]); db.collection('settings').doc('support').set({items:a},{merge:true}).then(()=>{ $('sup-name').value=''; $('sup-logo').value=''; $('sup-link').value=''; floatToast('Added ✓','#10b981'); }); }
function renderSupport(){ const l=$('support-list'); if(!l) return; if(allSupport.length===0){ l.innerHTML='<p class="text-center text-[10px] text-gray-400 py-2">No support buttons yet</p>'; return; } const f=document.createDocumentFragment(); allSupport.forEach((s,i)=>{ const d=document.createElement('div'); d.className='flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl p-2'; d.innerHTML='<div class="w-9 h-9 rounded-full bg-white flex items-center justify-center border border-gray-200 flex-shrink-0"><img src="'+s.logo+'" class="w-5 h-5 object-contain" onerror="this.src=\'https://placehold.co/40?text=?\'"></div><div class="flex-1 min-w-0"><p class="text-[11.5px] font-extrabold text-[#003d2d] truncate">'+s.name+'</p><p class="text-[10px] text-gray-400 truncate">'+s.link+'</p></div><button type="button" class="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0" onclick="deleteSupport('+i+')"><i class="fas fa-trash text-[10px]"></i></button>'; f.appendChild(d); }); l.innerHTML=''; l.appendChild(f); }
function deleteSupport(i){ showConfirm('Delete Support?','',()=>{ const a=allSupport.slice(); a.splice(i,1); db.collection('settings').doc('support').set({items:a},{merge:true}).then(()=>floatToast('Deleted','#dc2626')); }); }


/* TELEGRAM DUAL ALERTS — token never returned to browser */
async function telegramAdminRequest(action, payload={}) {
  const user = auth.currentUser;
  if (!user) throw new Error('আগে Admin হিসেবে লগইন করুন।');
  const idToken = await user.getIdToken();
  const response = await fetch('/api/telegram/admin', {
    method: 'POST',
    headers: {'Content-Type':'application/json', 'Authorization':'Bearer '+idToken},
    body: JSON.stringify({action, ...payload})
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok || data.ok === false) throw new Error(data.error || 'Telegram request failed');
  return data;
}
async function loadTelegramSettings() {
  try {
    const data = await telegramAdminRequest('get');
    if ($('set-tg-chat1')) $('set-tg-chat1').value = data.chatId1 || '';
    if ($('set-tg-chat2')) $('set-tg-chat2').value = data.chatId2 || '';
    if ($('set-tg-token')) $('set-tg-token').placeholder = data.hasBotToken ? 'Token secure আছে; পরিবর্তন করতে নতুন Token দিন' : 'Bot Token দিন';
    const status = $('tg-token-status');
    if (status) status.textContent = data.hasBotToken ? '✓ Bot Token server-side encrypted অবস্থায় সংরক্ষিত' : 'এখনও Bot Token সেট করা হয়নি';
  } catch (err) {
    const status = $('tg-token-status');
    if (status) status.textContent = 'Settings load হয়নি: ' + err.message;
  }
}
async function saveTelegramSettings() {
  const botToken = ($('set-tg-token')?.value || '').trim();
  const chatId1 = ($('set-tg-chat1')?.value || '').trim();
  const chatId2 = ($('set-tg-chat2')?.value || '').trim();
  if (!chatId1 && !chatId2) return Swal.fire({icon:'warning',title:'Chat ID Required',text:'কমপক্ষে একটি Chat ID দিন।',background:'#14141e',color:'#f3f4f6'});
  Swal.fire({title:'Saving Telegram settings…',didOpen:()=>Swal.showLoading(),allowOutsideClick:false,background:'#14141e',color:'#f3f4f6'});
  try {
    await telegramAdminRequest('save', {botToken, chatId1, chatId2});
    if ($('set-tg-token')) $('set-tg-token').value = '';
    await loadTelegramSettings();
    Swal.fire({icon:'success',title:'Saved!',text:'Telegram Dual Alerts সেটিংস সংরক্ষণ হয়েছে।',timer:1800,showConfirmButton:false,background:'#14141e',color:'#f3f4f6'});
  } catch (err) {
    Swal.fire({icon:'error',title:'Save Failed',text:err.message,background:'#14141e',color:'#f3f4f6'});
  }
}
async function testTelegramTarget(target) {
  const chatId = target === 'chat1' ? ($('set-tg-chat1')?.value || '').trim() : ($('set-tg-chat2')?.value || '').trim();
  const botToken = ($('set-tg-token')?.value || '').trim();
  const label = target === 'chat1' ? 'Chat ID 1 (Admin)' : 'Chat ID 2 (Group/Channel)';
  if (!chatId) return Swal.fire({icon:'warning',title:'Chat ID Required',text:label+' ফাঁকা আছে।',background:'#14141e',color:'#f3f4f6'});
  Swal.fire({title:label+'-এ Test পাঠানো হচ্ছে…',didOpen:()=>Swal.showLoading(),allowOutsideClick:false,background:'#14141e',color:'#f3f4f6'});
  try {
    const result = await telegramAdminRequest('test', {target, chatId, botToken});
    Swal.fire({icon:'success',title:'Test Sent!',text:label+'-এ Telegram test message পাঠানো হয়েছে।',timer:1800,showConfirmButton:false,background:'#14141e',color:'#f3f4f6'});
  } catch (err) {
    Swal.fire({icon:'error',title:'Test Failed',text:err.message,background:'#14141e',color:'#f3f4f6'});
  }
}

/* INIT */
document.addEventListener('DOMContentLoaded',()=>{
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('click',(e)=>{ if(e.target&&e.target.id==='confirm-yes'){ if(typeof confirmCallback==='function') confirmCallback(); closeConfirm(); } });
  setText('dash-revenue','৳ 0');
  updateDashDate();
  resetRankForm();
});
