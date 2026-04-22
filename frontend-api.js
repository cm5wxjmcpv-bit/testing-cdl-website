const AUTH_STORAGE_KEY = "cdl_username";

async function login(username, password) {
  try {
    const url = APP_SCRIPT_URL +
      "?action=validateLogin" +
      "&username=" + encodeURIComponent(username) +
      "&password=" + encodeURIComponent(password);

    const res = await fetch(url);
    const data = await res.json();

    if (data && data.ok) {
      localStorage.setItem(AUTH_STORAGE_KEY, data.username || username);
      return true;
    }

    return false;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function requireAuth() {
  const username = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!username) {
    location.href = "index.html";
    return "";
  }

  return username;
}

function logout() {
  localStorage.clear();
  location.href = "index.html";
}

function qs(param) {
  return new URLSearchParams(location.search).get(param);
}

async function apiGetStatus(username) {
  const url = APP_SCRIPT_URL +
    "?action=getStatus" +
    "&username=" + encodeURIComponent(username);

  const res = await fetch(url);
  return res.json();
}

async function apiLogModule(username, moduleId) {
  const res = await fetch(APP_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "logModule",
      username,
      moduleId
    })
  });

  return res.json();
}

async function apiLogTest(username, complete, score) {
  const res = await fetch(APP_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "logTest",
      username,
      complete,
      score
    })
  });

  return res.json();
}

function allModulesComplete(status) {
  if (!status || !status.modules) return false;

  return MODULES.every(m => {
    return !!status.modules["m" + m.id];
  });
}
