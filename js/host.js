const hostData = JSON.parse(sessionStorage.getItem('hostData') || 'null');
if (!hostData) {
  alert('Сначала запустите квиз из личного кабинета');
  location.href = '/dashboard.html';
}

const socket = io();
let currentTimerInterval = null;

socket.emit('host:join', {
  sessionId: hostData.sessionId,
  roomCode: hostData.roomCode
});

socket.on('host:ready', (data) => {
  document.getElementById('quizTitle').textContent = data.quizTitle;
  document.getElementById('roomCode').textContent = hostData.roomCode;
});

socket.on('host:playerJoined', (data) => {
  document.getElementById('playersCount').textContent = data.playersCount;
  document.getElementById('playersList').innerHTML = data.players
    .map(p => `<div class="player-chip">${escapeHtml(p.name)}</div>`).join('');
  document.getElementById('startBtn').disabled = data.playersCount === 0;
});

socket.on('error', (data) => {
  alert(data.message);
  location.href = '/dashboard.html';
});

document.getElementById('startBtn').addEventListener('click', () => {
  socket.emit('host:start', { roomCode: hostData.roomCode });
});

document.getElementById('nextBtn').addEventListener('click', () => {
  socket.emit('host:next', { roomCode: hostData.roomCode });
});

socket.on('game:question', (q) => {
  showScreen('questionScreen');
  document.getElementById('qIndex').textContent = q.index + 1;
  document.getElementById('qTotal').textContent = q.total;
  document.getElementById('questionText').textContent = q.text;
  document.getElementById('totalPlayers').textContent =
    document.getElementById('playersCount').textContent;
  document.getElementById('answersCount').textContent = '0';

  const img = document.getElementById('questionImage');
  if (q.imageUrl) {
    img.src = q.imageUrl;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }

  startTimer(q.timeLimit);
});

socket.on('game:reveal', (data) => {
  if (currentTimerInterval) clearInterval(currentTimerInterval);
  showScreen('revealScreen');
  document.getElementById('questionStats').innerHTML = `
    ✅ Правильных: <strong>${data.stats.correct}</strong> / ${data.stats.answered} ответивших из ${data.stats.total}
  `;
  document.getElementById('revealLeaderboard').innerHTML = data.leaderboard
    .map(p => `
      <div class="leaderboard-row">
        <span>#${p.rank} ${escapeHtml(p.name)}</span>
        <span><strong>${p.score}</strong> очков</span>
      </div>
    `).join('');
  document.getElementById('nextBtn').textContent = data.isLast ? '🏆 Показать финальный результат' : 'Следующий вопрос →';
});

socket.on('game:finished', (data) => {
  showScreen('finalScreen');
  document.getElementById('finalLeaderboard').innerHTML = data.leaderboard
    .map(p => `
      <div class="leaderboard-row">
        <span>#${p.rank} ${escapeHtml(p.name)}</span>
        <span><strong>${p.score}</strong> очков</span>
      </div>
    `).join('');
});

socket.on('room:closed', () => {
  alert('Сессия завершена');
  location.href = '/dashboard.html';
});

function showScreen(id) {
  ['lobbyScreen', 'questionScreen', 'revealScreen', 'finalScreen']
    .forEach(s => document.getElementById(s).classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function startTimer(seconds) {
  let left = seconds;
  const bar = document.getElementById('timerBar');
  const label = document.getElementById('timer');
  bar.style.width = '100%';
  label.textContent = left;

  if (currentTimerInterval) clearInterval(currentTimerInterval);
  currentTimerInterval = setInterval(() => {
    left--;
    label.textContent = Math.max(0, left);
    bar.style.width = `${(left / seconds) * 100}%`;
    if (left <= 0) clearInterval(currentTimerInterval);
  }, 1000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}