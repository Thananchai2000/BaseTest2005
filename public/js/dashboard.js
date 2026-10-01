(function () {
  var $ = function (id) { return document.getElementById(id); };
  var errorBox = $('error');

  function cell(tr, text, cls) {
    var td = document.createElement('td');
    var el = td;
    if (cls) { el = document.createElement('span'); el.className = cls; td.appendChild(el); }
    el.textContent = text;
    tr.appendChild(td);
  }

  function fill(tbody, rows) {
    tbody.textContent = '';
    rows.forEach(function (r) { tbody.appendChild(r); });
  }

  function toLogin() { location.href = '/'; }

  function render(d) {
    var k = d.kpi;
    $('k-produced').textContent = k.produced.toLocaleString();
    $('k-target').textContent = 'target ' + k.target.toLocaleString();
    $('k-oee').textContent = k.oee.toFixed(1) + '%';
    $('k-defects').textContent = k.defects;
    $('k-defrate').textContent = k.defectRate.toFixed(2) + '% defect rate';
    $('k-running').textContent = k.running;
    $('k-total').textContent = 'of ' + k.total + ' machines';
    $('k-energy').textContent = k.energyKwh.toLocaleString();
    $('progress').style.width = Math.min(100, k.produced / k.target * 100) + '%';
    $('stamp').textContent = 'Updated ' + new Date(d.time).toLocaleTimeString();

    fill($('machines').tBodies[0], d.machines.map(function (m) {
      var tr = document.createElement('tr');
      cell(tr, m.id);
      cell(tr, m.line);
      cell(tr, m.name);
      cell(tr, m.status, 'status s-' + m.status);
      cell(tr, m.temp.toFixed(1), m.temp > 85 ? 'hot' : '');
      cell(tr, m.status === 'RUN' && m.rpm ? m.rpm : '-');
      cell(tr, m.count.toLocaleString() + ' ' + m.unit);
      return tr;
    }));

    fill($('alarms').tBodies[0], d.alarms.map(function (a) {
      var tr = document.createElement('tr');
      cell(tr, new Date(a.time).toLocaleTimeString());
      cell(tr, a.level, 'lv-' + a.level);
      cell(tr, a.text);
      return tr;
    }));
  }

  function refresh() {
    fetch('/api/factory', { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) return toLogin();
      return r.json().then(function (d) { errorBox.className = 'message'; render(d); });
    }).catch(function () {
      errorBox.textContent = 'Connection lost. Retrying...';
      errorBox.className = 'message error';
    });
  }

  fetch('/api/me', { credentials: 'same-origin' }).then(function (r) {
    if (r.status === 401) return toLogin();
    return r.json().then(function (u) { $('who').textContent = u.name + ' (' + u.role + ')'; });
  });

  $('logout').addEventListener('click', function (e) {
    e.preventDefault();
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).then(toLogin);
  });

  refresh();
  setInterval(refresh, 2000);
})();
