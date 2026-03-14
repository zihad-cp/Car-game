// main.js — Easy & Beautiful Car Game (3-file version)
// Author: generated for you (user: zihad-cp)
// Features: lane-based easy gameplay, lives, powerups, local top scores, particles, parallax, mute/pause, touch controls
// main.js — Cleaned & fixed start handlers for the Easy & Beautiful Car Game
(() => {
  const USER = 'zihad-cp';
  const HS_KEY = 'carGame_scores_' + USER;

  // Canvas & constants
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width = 1000;
  const H = canvas.height = 620;

  // UI
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const livesEl = document.getElementById('lives');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const howBtn = document.getElementById('howBtn');
  const easyToggle = document.getElementById('easyToggle');
  const pauseBtn = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const restartBtn = document.getElementById('restartBtn');
  const showScoresBtn = document.getElementById('showScores');
  const scoresModal = document.getElementById('scoresModal');
  const scoresList = document.getElementById('scoresList');
  const closeScores = document.getElementById('closeScores');
  const clearScores = document.getElementById('clearScores');

  // Touch
  const touchLeft = document.getElementById('leftBtn');
  const touchUp = document.getElementById('upBtn');
  const touchRight = document.getElementById('rightBtn');

  // State
  let state = 'menu'; // menu, playing, paused, gameover
  let easyMode = true;
  let muted = false;
  let score = 0;
  let lives = 5;
  let bestScores = loadScores();

  // Road / player (lane based)
  const road = { x: W/2 - 200, w: 400, lanes: 3, scroll: 0 };
  const laneCenters = [];
  for (let i = 0; i < road.lanes; i++) laneCenters.push(road.x + (i + 0.5) * (road.w / road.lanes));
  const player = { lane: 1, targetLane: 1, animX: laneCenters[1], y: H - 140, w: 56, h: 98, speed: 2, maxSpeed: 9, inv: false };

  // Entities
  let obstacles = [], powerups = [], particles = [];

  // Input
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' && state !== 'playing') startGame();
    if (e.key.toLowerCase() === 'p') togglePause();
    if (e.key.toLowerCase() === 'm') toggleMute();
    if (e.key.toLowerCase() === 'r') restart();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  // Touch state
  const touchState = { left: false, right: false, up: false };
  function wireTouch(el, keyName){
    if(!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); touchState[keyName] = true; }, {passive:false});
    el.addEventListener('touchend', e => { e.preventDefault(); touchState[keyName] = false; }, {passive:false});
    el.addEventListener('mousedown', ()=> touchState[keyName] = true);
    el.addEventListener('mouseup', ()=> touchState[keyName] = false);
    el.addEventListener('mouseleave', ()=> touchState[keyName] = false);
  }
  wireTouch(touchLeft, 'left');
  wireTouch(touchUp, 'up');
  wireTouch(touchRight, 'right');

  // UI event wiring (safe guards if elements missing)
  if (startBtn) startBtn.addEventListener('click', startGame);
  if (howBtn) howBtn.addEventListener('click', () => alert('Change lanes with ← → or A/D. Hold ↑ / W to get a small speed boost. Collect power-ups: Shield (S), Slow (⌛), Coin (★). You have multiple lives in Easy mode.'));
  if (easyToggle) easyToggle.addEventListener('click', () => { easyMode = !easyMode; easyToggle.textContent = 'Easy: ' + (easyMode ? 'ON' : 'OFF'); playBeep(700,0.06); });
  if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
  if (muteBtn) muteBtn.addEventListener('click', toggleMute);
  if (restartBtn) restartBtn.addEventListener('click', restart);
  if (showScoresBtn) showScoresBtn.addEventListener('click', showScores);
  if (closeScores) closeScores.addEventListener('click', () => scoresModal.classList.add('hidden'));
  if (clearScores) clearScores.addEventListener('click', () => { if (confirm('Clear local top scores?')) { bestScores = []; saveScores(); renderScores(); } });

  // audio context
  const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
  function playBeep(freq=440, dur=0.06, vol=0.06){
    if(!audioCtx || muted) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur + 0.02);
  }

  // storage / scores
  function loadScores(){ try { return JSON.parse(localStorage.getItem(HS_KEY)) || []; } catch(e){ return []; } }
  function saveScores(){ try { localStorage.setItem(HS_KEY, JSON.stringify(bestScores)); } catch(e){} }
  function addScore(s){ bestScores.push({score: Math.floor(s), at: Date.now()}); bestScores.sort((a,b)=> b.score - a.score); bestScores = bestScores.slice(0,10); saveScores(); }

  // helpers
  function rand(a,b){ return Math.random()*(b-a)+a; }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function rectInter(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function circleRectIntersect(cx,cy,r,rect){ const cx0 = clamp(cx, rect.x, rect.x+rect.w); const cy0 = clamp(cy, rect.y, rect.y+rect.h); const dx = cx - cx0; const dy = cy - cy0; return dx*dx + dy*dy <= r*r; }

  // spawn entities
  let lastSpawn = performance.now();
  let lastPower = performance.now();
  function spawnObstacle(now){
    const lane = Math.floor(rand(0, road.lanes));
    const x = laneCenters[lane] + rand(-28,28);
    const w = rand(48,100), h = rand(32,80);
    let speed = rand(1.6, 4.2);
    if(easyMode) speed *= 0.6;
    const kind = Math.random() < 0.08 ? 'truck' : 'car';
    obstacles.push({ x, y: -h - rand(10,220), w, h, speed, kind, color: kind==='truck' ? '#8e44ad' : '#e74c3c' });
    lastSpawn = now;
  }
  function spawnPower(now){
    const types = ['shield','slow','coin'];
    const type = types[Math.floor(rand(0, types.length))];
    const lane = Math.floor(rand(0, road.lanes));
    const x = laneCenters[lane];
    powerups.push({ x, y: -30 - rand(40,240), r:18, type, speed: (easyMode?1.6:2.8) });
    lastPower = now;
  }

  function spawnParticles(x,y,count=12){
    for(let i=0;i<count;i++) particles.push({ x, y, vx: rand(-2,2), vy: rand(-4,-1), life: rand(300,900), t:0, s:rand(2,6) });
  }

  // UI update
  function updateUI(){
    scoreEl && (scoreEl.textContent = 'Score: ' + Math.floor(score));
    bestEl && (bestEl.textContent = 'Best: ' + (bestScores[0] ? bestScores[0].score : 0));
    livesEl && (livesEl.textContent = 'Lives: ' + '♥'.repeat(lives));
  }

  // game control functions
  function startGame(){
    state = 'playing';
    overlay.style.display = 'none';
    score = 0;
    lives = easyMode ? 5 : 3;
    player.lane = Math.floor(road.lanes/2);
    player.targetLane = player.lane;
    player.animX = laneCenters[player.lane];
    player.inv = true;
    setTimeout(()=> player.inv = false, 1200);
    obstacles = []; powerups = []; particles = [];
    lastSpawn = performance.now();
    lastPower = performance.now();
    playBeep(880,0.06); setTimeout(()=> playBeep(1100,0.06),80);
    updateUI();
  }

  function gameOver(){
    state = 'gameover';
    overlay.style.display = 'block';
    document.getElementById('overlay-sub').textContent = `Score: ${Math.floor(score)} — Press SPACE or Start to try again`;
    addScore(score);
    updateUI();
    playBeep(220,0.12);
  }

  function restart(){ startGame(); }
  function togglePause(){ if(state === 'playing'){ state = 'paused'; overlay.style.display = 'block'; document.getElementById('overlay-sub').textContent = 'Paused — press P to resume'; } else if(state === 'paused'){ state = 'playing'; overlay.style.display = 'none'; } }
  function toggleMute(){ muted = !muted; muteBtn && (muteBtn.textContent = muted ? '🔇' : '🔊'); playBeep(400,0.06); }
  function showScores(){ renderScores(); scoresModal && scoresModal.classList.remove('hidden'); }
  function renderScores(){ if(!scoresList) return; scoresList.innerHTML = ''; if(bestScores.length === 0){ scoresList.innerHTML = '<li style="color:#bfc8d6">No scores yet</li>'; return; } bestScores.forEach(s => { const li = document.createElement('li'); li.textContent = `${s.score} — ${new Date(s.at).toLocaleString()}`; scoresList.appendChild(li); }); }

  // unlock audio on first user interaction
  function unlockAudio(){
    if(!audioCtx) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  }
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);

  // main loop
  let lastTs = 0;
  function loop(ts){
    if(!lastTs) lastTs = ts;
    const dt = Math.min(40, ts - lastTs);
    if(state === 'playing') update(dt, ts);
    draw(dt, ts);
    lastTs = ts;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // update & draw functions
  function update(dt, ts){
    const dtS = dt / 1000;
    const left = keys['arrowleft'] || keys['a'] || touchState.left;
    const right = keys['arrowright'] || keys['d'] || touchState.right;
    const up = keys['arrowup'] || keys['w'] || touchState.up;

    if(left && player.targetLane > 0){ player.targetLane--; playBeep(640); touchState.left=false; keys['arrowleft']=false; keys['a']=false; }
    if(right && player.targetLane < road.lanes-1){ player.targetLane++; playBeep(640); touchState.right=false; keys['arrowright']=false; keys['d']=false; }

    // smooth lane movement
    const tx = laneCenters[player.targetLane];
    player.animX += (tx - player.animX) * clamp(12 * dtS, 0, 1);

    // speed control
    if(up){ player.speed += 0.12 * dtS * 60; } else { player.speed -= 0.24 * dtS * 60; }
    player.speed = clamp(player.speed, 1.6, player.maxSpeed);

    road.scroll += (player.speed + 3) * dtS * (easyMode ? 18 : 26);

    // spawn
    const now = performance.now();
    const obstacleInterval = easyMode ? 900 : 700;
    if(now - lastSpawn > obstacleInterval) spawnObstacle(now);
    const powerInterval = easyMode ? 8000 : 12000;
    if(now - lastPower > powerInterval && Math.random() < 0.6) spawnPower(now);

    // obstacles update & collision
    for(let i=obstacles.length-1;i>=0;i--){
      const o = obstacles[i]; o.y += o.speed * dtS * 60;
      const carRect = { x: player.animX - player.w/2 + 6, y: player.y - player.h/2 + 6, w: player.w - 12, h: player.h - 12 };
      const obRect = { x: o.x - o.w/2, y: o.y - o.h/2, w: o.w, h: o.h };
      if(!player.inv && rectInter(carRect, obRect)){
        spawnParticles(player.animX, player.y, 20);
        playBeep(220,0.08);
        lives--; player.inv = true; setTimeout(()=> player.inv = false, 1400);
        obstacles.splice(i,1);
        if(lives <= 0){ gameOver(); return; }
      } else if(o.y - o.h > H + 60){ score += 2; obstacles.splice(i,1); }
    }

    // powerups update & collect
    for(let i=powerups.length-1;i>=0;i--){
      const p = powerups[i]; p.y += p.speed * dtS * 60;
      const rect = { x: player.animX - player.w/2, y: player.y - player.h/2, w: player.w, h: player.h };
      if(circleRectIntersect(p.x, p.y, p.r, rect)){
        if(p.type === 'shield'){ player.inv = true; setTimeout(()=> player.inv = false, 4500); playBeep(1000,0.08); }
        else if(p.type === 'slow'){ obstacles.forEach(o=>o.speed *= 0.6); setTimeout(()=> obstacles.forEach(o=>o.speed /= 0.6), 4500); playBeep(740,0.08); }
        else if(p.type === 'coin'){ score += 25; playBeep(1200,0.06); }
        spawnParticles(p.x, p.y, 12); powerups.splice(i,1);
      } else if(p.y - p.r > H + 40) powerups.splice(i,1);
    }

    // particles
    for(let i=particles.length-1;i>=0;i--){
      const pt = particles[i]; pt.t += dt;
      pt.x += pt.vx * dtS * 60; pt.y += pt.vy * dtS * 60 + 0.8 * dtS * 60;
      if(pt.t > pt.life) particles.splice(i,1);
    }

    // scoring
    score += (player.speed / 3 + 0.5) * dtS * 6;
    updateUI();
  }

  function draw(dt, ts){
    ctx.clearRect(0,0,W,H);
    // background
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#071021'); g.addColorStop(1,'#071427');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    drawParallax(ts); drawRoad(); drawLanes(ts);
    powerups.forEach(drawPowerup); obstacles.forEach(drawObstacle);
    drawPlayer(); drawParticles();

    // overlay visibility
    if(state === 'menu' || state === 'paused' || state === 'gameover') overlay.style.display = 'block';
    else overlay.style.display = 'none';
  }

  function drawParallax(ts){
    const count = 10;
    for(let i=0;i<count;i++){
      const baseX = (i/count) * W;
      const offset = (road.scroll * 0.2 + i*140) % (W*2) - W;
      const x = baseX + offset * 0.3;
      const y = H - 300 - (i%3)*8;
      ctx.globalAlpha = 0.12 + (i%2)*0.06;
      ctx.fillStyle = i%2===0 ? '#184b2c' : '#163b2a';
      ctx.beginPath(); ctx.ellipse(x, y, 40 + (i%4)*10, 70 + (i%3)*8, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRoad(){
    const grd = ctx.createLinearGradient(0,0,0,H); grd.addColorStop(0,'#34373b'); grd.addColorStop(1,'#1f2123');
    ctx.fillStyle = grd; roundRectFill(road.x, 0, road.w, H, 20);
    ctx.fillStyle = '#0f1113'; roundRectFill(road.x - 64, 0, 64, H, 8); roundRectFill(road.x + road.w, 0, 64, H, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(road.x + 10, 0, 6, H); ctx.fillRect(road.x + road.w - 16, 0, 6, H);
  }

  function drawLanes(ts){
    const laneW = road.w / road.lanes;
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.setLineDash([40,36]);
    ctx.lineDashOffset = - (road.scroll % 80);
    for(let i=1;i<road.lanes;i++){ const lx = road.x + i*laneW; ctx.beginPath(); ctx.moveTo(lx, -20); ctx.lineTo(lx, H + 20); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  function drawPlayer(){
    const x = player.animX, y = player.y;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRectFill(x - player.w/2 + 10, y - player.h/2 + player.h*0.5 + 8, player.w, player.h*0.55, 12);
    const g = ctx.createLinearGradient(x - player.w/2, y - player.h/2, x + player.w/2, y + player.h/2);
    g.addColorStop(0, '#ffcf55'); g.addColorStop(1, '#ff9a1a'); ctx.fillStyle = g; roundRectFill(x - player.w/2, y - player.h/2, player.w, player.h, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; roundRectFill(x - player.w/2 + 12, y - player.h/2 + 16, player.w - 24, 26, 6);
    if(player.inv){ ctx.fillStyle = 'rgba(255,255,255,0.06)'; roundRectFill(x - player.w/2, y - player.h/2, player.w, player.h, 14); }
  }

  function drawObstacle(o){ const x = o.x, y = o.y; ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRectFill(x - o.w/2 + 6, y - o.h/2 + o.h*0.5 + 6, o.w, o.h*0.5, 8); ctx.fillStyle = o.color; roundRectFill(x - o.w/2, y - o.h/2, o.w, o.h, 10); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x - o.w/2 + 6, y - o.h/2 + 6, Math.max(8, o.w * 0.26), 6); }

  function drawPowerup(p){ ctx.save(); ctx.globalAlpha = 0.98; ctx.beginPath(); ctx.fillStyle = p.type === 'shield' ? '#6ae3ff' : (p.type === 'slow' ? '#ffcc00' : '#7cffb0'); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#042'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let ch='?'; if(p.type==='shield') ch='S'; if(p.type==='slow') ch='⌛'; if(p.type==='coin') ch='★'; ctx.fillText(ch, p.x, p.y+1); ctx.restore(); }

  function drawParticles(){ for(const pt of particles){ const lifeRatio = 1 - pt.t/pt.life; ctx.fillStyle = `rgba(255,255,255,${0.12 * lifeRatio})`; ctx.beginPath(); ctx.ellipse(pt.x, pt.y, pt.s * (0.6 + lifeRatio*0.8), pt.s * 0.6, 0, 0, Math.PI*2); ctx.fill(); } }

  function roundRectFill(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); ctx.fill(); }

  // start on canvas click/tap too
  canvas.addEventListener('mousedown', ()=> { if(state !== 'playing') startGame(); });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); if(state !== 'playing') startGame(); }, {passive:false});

  // initial UI
  easyToggle && (easyToggle.textContent = 'Easy: ' + (easyMode ? 'ON' : 'OFF'));
  muteBtn && (muteBtn.textContent = muted ? '🔇' : '🔊');
  updateUI();
})();
(() => {
  // Use user's login for local storage key
  const USER = 'zihad-cp';
  const HS_KEY = 'carGame_scores_' + USER;

  // Canvas & rendering
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width = 1000;
  const H = canvas.height = 620;

  // UI elements
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const livesEl = document.getElementById('lives');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const easyToggle = document.getElementById('easyToggle');
  const pauseBtn = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const restartBtn = document.getElementById('restartBtn');
  const showScoresBtn = document.getElementById('showScores');
  const scoresModal = document.getElementById('scoresModal');
  const scoresList = document.getElementById('scoresList');
  const closeScores = document.getElementById('closeScores');
  const clearScores = document.getElementById('clearScores');

  // Touch buttons
  const leftBtn = document.getElementById('leftBtn');
  const upBtn = document.getElementById('upBtn');
  const rightBtn = document.getElementById('rightBtn');

  // Game state
  let state = 'menu'; // 'menu', 'playing', 'paused', 'gameover'
  let easyMode = true;
  let muted = false;
  let score = 0;
  let lives = 5;
  let bestScores = loadScores();

  // Road & player (lane-based)
  const road = { x: W/2 - 200, w: 400, lanes: 3, scroll: 0 };
  const laneCenters = [];
  for (let i = 0; i < road.lanes; i++) laneCenters.push(road.x + (i + 0.5) * (road.w / road.lanes));

  const player = {
    lane: 1, // 0..lanes-1
    targetLane: 1,
    x: laneCenters[1],
    y: H - 140,
    w: 56, h: 98,
    animX: laneCenters[1],
    speed: 2,
    maxSpeed: 9,
    inv: false
  };

  // Entities
  let obstacles = [];
  let powerups = [];
  let particles = [];

  // Input
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' && state !== 'playing') startGame();
    if (e.key.toLowerCase() === 'p') togglePause();
    if (e.key.toLowerCase() === 'm') toggleMute();
    if (e.key.toLowerCase() === 'r') restart();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  // Touch button wiring
  const touchState = { left: false, right: false, up: false };
  [['leftBtn','left'],['rightBtn','right'],['upBtn','up']].forEach(([id,map])=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('touchstart', e=>{ e.preventDefault(); touchState[map]=true; }, {passive:false});
    el.addEventListener('touchend', e=>{ e.preventDefault(); touchState[map]=false; }, {passive:false});
    el.addEventListener('mousedown', ()=> touchState[map]=true);
    el.addEventListener('mouseup', ()=> touchState[map]=false);
    el.addEventListener('mouseleave', ()=> touchState[map]=false);
  });

  // Buttons
  startBtn.addEventListener('click', startGame);
  document.getElementById('howBtn').addEventListener('click', ()=> alert('Change lanes with ← → or A/D. Hold ↑ / W to get a small speed boost. Collect power-ups: Shield (S), Slow (⌛), Coin (★). You have multiple lives in Easy mode.'));
  easyToggle.addEventListener('click', ()=> { easyMode = !easyMode; easyToggle.textContent = 'Easy: ' + (easyMode ? 'ON' : 'OFF'); playBeep(700,0.06); });
  pauseBtn.addEventListener('click', togglePause);
  muteBtn.addEventListener('click', toggleMute);
  restartBtn.addEventListener('click', restart);
  showScoresBtn.addEventListener('click', showScores);
  closeScores.addEventListener('click', ()=> scoresModal.classList.add('hidden'));
  clearScores.addEventListener('click', ()=> { if(confirm('Clear local top scores?')) { bestScores = []; saveScores(); renderScores(); } });

  // small helper to play beep sounds
  const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
  function playBeep(freq=440, dur=0.06, vol=0.06){
    if(!audioCtx || muted) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur + 0.02);
  }

  // Spawn logic
  let lastObstacleAt = 0;
  let lastPowerAt = 0;
  function spawnObstacle(now){
    const lane = Math.floor(rand(0, road.lanes));
    const x = laneCenters[lane] + rand(-28, 28);
    const w = rand(48, 100); const h = rand(32, 80);
    let speed = rand(1.6, 4.2);
    if (easyMode) speed *= 0.6;
    const kind = Math.random() < 0.08 ? 'truck' : 'car';
    obstacles.push({ x, y: -h - rand(10, 200), w, h, speed, kind, color: kind==='truck' ? '#8e44ad' : '#e74c3c' });
    lastObstacleAt = now;
  }
  function spawnPower(now){
    const types = ['shield','slow','coin'];
    const type = types[Math.floor(rand(0, types.length))];
    const lane = Math.floor(rand(0, road.lanes));
    const x = laneCenters[lane];
    powerups.push({ x, y: -30 - rand(40, 160), r:18, type, speed: (easyMode?1.6:2.8) });
    lastPowerAt = now;
  }

  // Utilities
  function rand(a,b){ return Math.random()*(b-a)+a; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function rectInter(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

  // Particles
  function spawnParticles(x,y,count=12,color='rgba(255,255,255,0.08)'){
    for(let i=0;i<count;i++){
      particles.push({ x, y, vx: rand(-2,2), vy: rand(-4,-1), life: rand(300,900), t:0, s:rand(2,6), color });
    }
  }

  // Score storage (local top 5)
  function loadScores(){
    try{
      const raw = localStorage.getItem(HS_KEY);
      if(!raw) return [];
      return JSON.parse(raw);
    }catch(e){ return []; }
  }
  function saveScores(){
    localStorage.setItem(HS_KEY, JSON.stringify(bestScores.slice(0,10)));
  }
  function addScore(val){
    const entry = { score: Math.floor(val), at: Date.now() };
    bestScores.push(entry);
    bestScores.sort((a,b)=> b.score - a.score);
    bestScores = bestScores.slice(0,10);
    saveScores();
  }
  function renderScores(){
    scoresList.innerHTML = '';
    if(bestScores.length === 0){
      scoresList.innerHTML = '<li style="color:var(--muted)">No scores yet — play to add your score</li>';
      return;
    }
    bestScores.forEach(s=>{
      const d = new Date(s.at);
      const li = document.createElement('li');
      li.textContent = `${s.score} — ${d.toLocaleString()}`;
      scoresList.appendChild(li);
    });
  }

  // UI helpers
  function updateUI(){
    scoreEl.textContent = 'Score: ' + Math.floor(score);
    bestEl.textContent = 'Best: ' + (bestScores[0] ? bestScores[0].score : 0);
    livesEl.textContent = 'Lives: ' + '♥'.repeat(lives);
  }

  function showScores(){
    renderScores();
    scoresModal.classList.remove('hidden');
  }

  // Game control functions
  function startGame(){
    state = 'playing';
    overlay.style.display = 'none';
    score = 0;
    lives = easyMode ? 5 : 3;
    player.lane = Math.floor(road.lanes/2);
    player.targetLane = player.lane;
    player.animX = laneCenters[player.lane];
    player.inv = true;
    setTimeout(()=> player.inv = false, 1200);
    obstacles = []; powerups = []; particles = [];
    lastObstacleAt = performance.now();
    lastPowerAt = performance.now();
    playBeepSequence();
    updateUI();
  }
  function gameOver(){
    state = 'gameover';
    overlay.style.display = 'block';
    document.getElementById('overlay-sub').textContent = `Score: ${Math.floor(score)} — Press SPACE or Start to play again`;
    addScore(score);
    updateUI();
  }
  function restart(){
    startGame();
  }
  function togglePause(){
    if(state === 'playing'){ state = 'paused'; overlay.style.display = 'block'; document.getElementById('overlay-sub').textContent = 'Paused — press P to resume'; }
    else if(state === 'paused') { state = 'playing'; overlay.style.display = 'none'; }
  }
  function toggleMute(){ muted = !muted; muteBtn.textContent = muted ? '🔇' : '🔊'; playBeep(400,0.06); }

  // Beep intro
  function playBeepSequence(){
    playBeep(880,0.06); setTimeout(()=>playBeep(1100,0.06),80);
  }

  // Update loop
  let lastTs = 0;
  function loop(ts){
    if(!lastTs) lastTs = ts;
    const dt = Math.min(40, ts - lastTs);
    if(state === 'playing') update(dt, ts);
    draw(dt, ts);
    lastTs = ts;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Update when playing
  function update(dt, ts){
    const dtS = dt/1000;

    // Controls: combine keyboard + touchState
    const left = keys['arrowleft'] || keys['a'] || touchState.left;
    const right = keys['arrowright'] || keys['d'] || touchState.right;
    const up = keys['arrowup'] || keys['w'] || touchState.up;

    if(left && player.targetLane > 0){ player.targetLane = Math.max(0, player.targetLane - 1); playBeep(600,0.05); touchState.left=false; keys['arrowleft']=false; keys['a']=false; }
    if(right && player.targetLane < road.lanes-1){ player.targetLane = Math.min(road.lanes-1, player.targetLane + 1); playBeep(600,0.05); touchState.right=false; keys['arrowright']=false; keys['d']=false; }

    // lane interpolation (smooth)
    const tx = laneCenters[player.targetLane];
    player.animX += (tx - player.animX) * clamp(10 * dtS, 0, 1);

    // speed control: pressing up gives a small speed boost
    if(up){ player.speed += 0.14 * dtS * 60; } else { player.speed -= 0.2 * dtS * 60; }
    player.speed = clamp(player.speed, 1.6, player.maxSpeed);

    road.scroll += (player.speed + 2.5) * dtS * (easyMode ? 18 : 26);

    // spawn obstacles slower in easy mode
    const obstacleInterval = easyMode ? 900 : 700;
    if(ts - lastObstacleAt > obstacleInterval){
      spawnObstacle(ts);
    }

    // spawn powerups occasionally
    const powerInterval = easyMode ? 8000 : 12000;
    if(ts - lastPowerAt > powerInterval && Math.random() < 0.6){
      spawnPower(ts);
    }

    // update obstacles
    for(let i=obstacles.length-1;i>=0;i--){
      const o = obstacles[i];
      o.y += o.speed * dtS * 60;
      const carRect = { x: player.animX - player.w/2 + 6, y: player.y - player.h/2 + 6, w: player.w - 12, h: player.h - 12 }; // forgiving box
      const obRect = { x: o.x - o.w/2, y: o.y - o.h/2, w: o.w, h: o.h };
      if(!player.inv && rectInter(carRect, obRect)){
        // hit
        spawnParticles(player.animX, player.y, 20);
        playBeep(220,0.08);
        lives--;
        player.inv = true;
        setTimeout(()=> player.inv = false, 1400);
        obstacles.splice(i,1);
        if(lives <= 0){ gameOver(); return; }
      } else if(o.y - o.h > H + 40){
        // passed — reward small score
        score += 2;
        obstacles.splice(i,1);
      }
    }

    // update powerups
    for(let i=powerups.length-1;i>=0;i--){
      const p = powerups[i];
      p.y += p.speed * dtS * 60;
      const carRect = { x: player.animX - player.w/2, y: player.y - player.h/2, w: player.w, h: player.h };
      if(circleRectIntersect(p.x, p.y, p.r, carRect)){
        if(p.type === 'shield'){
          player.inv = true;
          setTimeout(()=> player.inv = false, 4500);
          playBeep(1000,0.08);
        } else if(p.type === 'slow'){
          obstacles.forEach(o=>o.speed *= 0.6);
          setTimeout(()=> obstacles.forEach(o=>o.speed /= 0.6), 4500);
          playBeep(750,0.08);
        } else if(p.type === 'coin'){
          score += 25; playBeep(1200,0.06);
        }
        spawnParticles(p.x, p.y, 12);
        powerups.splice(i,1);
      } else if(p.y - p.r > H + 40){
        powerups.splice(i,1);
      }
    }

    // particles update
    for(let i=particles.length-1;i>=0;i--){
      const pt = particles[i];
      pt.t += dt;
      pt.x += pt.vx * dtS * 60;
      pt.y += pt.vy * dtS * 60 + 0.8 * dtS * 60;
      if(pt.t > pt.life) particles.splice(i,1);
    }

    // score accrues over time
    score += (player.speed / 3 + 0.5) * dtS * 6;

    updateUI();
  }

  // Drawing
  function draw(dt, ts){
    // clear
    ctx.clearRect(0,0,W,H);

    // background gradient
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#071021');
    g.addColorStop(1,'#071427');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // parallax roadside shapes
    drawParallax(ts);

    // road
    drawRoad();

    // lanes dashed lines
    drawLanes(ts);

    // powerups
    powerups.forEach(drawPowerup);

    // obstacles
    obstacles.forEach(drawObstacle);

    // player
    drawPlayer();

    // particles
    drawParticles();

    // overlay menu if needed
    if(state === 'menu'){
      overlay.style.display = 'block';
    } else if(state === 'playing'){
      overlay.style.display = 'none';
    } else if(state === 'paused'){
      overlay.style.display = 'block';
    } else if(state === 'gameover'){
      overlay.style.display = 'block';
    }
  }

  function drawParallax(ts){
    // draw simple rounded hills/trees for depth
    const count = 10;
    for(let i=0;i<count;i++){
      const baseX = (i/count) * W;
      const offset = (road.scroll * 0.2 + i*140) % (W*2) - W;
      const x = baseX + offset * 0.3;
      const y = H - 300 - (i%3)*8;
      ctx.globalAlpha = 0.12 + (i%2)*0.06;
      ctx.fillStyle = i%2===0 ? '#184b2c' : '#163b2a';
      ctx.beginPath();
      ctx.ellipse(x, y, 40 + (i%4)*10, 70 + (i%3)*8, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRoad(){
    // base
    const grd = ctx.createLinearGradient(0,0,0,H);
    grd.addColorStop(0, '#34373b'); grd.addColorStop(1, '#1f2123');
    ctx.fillStyle = grd;
    roundRectFill(road.x, 0, road.w, H, 20);

    // gutters
    ctx.fillStyle = '#0f1113';
    roundRectFill(road.x - 64, 0, 64, H, 8);
    roundRectFill(road.x + road.w, 0, 64, H, 8);

    // edge shine
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(road.x + 10, 0, 6, H);
    ctx.fillRect(road.x + road.w - 16, 0, 6, H);
  }

  function drawLanes(ts){
    const laneW = road.w / road.lanes;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.setLineDash([40,36]);
    ctx.lineDashOffset = - (road.scroll % 80);
    for(let i=1;i<road.lanes;i++){
      const lx = road.x + i*laneW;
      ctx.beginPath();
      ctx.moveTo(lx, -20);
      ctx.lineTo(lx, H + 20);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawPlayer(){
    const x = player.animX, y = player.y;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRectFill(x - player.w/2 + 10, y - player.h/2 + player.h*0.5 + 8, player.w, player.h*0.55, 12);

    // body gradient
    const g = ctx.createLinearGradient(x - player.w/2, y - player.h/2, x + player.w/2, y + player.h/2);
    g.addColorStop(0, '#ffcf55'); g.addColorStop(1, '#ff9a1a');
    ctx.fillStyle = g;
    roundRectFill(x - player.w/2, y - player.h/2, player.w, player.h, 14);

    // windows
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRectFill(x - player.w/2 + 12, y - player.h/2 + 16, player.w - 24, 26, 6);

    if(player.inv){
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRectFill(x - player.w/2, y - player.h/2, player.w, player.h, 14);
    }
  }

  function drawObstacle(o){
    const x = o.x, y = o.y;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRectFill(x - o.w/2 + 6, y - o.h/2 + o.h*0.5 + 6, o.w, o.h*0.5, 8);

    ctx.fillStyle = o.color;
    roundRectFill(x - o.w/2, y - o.h/2, o.w, o.h, 10);

    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x - o.w/2 + 6, y - o.h/2 + 6, Math.max(8, o.w * 0.26), 6);
  }

  function drawPowerup(p){
    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.beginPath();
    ctx.fillStyle = p.type === 'shield' ? '#6ae3ff' : (p.type === 'slow' ? '#ffcc00' : '#7cffb0');
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#042';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let ch = '?';
    if(p.type === 'shield') ch = 'S';
    if(p.type === 'slow') ch = '⌛';
    if(p.type === 'coin') ch = '★';
    ctx.fillText(ch, p.x, p.y+1);
    ctx.restore();
  }

  function drawParticles(){
    for(const pt of particles){
      const lifeRatio = 1 - pt.t/pt.life;
      ctx.fillStyle = `rgba(255,255,255,${0.12 * lifeRatio})`;
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y, pt.s * (0.6 + lifeRatio*0.8), pt.s * 0.6, 0, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // helpers for drawing
  function roundRectFill(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    ctx.fill();
  }

  // collision helpers
  function circleRectIntersect(cx,cy,r, rect){
    const closestX = clamp(cx, rect.x, rect.x+rect.w);
    const closestY = clamp(cy, rect.y, rect.y+rect.h);
    const dx = cx - closestX; const dy = cy - closestY;
    return dx*dx + dy*dy <= r*r;
  }

  // Utility: update UI
  function updateUI(){
    document.getElementById('score').textContent = 'Score: ' + Math.floor(score);
    document.getElementById('best').textContent = 'Best: ' + (bestScores[0] ? bestScores[0].score : 0);
    document.getElementById('lives').textContent = 'Lives: ' + '♥'.repeat(lives);
  }

  // Load initial UI
  updateUI();

  // Game loop starter
  let lastTs = 0;
  function frame(ts){
    if(!lastTs) lastTs = ts;
    const dt = Math.min(40, ts - lastTs);
    if(state === 'playing') update(dt, ts);
    draw(dt, ts);
    lastTs = ts;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // helpers for obstacle/power spawn timing
  let lastSpawn = performance.now();
  let lastPower = performance.now();

  // Update implementation (separate to avoid huge function)
  function update(dt, ts){
    const dtS = dt/1000;

    // Controls: combine keyboard + touchState
    const left = keys['arrowleft'] || keys['a'] || touchState.left;
    const right = keys['arrowright'] || keys['d'] || touchState.right;
    const up = keys['arrowup'] || keys['w'] || touchState.up;

    if(left && player.targetLane > 0){ player.targetLane--; playBeep(640); touchState.left=false; keys['arrowleft']=false; keys['a']=false; }
    if(right && player.targetLane < road.lanes-1){ player.targetLane++; playBeep(640); touchState.right=false; keys['arrowright']=false; keys['d']=false; }

    // smooth lane transition
    const tx = laneCenters[player.targetLane];
    player.animX += (tx - player.animX) * clamp(12 * dtS, 0, 1);

    // speed (small boost)
    if(up){ player.speed += 0.12 * dtS * 60; } else { player.speed -= 0.24 * dtS * 60; }
    player.speed = clamp(player.speed, 1.6, player.maxSpeed);

    road.scroll += (player.speed + 3) * dtS * (easyMode ? 18 : 26);

    const now = performance.now();
    const obstacleInterval = easyMode ? 900 : 700;
    if(now - lastSpawn > obstacleInterval){
      spawnObstacle(now);
      lastSpawn = now;
    }
    const powerInterval = easyMode ? 8000 : 12000;
    if(now - lastPower > powerInterval && Math.random() < 0.6){
      spawnPower(now);
      lastPower = now;
    }

    // update obstacles
    for(let i=obstacles.length-1;i>=0;i--){
      const o = obstacles[i];
      o.y += o.speed * dtS * 60;
      const carRect = { x: player.animX - player.w/2 + 6, y: player.y - player.h/2 + 6, w: player.w - 12, h: player.h - 12 };
      const obRect = { x: o.x - o.w/2, y: o.y - o.h/2, w: o.w, h: o.h };
      if(!player.inv && rectInter(carRect, obRect)){
        // collision
        spawnParticles(player.animX, player.y, 20);
        playBeep(220,0.08);
        lives--;
        player.inv = true;
        setTimeout(()=> player.inv = false, 1400);
        obstacles.splice(i,1);
        if(lives <= 0){ gameOver(); return; }
      } else if(o.y - o.h > H + 60){
        // passed — small reward
        score += 2;
        obstacles.splice(i,1);
      }
    }

    // update powerups
    for(let i=powerups.length-1;i>=0;i--){
      const p = powerups[i];
      p.y += p.speed * dtS * 60;
      const rect = { x: player.animX - player.w/2, y: player.y - player.h/2, w: player.w, h: player.h };
      if(circleRectIntersect(p.x, p.y, p.r, rect)){
        // collect
        if(p.type === 'shield'){ player.inv = true; setTimeout(()=> player.inv = false, 4500); playBeep(1000,0.08); }
        else if(p.type === 'slow'){ obstacles.forEach(o=>o.speed *= 0.6); setTimeout(()=> obstacles.forEach(o=>o.speed /= 0.6), 4500); playBeep(740,0.08); }
        else if(p.type === 'coin'){ score += 25; playBeep(1200,0.06); }
        spawnParticles(p.x, p.y, 12);
        powerups.splice(i,1);
      } else if(p.y - p.r > H + 40) powerups.splice(i,1);
    }

    // particles
    for(let i=particles.length-1;i>=0;i--){
      const pt = particles[i];
      pt.t += dt;
      pt.x += pt.vx * dtS * 60;
      pt.y += pt.vy * dtS * 60 + 0.8 * dtS * 60;
      if(pt.t > pt.life) particles.splice(i,1);
    }

    // incremental score
    score += (player.speed / 3 + 0.5) * dtS * 6;

    updateUI();
  }

  // helpers for collision
  function rectInter(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  // spawn functions (used above)
  function spawnObstacle(now){
    const lane = Math.floor(rand(0, road.lanes));
    const x = laneCenters[lane] + rand(-28, 28);
    const w = rand(48, 100); const h = rand(32, 80);
    let speed = rand(1.6, 4.2);
    if (easyMode) speed *= 0.6;
    const kind = Math.random() < 0.08 ? 'truck' : 'car';
    obstacles.push({ x, y: -h - rand(10, 220), w, h, speed, kind, color: kind==='truck' ? '#8e44ad' : '#e74c3c' });
    lastSpawn = now;
  }
  function spawnPower(now){
    const types = ['shield','slow','coin'];
    const type = types[Math.floor(rand(0, types.length))];
    const lane = Math.floor(rand(0, road.lanes));
    const x = laneCenters[lane];
    powerups.push({ x, y: -30 - rand(40, 240), r:18, type, speed: (easyMode?1.6:2.8) });
    lastPower = now;
  }

  // small helpers
  function spawnParticles(x,y,count=12,color='rgba(255,255,255,0.08)'){
    for(let i=0;i<count;i++){
      particles.push({ x, y, vx: rand(-2,2), vy: rand(-4,-1), life: rand(300,900), t:0, s:rand(2,6), color });
    }
  }

  // small wrapper beep
  function playBeep(freq=440, dur=0.06){
    if(!audioCtx || muted) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.value = 0.06;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur + 0.02);
  }

  // simple alert beep
  function playBeepSimple(freq,dur){ playBeep(freq,dur); }

  // render scores modal content
  function renderScores(){
    scoresList.innerHTML = '';
    if(bestScores.length === 0){
      scoresList.innerHTML = '<li style="color:#bfc8d6">No scores yet</li>';
      return;
    }
    bestScores.forEach(s=>{
      const li = document.createElement('li');
      li.textContent = `${s.score} — ${new Date(s.at).toLocaleString()}`;
      scoresList.appendChild(li);
    });
  }

  // initial UI set
  easyToggle.textContent = 'Easy: ' + (easyMode ? 'ON' : 'OFF');
  muteBtn.textContent = muted ? '🔇' : '🔊';
  updateUI();

  // Save best scores on game over
  function gameOver(){
    state = 'gameover';
    overlay.style.display = 'block';
    document.getElementById('overlay-sub').textContent = `Score: ${Math.floor(score)} — Press SPACE or Start to try again`;
    bestScores.push({ score: Math.floor(score), at: Date.now() });
    bestScores.sort((a,b)=> b.score - a.score);
    bestScores = bestScores.slice(0, 10);
    saveScores();
    renderScores();
    updateUI();
    playBeep(200,0.12);
  }

  // expose a restart alias used by UI
  function restart(){ startGame(); }

  // save / load wrappers
  function saveScores(){ localStorage.setItem(HS_KEY, JSON.stringify(bestScores)); }

  // window focus resume audio context on first interaction (for browsers)
  function unlockAudio(){
    if(!audioCtx) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  }
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);

  // initial render of saved scores
  renderScores();

  // Final note: expose some functions for debugging in console (optional)
  window._carGame = { startGame, restart, showScores, bestScores };

})();
