// =========================================================
// Calibra Deboost — регистрация, вход и личный кабинет
//
// Сервера нет, поэтому аккаунты хранятся в браузере (localStorage):
//   "users"   — массив пользователей в формате JSON
//   "session" — логин того, кто сейчас вошёл
// Пароль в открытом виде НЕ хранится: сохраняется только его хеш SHA-256
// с «солью» — случайной строкой, своей у каждого пользователя.
//
// Подключается на login.html, register.html и account.html после script.js
// (функцию getSessionLogin() берём оттуда).
// =========================================================


// ---------- 1. Хранилище пользователей ----------

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem("users")) || [];
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

// найти пользователя по логину или email (без учёта регистра)
function findUser(loginOrEmail) {
  const value = loginOrEmail.trim().toLowerCase();
  return loadUsers().find(function (user) {
    return user.login.toLowerCase() === value || user.email === value;
  });
}


// ---------- 1.1. Реферальные коды ----------

// 6 символов без похожих друг на друга (нет 0/O, 1/I/L), чтобы код легко переписать
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeRefCode(users) {
  let code;
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
    }
  } while (isRefCodeTaken(code, users)); // код должен быть уникальным
  return code;
}

// Код может придумать сам пользователь, поэтому хранится как ввели
// (например, KindMops), а сравнивается без учёта регистра.
function sameCode(a, b) {
  return Boolean(a && b) && a.toUpperCase() === b.toUpperCase();
}

function isRefCodeTaken(code, users, exceptLogin) {
  return users.some(function (u) {
    return u.login !== exceptLogin && sameCode(u.refCode, code);
  });
}

function findUserByRefCode(code) {
  const value = code.trim();
  return loadUsers().find(function (user) { return sameCode(user.refCode, value); });
}

// свой код: только латинские буквы и цифры, 3–16 символов
const REF_CODE_RULE = /^[a-zA-Z0-9]{3,16}$/;

// у аккаунтов, созданных до появления рефералки, кода нет — выдаём при первом обращении
function ensureRefCode(login) {
  const users = loadUsers();
  const user = users.find(function (u) { return u.login === login; });
  if (user && !user.refCode) {
    user.refCode = makeRefCode(users);
    saveUsers(users);
  }
  return user;
}

// сколько человек зарегистрировалось по коду этого пользователя
function getInvited(login) {
  return loadUsers().filter(function (u) { return u.referredBy === login; });
}


// ---------- 2. Хеширование пароля ----------

// байты → строка из шестнадцатеричных символов
function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(function (b) { return b.toString(16).padStart(2, "0"); })
    .join("");
}

// случайная соль: 16 байт из криптографического генератора
function makeSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

// SHA-256 от (соль + пароль). crypto.subtle встроен в браузер.
async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
}


// ---------- 3. Сессия (кто вошёл) ----------

// «Запомнить меня» → localStorage (живёт после закрытия браузера),
// иначе sessionStorage (стирается при закрытии вкладки).
function startSession(login, remember) {
  endSession();
  if (remember) {
    localStorage.setItem("session", login);
  } else {
    sessionStorage.setItem("session", login);
  }
}

function endSession() {
  localStorage.removeItem("session");
  sessionStorage.removeItem("session");
}


// ---------- 4. Показ ошибок в форме ----------

function showFieldError(input, message) {
  const field = input.closest(".field");
  field.classList.add("has-error");
  field.querySelector(".field__error").textContent = message;
}

function clearErrors(form) {
  form.querySelectorAll(".field").forEach(function (field) {
    field.classList.remove("has-error");
    field.querySelector(".field__error").textContent = "";
  });
  form.querySelector(".auth__error").textContent = "";
}

// ошибка у поля пропадает, как только его начали исправлять
document.querySelectorAll(".field__input").forEach(function (input) {
  input.addEventListener("input", function () {
    const field = input.closest(".field");
    if (!field) return; // поле вне блока .field (например, смена кода на странице рефералки)
    field.classList.remove("has-error");
    field.querySelector(".field__error").textContent = "";
  });
});

// кнопка-глаз: показать / скрыть пароль
document.querySelectorAll(".field__eye").forEach(function (eye) {
  eye.addEventListener("click", function () {
    const input = eye.parentElement.querySelector("input");
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    eye.classList.toggle("is-on", hidden);
  });
});


// ---------- 5. Регистрация ----------

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  // уже вошёл — регистрироваться незачем
  if (getSessionLogin()) location.replace("account.html");

  registerForm.addEventListener("submit", async function (event) {
    event.preventDefault(); // не перезагружать страницу
    clearErrors(registerForm);

    const loginInput = document.getElementById("regLogin");
    const emailInput = document.getElementById("regEmail");
    const passInput = document.getElementById("regPassword");
    const pass2Input = document.getElementById("regPassword2");
    const refInput = document.getElementById("regRef");

    const login = loginInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passInput.value;
    const users = loadUsers();
    let ok = true;

    // проверки (регулярные выражения)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(login)) {
      showFieldError(loginInput, "3–20 символов: латинские буквы, цифры и _");
      ok = false;
    } else if (users.some(function (u) { return u.login.toLowerCase() === login.toLowerCase(); })) {
      showFieldError(loginInput, "Этот логин уже занят");
      ok = false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError(emailInput, "Введите корректный email");
      ok = false;
    } else if (users.some(function (u) { return u.email === email; })) {
      showFieldError(emailInput, "Этот email уже зарегистрирован");
      ok = false;
    }

    if (password.length < 8 || !/[a-zA-Zа-яА-ЯёЁ]/.test(password) || !/\d/.test(password)) {
      showFieldError(passInput, "Минимум 8 символов, хотя бы одна буква и одна цифра");
      ok = false;
    }

    if (pass2Input.value !== password) {
      showFieldError(pass2Input, "Пароли не совпадают");
      ok = false;
    }

    // реферальный код необязателен, но если введён — должен существовать
    const refCode = refInput.value.trim();
    const referrer = refCode ? findUserByRefCode(refCode) : null;
    if (refCode && !referrer) {
      showFieldError(refInput, "Такого кода не существует");
      ok = false;
    }

    if (!ok) return;

    // всё верно — создаём пользователя
    const salt = makeSalt();
    users.push({
      login: login,
      email: email,
      salt: salt,
      passwordHash: await hashPassword(password, salt),
      createdAt: new Date().toISOString(),
      refCode: makeRefCode(users),                   // свой код для приглашений
      referredBy: referrer ? referrer.login : null   // кто пригласил
    });
    saveUsers(users);

    startSession(login, true);
    location.href = "account.html";
  });
}


// ---------- 6. Вход ----------

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  if (getSessionLogin()) location.replace("account.html");

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearErrors(loginForm);

    const nameInput = document.getElementById("loginName");
    const passInput = document.getElementById("loginPassword");
    const remember = document.getElementById("loginRemember").checked;
    let ok = true;

    if (!nameInput.value.trim()) {
      showFieldError(nameInput, "Введите логин или email");
      ok = false;
    }
    if (!passInput.value) {
      showFieldError(passInput, "Введите пароль");
      ok = false;
    }
    if (!ok) return;

    const user = findUser(nameInput.value);
    // хешируем введённый пароль с солью пользователя и сравниваем хеши
    const hash = user ? await hashPassword(passInput.value, user.salt) : "";

    if (!user || hash !== user.passwordHash) {
      // не уточняем, что именно неверно — так безопаснее
      document.getElementById("loginError").textContent = "Неверный логин или пароль";
      return;
    }

    startSession(user.login, remember);
    location.href = "account.html";
  });
}


// ---------- 7. Личный кабинет ----------

const accountPage = document.getElementById("accountPage");

if (accountPage) {
  const accountUser = ensureRefCode(getSessionLogin() || "");

  if (!accountUser) {
    // не вошёл (или аккаунта больше нет в хранилище) — на страницу входа
    endSession();
    location.replace("login.html");
  } else {
    const created = new Date(accountUser.createdAt).toLocaleDateString("ru-RU", {
      day: "numeric", month: "long", year: "numeric"
    });

    document.getElementById("accAvatar").textContent = accountUser.login[0].toUpperCase();
    document.getElementById("accLogin").textContent = accountUser.login;
    document.getElementById("accEmail").textContent = accountUser.email;
    document.getElementById("accLogin2").textContent = accountUser.login;
    document.getElementById("accEmail2").textContent = accountUser.email;
    document.getElementById("accDate").textContent = created;
    document.getElementById("accRef").textContent = accountUser.refCode;
    document.getElementById("accInvited").textContent = getInvited(accountUser.login).length;
  }

  document.getElementById("logoutBtn").addEventListener("click", function () {
    endSession();
    location.href = "index.html";
  });
}
