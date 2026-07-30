let currentUser = null;

async function init() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    
    if (!data.user) {
      window.location.href = '/login.html';
      return;
    }
    
    currentUser = data.user;
    document.getElementById('userName').textContent = data.user.displayName;
    document.getElementById('userRole').textContent = 
      data.user.role === 'organizer' ? 'Организатор' : 'Участник';

    if (data.user.role === 'organizer') {
      document.getElementById('organizerPanel').classList.remove('hidden');
      loadQuizzes();
      loadOrganizedHistory();
    } else {
      document.getElementById('participantPanel').classList.remove('hidden');
      loadParticipatedHistory();
    }
  } catch (err) {
    console.error('Ошибка инициализации:', err);
  }
}

async function loadQuizzes() {
  try {
    const res = await fetch('/api/quizzes');
    const data = await res.json();
    const list = document.getElementById('quizzesList');
    
    if (!data.quizzes || data.quizzes.length === 0) {
      list.innerHTML = '<p style="color:#888; text-align:center;">Пока нет квизов. Создайте первый!</p>';
      return;
    }
    
    list.innerHTML = data.quizzes.map(q => `
      <div class="quiz-card">
        <div>
          <h3>${escapeHtml(q.title)}</h3>
          <div class="meta">
            📚 ${escapeHtml(q.category)} · ❓ ${q.questions_count || 0} вопросов · ⏱ ${q.time_per_question} сек
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-success" onclick="startQuiz(${q.id})">▶ Запустить</button>
          <a href="/edit-quiz.html?id=${q.id}" class="btn btn-secondary" style="text-decoration:none; color:white; padding: 12px 24px;">✏ Изменить</a>
          <button class="btn btn-danger" onclick="deleteQuiz(${q.id})">🗑</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Ошибка загрузки квизов:', err);
  }
}

async function startQuiz(quizId) {
  try {
    const res = await fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId })
    });
    const data = await res.json();
    if (!res.ok) {
      alert('Ошибка: ' + data.error);
      return;
    }
    sessionStorage.setItem('hostData', JSON.stringify(data));
    window.location.href = '/host.html';
  } catch (err) {
    alert('Ошибка запуска: ' + err.message);
  }
}

async function deleteQuiz(id) {
  if (!confirm('Вы уверены, что хотите удалить этот квиз?')) return;
  try {
    await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
    loadQuizzes(); // Перезагружаем список
  } catch (err) {
    alert('Ошибка удаления: ' + err.message);
  }
}

async function loadOrganizedHistory() {
  try {
    const res = await fetch('/api/quizzes/history/organized');
    const data = await res.json();
    const box = document.getElementById('organizedHistory');
    
    if (!data.sessions || data.sessions.length === 0) {
      box.innerHTML = '<p style="color:#888;">История проведённых квизов пуста</p>';
      return;
    }
    
    box.innerHTML = data.sessions.map(s => `
      <div class="quiz-card">
        <div>
          <h3>${escapeHtml(s.quiz_title)}</h3>
          <div class="meta">
            📅 ${new Date(s.started_at).toLocaleString('ru-RU')} · 👥 ${s.players_count} игроков
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Ошибка загрузки истории:', err);
  }
}

async function loadParticipatedHistory() {
  try {
    const res = await fetch('/api/quizzes/history/participated');
    const data = await res.json();
    const box = document.getElementById('participatedHistory');
    
    if (!data.results || data.results.length === 0) {
      box.innerHTML = '<p style="color:#888;">Вы ещё не участвовали в квизах</p>';
      return;
    }
    
    box.innerHTML = data.results.map(r => `
      <div class="quiz-card">
        <div>
          <h3>${escapeHtml(r.quiz_title)}</h3>
          <div class="meta">
            📅 ${new Date(r.finished_at).toLocaleString('ru-RU')} · 🏆 ${r.final_score} очков · ✓ ${r.correct_answers} правильных
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Ошибка загрузки истории участия:', err);
  }
}

function joinRoom() {
  const code = document.getElementById('roomCodeInput').value.trim();
  if (!/^\d{6}$/.test(code)) {
    alert('Код комнаты должен состоять из 6 цифр!');
    return;
  }
  const name = currentUser ? currentUser.displayName : 'Игрок';
  sessionStorage.setItem('joinData', JSON.stringify({ roomCode: code, name }));
  window.location.href = '/player.html';
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
  }
});