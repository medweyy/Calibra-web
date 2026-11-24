// =========================================================
// Calibra Deboost — реферальная система (страница referral.html)
//
// Подключается после script.js и auth.js и берёт оттуда:
//   getSessionLogin() — кто вошёл
//   ensureRefCode()   — пользователь с гарантированно выданным кодом
//   getInvited()      — список приглашённых
// =========================================================

const REF_PERCENT = 10; // процент с оплат приглашённых

const refGuest = document.getElementById("refGuest");
const refUser = document.getElementById("refUser");
const refOwner = ensureRefCode(getSessionLogin() || "");

if (refOwner) {
  // вошёл: прячем блок для гостя, показываем свой
  refGuest.hidden = true;
  refUser.hidden = false;

  function showCode(code) {
    document.getElementById("refCode").textContent = code;
  }
  showCode(refOwner.refCode);

  // ---------- статистика ----------
  const invited = getInvited(refOwner.login);
  // оплат пока нет — поле paid появится, когда подключим оплату
  const paid = invited.filter(function (u) { return u.paid; });
  const earned = paid.reduce(function (sum, u) {
    return sum + (u.paidTotal || 0) * REF_PERCENT / 100;
  }, 0);

  document.getElementById("refCount").textContent = invited.length;
  document.getElementById("refPaid").textContent = paid.length;
  document.getElementById("refEarned").textContent = earned + " ₽";

  // ---------- список приглашённых ----------
  const list = document.getElementById("refList");

  if (invited.length > 0) {
    document.getElementById("refEmpty").hidden = true;

    invited.forEach(function (u) {
      const date = new Date(u.createdAt).toLocaleDateString("ru-RU");
      const li = document.createElement("li");
      li.className = "invited__item";

      // textContent, а не innerHTML — логин вставляется как текст, а не как HTML-код
      const name = document.createElement("span");
      name.className = "invited__name";
      name.textContent = u.login;

      const status = document.createElement("span");
      status.className = "invited__status";
      status.textContent = u.paid ? "Оплатил" : "Без оплаты";

      const when = document.createElement("span");
      when.className = "invited__date mono";
      when.textContent = date;

      li.append(name, status, when);
      list.append(li);
    });
  }

  // ---------- кнопка «Копировать» ----------
  const copyBtn = document.getElementById("refCopy");

  copyBtn.addEventListener("click", async function () {
    const code = refOwner.refCode;
    try {
      await navigator.clipboard.writeText(code);
    } catch (e) {
      // запасной вариант для старых браузеров и страниц без https:
      // временное текстовое поле → выделить → скопировать → удалить
      const temp = document.createElement("textarea");
      temp.value = code;
      document.body.append(temp);
      temp.select();
      document.execCommand("copy");
      temp.remove();
    }
    copyBtn.textContent = "Скопировано";
    setTimeout(function () { copyBtn.textContent = "Копировать"; }, 2000);
  });

  // ---------- смена кода на свой ----------
  const editBtn = document.getElementById("refEditBtn");
  const editForm = document.getElementById("refEditForm");
  const codeInput = document.getElementById("refCodeInput");
  const codeError = document.getElementById("refCodeError");

  function closeEdit() {
    editForm.hidden = true;
    editBtn.hidden = false;
    codeError.textContent = "";
    codeInput.classList.remove("is-error");
  }

  editBtn.addEventListener("click", function () {
    editForm.hidden = false;
    editBtn.hidden = true;
    codeInput.value = refOwner.refCode;
    codeInput.focus();
    codeInput.select();
  });

  document.getElementById("refEditCancel").addEventListener("click", closeEdit);

  codeInput.addEventListener("input", function () {
    codeError.textContent = "";
    codeInput.classList.remove("is-error");
  });

  editForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const newCode = codeInput.value.trim();
    const users = loadUsers();
    let error = "";

    if (!REF_CODE_RULE.test(newCode)) {
      error = "Только латинские буквы и цифры, от 3 до 16 символов";
    } else if (isRefCodeTaken(newCode, users, refOwner.login)) {
      error = "Этот код уже занят";
    }

    if (error) {
      codeError.textContent = error;
      codeInput.classList.add("is-error");
      return;
    }

    // сохраняем новый код. Приглашённые привязаны к логину, а не к коду,
    // поэтому после смены кода они никуда не пропадают.
    const me = users.find(function (u) { return u.login === refOwner.login; });
    me.refCode = newCode;
    saveUsers(users);
    refOwner.refCode = newCode;

    showCode(newCode);
    closeEdit();
  });
}
