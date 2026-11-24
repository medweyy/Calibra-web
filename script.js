// =========================================================
// Calibra Deboost — скрипты (один файл на все страницы)
// Блоки, которых нет на текущей странице, пропускаются проверкой
// if (элемент) { ... } или тем, что querySelectorAll ничего не находит
// =========================================================

// ---------- 0. Кто вошёл в аккаунт ----------
// Логин хранится в localStorage («запомнить меня») или в sessionStorage.
// Сама регистрация и вход — в auth.js.
function getSessionLogin() {
  try {
    return localStorage.getItem("session") || sessionStorage.getItem("session");
  } catch (e) {
    return null;
  }
}

// если вошёл — кнопка «Войти» в шапке показывает логин и ведёт в кабинет
const headerLoginBtn = document.getElementById("loginBtn");
const sessionLogin = getSessionLogin();

if (headerLoginBtn && sessionLogin) {
  headerLoginBtn.href = "account.html";
  headerLoginBtn.querySelector(".login__text").textContent = sessionLogin;
}

// ---------- 0.1. Ссылка на поддержку ----------
// Адрес поддержки (Telegram-бот) задаётся здесь, в одном месте,
// и подставляется во все ссылки с атрибутом data-support.
// Если оставить пустым — ссылки станут заглушками и никуда не будут вести.
const SUPPORT_URL = "https://t.me/Calibrasupport_bot";

document.querySelectorAll("[data-support]").forEach(function (link) {
  if (SUPPORT_URL) {
    link.href = SUPPORT_URL;
  } else {
    link.addEventListener("click", function (event) {
      event.preventDefault(); // заглушка: не переходить и не открывать пустую вкладку
    });
  }
});

// ---------- 0.2. Анимация главной карточки ----------
// Только на главной: следит за мышью над карточкой и за прокруткой.
// JS лишь записывает числа в CSS-переменные, рисует всё CSS.
const heroCard = document.querySelector(".hero__card");

if (heroCard) {
  // прокрутка → --hs: 0 вверху страницы, 1 когда карточка уехала из вида
  function updateHeroScroll() {
    const progress = Math.min(window.scrollY / heroCard.offsetHeight, 1);
    heroCard.style.setProperty("--hs", progress.toFixed(3));
  }
  window.addEventListener("scroll", updateHeroScroll, { passive: true });
  updateHeroScroll();

  // курсор → --hx / --hy: координаты мыши внутри карточки.
  // Пятно плавно догоняет мышь: за кадр проходит 15% оставшегося пути.
  const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!noMotion) {
    let targetX = 0, targetY = 0, spotX = 0, spotY = 0, frame = null;

    function moveSpot() {
      spotX += (targetX - spotX) * 0.15;
      spotY += (targetY - spotY) * 0.15;
      heroCard.style.setProperty("--hx", spotX + "px");
      heroCard.style.setProperty("--hy", spotY + "px");

      if (Math.abs(targetX - spotX) > 0.5 || Math.abs(targetY - spotY) > 0.5) {
        frame = requestAnimationFrame(moveSpot);
      } else {
        frame = null;
      }
    }

    heroCard.addEventListener("pointerenter", function (event) {
      // при входе мыши сразу ставим пятно в точку входа, без «прилёта» из угла
      const box = heroCard.getBoundingClientRect();
      spotX = targetX = event.clientX - box.left;
      spotY = targetY = event.clientY - box.top;
      moveSpot();
    });

    heroCard.addEventListener("pointermove", function (event) {
      const box = heroCard.getBoundingClientRect();
      targetX = event.clientX - box.left;
      targetY = event.clientY - box.top;
      if (!frame) frame = requestAnimationFrame(moveSpot);
    });
  }
}

// ---------- 1. Мобильное меню (бургер) ----------
const burger = document.getElementById("burger");
const nav = document.getElementById("nav");

burger.addEventListener("click", function () {
  nav.classList.toggle("is-open");
});

// ---------- 2. Переключатель темы ----------
// Сама тема при загрузке ставится скриптом в <head>, здесь — только кнопки.
const root = document.documentElement;
const themeLight = document.getElementById("themeLight");
const themeDark = document.getElementById("themeDark");
const systemTheme = window.matchMedia("(prefers-color-scheme: light)");

// применить тему и подсветить нужную кнопку
function applyTheme(theme) {
  root.classList.toggle("light", theme === "light");
  themeLight.classList.toggle("is-active", theme === "light");
  themeDark.classList.toggle("is-active", theme === "dark");
}

// выбор пользователя запоминается в localStorage
function chooseTheme(theme) {
  applyTheme(theme);
  try { localStorage.setItem("theme", theme); } catch (e) {}
}

themeLight.addEventListener("click", function () { chooseTheme("light"); });
themeDark.addEventListener("click", function () { chooseTheme("dark"); });

// подсветить кнопку текущей темы при загрузке
applyTheme(root.classList.contains("light") ? "light" : "dark");

// если пользователь сам тему не выбирал — следуем за системой
systemTheme.addEventListener("change", function (e) {
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (err) {}
  if (!saved) {
    applyTheme(e.matches ? "light" : "dark");
  }
});

// ---------- 3. Кнопки «Купить» на странице тарифов ----------
// Оплата пока не подключена. Не вошёл — отправляем на вход,
// вошёл — показываем сообщение под тарифами.
document.querySelectorAll("[data-plan]").forEach(function (button) {
  button.addEventListener("click", function () {
    if (!getSessionLogin()) {
      location.href = "login.html";
      return;
    }
    const note = document.getElementById("buyNote");
    if ("free" in button.dataset) {
      note.textContent = "Пробный период можно будет активировать в ближайшее время.";
    } else {
      note.textContent = "Тариф «" + button.dataset.plan + "»: оплата появится в ближайшее время.";
    }
  });
});

// ---------- 4. Появление блоков при прокрутке ----------
// IntersectionObserver следит, когда элемент попадает в экран
const revealObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target); // анимация только один раз
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll(".reveal").forEach(function (el) {
  revealObserver.observe(el);
});
