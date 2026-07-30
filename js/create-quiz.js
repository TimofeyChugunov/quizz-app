let questions = [];
let editingQuizId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  editingQuizId = params.get('id');

  if (editingQuizId) {
    try {
      const res = await fetch(`/api/quizzes/${editingQuizId}`);
      if (!res.ok) throw new Error('Квиз не найден');
      const data = await res.json();
      const q = data.quiz;
      
      document.querySelector('[name=title]').value = q.title;
      document.querySelector('[name=description]').value = q.description || '';
      document.querySelector('[name=category]').value = q.category;
      document.querySelector('[name=timePerQuestion]').value = q.time_per_question;
      
      questions = q.questions.map(qq => ({
        text: qq.question_text,
        type: qq.question_type,
        imageUrl: qq.image_url || '',
        timeLimit: qq.time_limit,
        answers: qq.answers.map(a => ({ text: a.answer_text, isCorrect: !!a.is_correct }))
      }));
      renderQuestions();
    } catch (err) {
      alert('Ошибка загрузки квиза: ' + err.message);
      window.location.href = '/dashboard.html';
    }
  }

  document.getElementById('addQuestionBtn').addEventListener('click', addQuestion);
  document.getElementById('saveBtn').addEventListener('click', saveQuiz);
});

function addQuestion() {
  questions.push({
    text: '',
    type: 'single',
    imageUrl: '',
    timeLimit: 20,
    answers: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ]
  });
  renderQuestions();
}

function removeQuestion(idx) {
  if (confirm('Удалить этот вопрос?')) {
    questions.splice(idx, 1);
    renderQuestions();
  }
}

function renderQuestions() {
  const list = document.getElementById('questionsList');
  if (questions.length === 0) {
    list.innerHTML = '<p style="color: #888; text-align: center;">Пока нет вопросов. Нажмите "Добавить вопрос".</p>';
    return;
  }

  list.innerHTML = questions.map((q, i) => `
    <div class="question-block" data-idx="${i}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0;">Вопрос ${i + 1}</h3>
        <button type="button" class="btn btn-danger" onclick="removeQuestion($,{i})" style="padding: 6px 12px; font-size: 14px;">Удалить</button>
      </div>
      
      <div class="form-group">
        <label>Текст вопроса</label>
        <textarea name="qText" rows="2" required placeholder="Введите текст вопроса...">${escapeHtml(q.text)}</textarea>
      </div>
      
      <div style="display: flex; gap: 15px;">
        <div class="form-group" style="flex: 1;">
          <label>Тип ответа</label>
          <select name="qType">
            <option value="single" ${q.type === 'single' ? 'selected' : ''}>Одиночный выбор (один правильный)</option>
            <option value="multiple" ${q.type === 'multiple' ? 'selected' : ''}>Множественный выбор (несколько правильных)</option>
          </select>
        </div>
        <div class="form-group" style="flex: 1;">
          <label>Время на ответ (сек)</label>
          <input type="number" name="qTime" value="${q.timeLimit}" min="5" max="120">
        </div>
      </div>
      
      <div class="form-group">
        <label>Изображение (необязательно)</label>
        <input type="file" name="qImage" accept="image/*" data-idx="${i}">
        ${q.imageUrl ? `<img src="${q.imageUrl}" class="question-image" style="max-width: 250px; margin-top: 8px;">` : ''}
      </div>
      
      <label style="font-weight: 600; color: #555; display: block; margin-bottom: 8px;">
        Варианты ответа <span style="color: #e74c3c;">*</span> 
        <small style="font-weight: normal; color: #888;">(Отметьте галочкой/точкой правильные варианты)</small>
      </label>
      
      <div class="answers-list">
        ${q.answers.map((a, j) => `
          <div class="answer-option" style="display: flex; align-items: center; gap: 12px; padding: 10px; background: #f8f9ff; border-radius: 8px; margin-bottom: 10px;">
            <input type="${q.type === 'single' ? 'radio' : 'checkbox'}" 
                   name="correct_${i}" value="${j}" ${a.isCorrect ? 'checked' : ''}
                   style="width: 20px; height: 20px; cursor: pointer;">
            <input type="text" name="answer_${i}_${j}" value="${escapeHtml(a.text)}" 
                   placeholder="Вариант ответа ${j + 1}" 
                   style="flex: 1; padding: 10px 15px; font-size: 16px; border: 2px solid #d0d5ff; border-radius: 8px; color: #2d3748 !important; background-color: #ffffff !important; font-weight: 500;">
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// === НАДЁЖНАЯ ОБРАБОТКА СОБЫТИЙ (ДЕЛЕГИРОВАНИЕ) ===
const questionsList = document.getElementById('questionsList');

questionsList.addEventListener('input', (e) => {
  const block = e.target.closest('.question-block');
  if (!block) return;
  const idx = block.dataset.idx;

  if (e.target.name === 'qText') {
    questions[idx].text = e.target.value;
  } else if (e.target.name === 'qTime') {
    questions[idx].timeLimit = parseInt(e.target.value) || 20;
  } else if (e.target.name.startsWith('answer_')) {
    const parts = e.target.name.split('_'); // ['answer', '0', '0']
    const ansIdx = parts[2];
    questions[idx].answers[ansIdx].text = e.target.value;
  }
});

questionsList.addEventListener('change', (e) => {
  const block = e.target.closest('.question-block');
  if (!block) return;
  const idx = block.dataset.idx;

  if (e.target.name === 'qType') {
    questions[idx].type = e.target.value;
    // Сбрасываем правильные ответы при смене типа, чтобы избежать багов
    questions[idx].answers.forEach(a => a.isCorrect = false);
    questions[idx].answers[0].isCorrect = true; // По умолчанию первый верный
    renderQuestions(); // Перерисовываем, чтобы radio сменились на checkbox и наоборот
  } else if (e.target.name.startsWith('correct_')) {
    const ansIdx = e.target.value;
    if (questions[idx].type === 'single') {
      questions[idx].answers.forEach((a, j) => {
        a.isCorrect = (j == ansIdx);
      });
    } else {
      questions[idx].answers[ansIdx].isCorrect = e.target.checked;
    }
  } else if (e.target.name === 'qImage' && e.target.files.length > 0) {
    const file = e.target.files[0];
    const fd = new FormData();
    fd.append('image', file);
    
    // Показываем временный текст загрузки
    e.target.disabled = true;
    e.target.parentElement.insertAdjacentHTML('afterend', '<small style="color:#667eea">Загрузка...</small>');

    fetch('/api/upload', { method: 'POST', body: fd })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          questions[idx].imageUrl = data.url;
          renderQuestions();
        }
      })
      .catch(err => {
        alert('Ошибка загрузки изображения');
        e.target.disabled = false;
      });
  }
});

async function saveQuiz() {
  const errBox = document.getElementById('error');
  errBox.classList.add('hidden');

  const title = document.querySelector('[name=title]').value.trim();
  const description = document.querySelector('[name=description]').value.trim();
  const category = document.querySelector('[name=category]').value;
  const timePerQuestion = parseInt(document.querySelector('[name=timePerQuestion]').value) || 20;

  if (!title) {
    alert('❌ Введите название квиза!');
    return;
  }
  if (questions.length === 0) {
    alert('❌ Добавьте хотя бы один вопрос!');
    return;
  }

  // Строгая валидация каждого вопроса
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.text.trim()) {
      alert(`❌ Вопрос ${i + 1}: Введите текст вопроса!`);
      return;
    }
    
    const filledAnswers = q.answers.filter(a => a.text.trim());
    if (filledAnswers.length < 2) {
      alert(`❌ Вопрос ${i + 1}: Заполните минимум 2 варианта ответа!`);
      return;
    }
    if (!q.answers.some(a => a.isCorrect)) {
      alert(`❌ Вопрос ${i + 1}: Отметьте хотя бы один правильный ответ галочкой/точкой!`);
      return;
    }
  }

  const payload = {
    title, description, category, timePerQuestion,
    questions: questions.map(q => ({
      text: q.text,
      type: q.type,
      imageUrl: q.imageUrl,
      timeLimit: q.timeLimit,
      answers: q.answers.filter(a => a.text.trim()) // Отправляем только заполненные ответы
    }))
  };

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Сохранение...';

  try {
    const url = editingQuizId ? `/api/quizzes/${editingQuizId}` : '/api/quizzes';
    const method = editingQuizId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Ошибка сервера');
    }

    alert('✅ Квиз успешно сохранён!');
    window.location.href = '/dashboard.html';
  } catch (err) {
    alert('Ошибка сохранения: ' + err.message);
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Сохранить квиз';
  }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}