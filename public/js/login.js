(function () {
  var form = document.getElementById('login-form');
  var msg = document.getElementById('message');
  var button = form.querySelector('.button');

  function show(text) {
    msg.textContent = text;
    msg.className = 'message error';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var username = form.username.value.trim();
    var password = form.password.value;

    if (!username || !password) {
      show('Please enter both username and password.');
      return;
    }

    button.disabled = true;
    fetch('/api/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    }).then(function (r) {
      return r.json().then(function (data) {
        if (r.ok) { location.href = '/dashboard.html'; return; }
        show(data.error || 'Login failed.');
        form.password.value = '';
        button.disabled = false;
      });
    }).catch(function () {
      show('Cannot reach the server. Is it running?');
      button.disabled = false;
    });
  });
})();
