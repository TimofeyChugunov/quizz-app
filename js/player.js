const joinData = JSON.parse(sessionStorage.getItem('joinData') || 'null');
if (!joinData) {
  alert('Сначала введите код комнаты');
  location.href = '/join.html';
}

const socket = io();
let myScore = 0;
let selectedAnswers = [];

socket.emit('player:join', {
  roomCode: joinData.roomCode,
  name: joinData.name
});

socket.on('player:joined', (data) => {
  document.getElementById('quizTitle').textContent = data.quizTitle || joinData.quizTitle || 'Квиз';
  document.getElementById('playersCount').textContent = data.playersCount;
});

socket.on('room:playersUpdate', (data) => {
  document.getElementById('playersCount').textContent = data.players.length;
});

socket.on('error', (data) => {
  alert(data.message);
  location.href = '/join.html';
});

socket.on('game:question', (q) => {
  showScreen('questionScreen');
  document.getElementById('qIndex').textContent = q.index + 1;
  document.getElementById('qTotal').textContent = q.total;
  document.getElementById('questionText').textContent = q.text;
  selectedAnswers = [];

  const img = document.getElementById('questionImage');
  if (q.imageUrl) {
    img.src = q.imageUrl;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }

  const grid = document.getElementById('answersGrid');
  grid.innerHTML = q.answers.map(a => `
    <button class="answer-btn" data-id="${a.id}">${escapeHtml(a.text)}</button>
  `).join('');

  grid.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = +btn.dataset.id;
      if (q.type === 'single') {
        grid.querySelectorAll('.answer-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAnswers = [id];
        // Сразу отправляем
        socket.emit('player:answer', { roomCode: joinData.roomCode, answerIds: selectedAnswers });
        showScreen('answeredScreen');
        document.getElementById('answerResult').textContent = '✓ Принято';
      } else {
        btn.classList.toggle('selected');
        if (btn.classList.contains('selected')) {
          selectedAnswers.push(id);
        } else {
          selectedAnswers = selectedAnswers.filter(x => x !== id);
        }
      }
    });
  });

  // Для множественного выбора — кнопка подтверждения
  if (q.type === 'multiple') {
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-success';
    confirmBtn.style.cssText = 'grid-column: 1 / -1; margin-top: 10px; padding: 15px;';
    confirmBtn.textContent = '✓ Подтвердить ответ';
    confirmBtn.addEventListener('click', () => {
      if (selectedAnswers.length === 0) return alert('Выберите хотя бы один вариант');
      socket.emit('player:answer', { roomCode: joinData.roomCode, answerIds: selectedAnswers });
      showScreen('answeredScreen');
      document.getElementById('answerResult').textContent = '✓ Принято';
    });
    grid.appendChild(confirmBtn);
  }

  startTimer(q.timeLimit);
});

socket.on('player:answerAccepted', (data) => {
  document.getElementById('answerResult').textContent = data.isCorrect ? '✓ Правильно!' : '✗ Ответ принят';
});

socket.on('game:reveal', (data) => {
  showScreen('revealScreen');
  document.getElementById('revealLeaderboard').innerHTML = data.leaderboard
    .map(p => `
      <div class="leaderboard-row">
        <span>#${p.rank} ${escapeHtml(p.name)}</span>
        <span><strong>${p.score}</strong></span>
      </div>
    `).join('');
  // Находим свой счёт
  const me = data.leaderboard.find(p => p.name === joinData.name);
  if (me) {
    myScore = me.score;
    document.getElementById('myScore').textContent = myScore;
  }
});

socket.on('game:finished', (data) => {
  showScreen('finalScreen');
  document.getElementById('finalLeaderboard').innerHTML = data.leaderboard
    .map(p => `
      <div class="leaderboard-row">
        <span>#${p.rank} ${escapeHtml(p.name)}</span>
        <span><strong>${p.score}</strong></span>
      </div>
    `).join('');
});

socket.on('room:closed', () => {
  showScreen('closedScreen');
});

function showScreen(id) {
  ['waitingScreen', 'questionScreen', 'answeredScreen', 'revealScreen', 'finalScreen', 'closedScreen']
    .forEach(s => document.getElementById(s).classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function startTimer(seconds) {
  let left = seconds;
  const bar = document.getElementById('timerBar');
  const label = document.getElementById('timer');
  bar.style.width = '100%';
  label.textContent = left;

  const interval = setInterval(() => {
    left--;
    label.textContent = Math.max(0, left);
    bar.style.width = `${(left / seconds) * 100}%`;
    if (left <= 0) clearInterval(interval);
  }, 1000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}