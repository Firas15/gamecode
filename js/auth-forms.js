(function () {
  const NICK_RE = /^[a-zA-Z0-9_\-а-яёА-ЯЁ]+$/u;

  function validateNickname(nick) {
    nick = String(nick).trim();
    if (nick.length < 3 || nick.length > 24) {
      return 'Никнейм: от 3 до 24 символов';
    }
    if (!NICK_RE.test(nick)) {
      return 'Никнейм: только буквы, цифры, _ и -';
    }
    return '';
  }

  function setFieldError(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
    const input = el.closest('.auth-field') && el.closest('.auth-field').querySelector('.auth-input');
    if (input) input.classList.toggle('auth-invalid', !!msg);
  }

  function setGlobalError(el, msg) {
    if (!el) return;
    el.textContent = msg ? '⚠ ' + msg : '';
    el.style.display = msg ? 'block' : 'none';
  }

  function initLogin(form) {
    const errGlobal = document.getElementById('auth-error');
    const nickErr = document.getElementById('nickname-error');
    const nick = form.querySelector('#nickname');
    const pass = form.querySelector('#password');
    const redirect = form.querySelector('input[name="redirect"]');

    function checkNickInline() {
      const v = nick ? nick.value : '';
      const e = validateNickname(v);
      setFieldError(nickErr, e);
      return !e;
    }

    if (nick) {
      nick.addEventListener('input', () => {
        if (!nick.value.trim()) {
          setFieldError(nickErr, '');
          return;
        }
        setFieldError(nickErr, validateNickname(nick.value));
      });
      nick.addEventListener('blur', checkNickInline);
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      setGlobalError(errGlobal, '');
      setFieldError(nickErr, '');

      if (!nick.value.trim()) {
        setGlobalError(errGlobal, 'Введи никнейм');
        nick.focus();
        return;
      }
      if (!checkNickInline()) {
        nick.focus();
        return;
      }
      if (!pass || !pass.value) {
        setGlobalError(errGlobal, 'Введи пароль');
        pass.focus();
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = '[ ... ]';
      }

      try {
        const body = new FormData();
        body.append('nickname', nick.value.trim());
        body.append('password', pass.value);
        if (redirect && redirect.value) body.append('redirect', redirect.value);

        const res = await fetch('../api/login-submit.php', {
          method: 'POST',
          body,
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        const data = await res.json().catch(() => ({}));

        if (data.ok && data.redirect) {
          window.location.href = data.redirect;
          return;
        }
        setGlobalError(errGlobal, data.error || 'Ошибка входа');
      } catch (_) {
        setGlobalError(errGlobal, 'Нет связи с сервером. Попробуй ещё раз.');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev;
        }
      }
    });
  }

  function initRegister(form) {
    const errGlobal = document.getElementById('auth-error');
    const nickErr = document.getElementById('nickname-error');
    const nick = form.querySelector('#nickname');
    const pass = form.querySelector('#password');
    const confirm = form.querySelector('#confirm');
    const question = form.querySelector('#secret_question');
    const answer = form.querySelector('#secret_answer');

    function refreshNickError() {
      const v = nick ? nick.value : '';
      if (!v.trim()) {
        setFieldError(nickErr, '');
        return;
      }
      setFieldError(nickErr, validateNickname(v));
    }

    if (nick) {
      nick.addEventListener('input', refreshNickError);
      nick.addEventListener('blur', refreshNickError);
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      setGlobalError(errGlobal, '');

      const ne = nick ? validateNickname(nick.value) : 'Никнейм обязателен';
      if (ne) {
        setFieldError(nickErr, ne);
        nick.focus();
        return;
      }
      setFieldError(nickErr, '');

      if (!pass || pass.value.length < 6) {
        setGlobalError(errGlobal, 'Пароль: минимум 6 символов');
        pass.focus();
        return;
      }
      if (pass.value !== (confirm && confirm.value)) {
        setGlobalError(errGlobal, 'Пароли не совпадают');
        confirm.focus();
        return;
      }
      if (!question || !String(question.value).trim()) {
        setGlobalError(errGlobal, 'Выберите секретный вопрос');
        question.focus();
        return;
      }
      if (!answer || String(answer.value).trim().length < 2) {
        setGlobalError(errGlobal, 'Ответ на вопрос: минимум 2 символа');
        answer.focus();
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = '[ ... ]';
      }

      try {
        const body = new FormData(form);

        const res = await fetch('../api/register-submit.php', {
          method: 'POST',
          body,
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        const data = await res.json().catch(() => ({}));

        if (data.ok && data.redirect) {
          window.location.href = data.redirect;
          return;
        }
        setGlobalError(errGlobal, data.error || 'Ошибка регистрации');
      } catch (_) {
        setGlobalError(errGlobal, 'Нет связи с сервером. Попробуй ещё раз.');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev;
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) initLogin(loginForm);

    const regForm = document.getElementById('regForm');
    if (regForm) initRegister(regForm);
  });
})();
