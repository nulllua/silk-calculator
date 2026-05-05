// Goods + travel feature area

const GOOD_TYPES = ['Agricultural', 'Craft', 'Household', 'Luxury', 'Metal', 'Spices', 'Textile'];
let _cities = [];

async function loadGoods() {
  const [gr, cr] = await Promise.all([api('/api/goods'), api('/api/cities')]);
  if (!gr.ok) return;
  const goods = await gr.json();
  _cities = cr.ok ? (await cr.json()).map((c) => c.name) : _cities;

  el('goods-body').innerHTML = goods
    .map((g) => {
      const id = esc(g.name);
      const prod = g.produced_in || [];
      const miss = _cities.filter((c) => !prod.includes(c));
      const safeName = escHtml(g.name);
      return `
    <tr>
      <td class="hl">${safeName}</td>
      <td><input class="ifield" type="number" value="${g.base_price}" min="1" style="width:75px" data-field="base"></td>
      <td><select class="ifield" data-field="type">${GOOD_TYPES.map((t) => `<option${t === g.type ? ' selected' : ''}>${escHtml(t)}</option>`).join('')}</select></td>
      <td><input class="ifield" type="number" value="${(g.hop_pct * 100).toFixed(4)}" step="0.0001" min="0" style="width:90px" data-field="hop"></td>
      <td>
        <button class="btn btn-save" data-name="${safeName}" onclick="saveGood(this)">Save</button>
        <button class="btn btn-del"  data-name="${safeName}" onclick="delGood(this)"  style="margin-left:4px">Del</button>
        <span class="ss" id="gs-${id}"></span>
      </td>
    </tr>
    <tr><td colspan="5" class="sub">
      <h3>Produced In</h3>
      <div>
        ${prod.map((c) => `<span class="tag">${escHtml(c)}<span class="x" data-good="${safeName}" data-city="${escHtml(c)}" onclick="delGoodCity(this)">✕</span></span>`).join('')}
        ${prod.length === 0 ? '<span class="dim">None</span>' : ''}
      </div>
      ${
        miss.length
          ? `<div style="margin-top:6px;display:flex;gap:6px;align-items:center">
        <select id="gcsel-${id}" class="ifield">${miss.map((c) => `<option>${escHtml(c)}</option>`).join('')}</select>
        <button class="btn btn-add" data-name="${safeName}" data-sid="gcsel-${id}" onclick="addGoodCity(this)">+ Add City</button>
      </div>`
          : ''
      }
    </td></tr>`;
    })
    .join('');
}

async function saveGood(btn) {
  const name = btn.dataset.name;
  const row = btn.closest('tr');
  const base_price = parseInt(row.querySelector('[data-field="base"]').value);
  const type = row.querySelector('[data-field="type"]').value;
  const hop_pct = parseFloat(row.querySelector('[data-field="hop"]').value) / 100;
  const res = await api('/api/admin/goods/' + encodeURIComponent(name), { method: 'PATCH', body: JSON.stringify({ base_price, type, hop_pct }) });
  ss('gs-' + esc(name), res.ok);
}

async function addGood() {
  const name = v('ng-name'),
    base_price = parseInt(v('ng-price')),
    type = v('ng-type'),
    hop_pct = parseFloat(v('ng-hop')) / 100;
  if (!name || !base_price) return ss('ng-ss', false, 'Fill name & price');
  const res = await api('/api/admin/goods', { method: 'POST', body: JSON.stringify({ name, base_price, type, hop_pct }) });
  ss('ng-ss', res.ok);
  if (res.ok) {
    ['ng-name', 'ng-price', 'ng-hop'].forEach((i) => (el(i).value = ''));
    loadGoods();
  }
}

async function delGood(btn) {
  if (!confirm('Delete "' + btn.dataset.name + '"?')) return;
  const res = await api('/api/admin/goods/' + encodeURIComponent(btn.dataset.name), { method: 'DELETE' });
  if (res.ok) loadGoods();
}

async function addGoodCity(btn) {
  const city = el(btn.dataset.sid)?.value;
  if (!city) return;
  const res = await api('/api/admin/goods/' + encodeURIComponent(btn.dataset.name) + '/cities', { method: 'POST', body: JSON.stringify({ city_name: city }) });
  if (res.ok) loadGoods();
}

async function delGoodCity(span) {
  const res = await api('/api/admin/goods/' + encodeURIComponent(span.dataset.good) + '/cities/' + encodeURIComponent(span.dataset.city), { method: 'DELETE' });
  if (res.ok) loadGoods();
}

async function loadTravel() {
  const [tr, cr] = await Promise.all([api('/api/travel-times'), api('/api/cities')]);
  if (!tr.ok) return;
  const matrix = await tr.json();
  const rawCities = cr.ok ? await cr.json() : [];
  const cities = rawCities.length ? rawCities.map((c) => c.name) : Object.keys(matrix);
  let html = '<thead><tr><th></th>' + cities.map((c) => `<th>${escHtml(c)}</th>`).join('') + '</tr></thead><tbody>';
  for (const from of cities) {
    html += `<tr><th>${escHtml(from)}</th>`;
    for (const to of cities) {
      if (from === to) {
        html += '<td class="self">—</td>';
        continue;
      }
      const val = matrix[from]?.[to] ?? '';
      html += `<td><input type="number" value="${val}" min="0.1" step="0.1" data-from="${escHtml(from)}" data-to="${escHtml(to)}" onchange="saveTravel(this)" onkeydown="if(event.key==='Enter')this.blur()"></td>`;
    }
    html += '</tr>';
  }
  el('travel-table').innerHTML = html + '</tbody>';
}

async function saveTravel(input) {
  const minutes = parseFloat(input.value);
  if (!minutes || minutes <= 0) return;
  const res = await api('/api/admin/travel-times', { method: 'PUT', body: JSON.stringify({ from_city: input.dataset.from, to_city: input.dataset.to, minutes }) });
  flash(input, res.ok);
}
