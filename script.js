// === Utility & Storage ===
const cur = new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'});
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const getLS = (k, d=[]) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
const setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let movimenti = getLS('movimenti');
let fornitori = getLS('fornitori');
let filtroCorrente = 'tutti';
let filtroFornitore = '';

// === Init ===
(function init(){
  // set default date
  const dateInput = document.querySelector('#movForm input[name="data"]');
  dateInput.valueAsDate = new Date();

  renderFornitoriUI();
  renderFornitoriSelects();
  bindEvents();
  renderMovimenti();
  refreshSummary();
})();

// === Events ===
function bindEvents(){
  // Hamburger menu
  $('#btnMenu').addEventListener('click', () => $('#sideMenu').classList.toggle('open'));

  // Export CSV
  $('#btnExport').addEventListener('click', e => {
    e.preventDefault();
    exportCSV();
  });

  // Clear data
  $('#btnClear').addEventListener('click', e => {
    e.preventDefault();
    if(confirm('Sicuro di voler cancellare tutti i dati?')){
      movimenti = []; fornitori = [];
      setLS('movimenti', movimenti); setLS('fornitori', fornitori);
      renderFornitoriUI(); renderFornitoriSelects();
      renderMovimenti(); refreshSummary(); drawChart();
    }
  });

  // Form movimento
  $('#movForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const record = {
      id: f.dataset.editing || String(Date.now()),
      data: f.data.value,
      tipo: f.tipo.value,
      metodo: f.metodo.value,
      categoria: f.categoria.value,
      fornitore: f.fornitore.value,
      descrizione: f.descrizione.value,
      imponibile: parseFloat(f.imponibile.value),
      ivaPercent: parseFloat(f.ivaPercent.value || '0')
    };
    if(!record.data || isNaN(record.imponibile) || record.imponibile <= 0){
      alert('Compila data e imponibile valido.'); return;
    }
    const ix = movimenti.findIndex(m => m.id === record.id);
    if(ix >= 0){ movimenti[ix] = record; } else { movimenti.push(record); }
    setLS('movimenti', movimenti);
    f.reset(); delete f.dataset.editing;
    document.querySelector('#movForm input[name="data"]').valueAsDate = new Date();
    renderMovimenti(); refreshSummary(); drawChart();
  });

  // Filtro tipo
  $$('.filtro').forEach(btn => btn.addEventListener('click', () => {
    $$('.filtro').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroCorrente = btn.dataset.filtro;
    renderMovimenti(); refreshSummary();
  }));

  // Filtro fornitore
  $('#filtroFornitore').addEventListener('change', e => {
    filtroFornitore = e.target.value;
    renderMovimenti(); refreshSummary();
  });

  // Period change
  $('#period').addEventListener('change', quickReport);

  // Delegation movimenti actions
  $('#tabMov').addEventListener('click', e => {
    const id = e.target.dataset.id;
    if(e.target.classList.contains('btn-del')){
      movimenti = movimenti.filter(m => m.id !== id);
      setLS('movimenti', movimenti);
      renderMovimenti(); refreshSummary(); drawChart();
    }
    if(e.target.classList.contains('btn-edit')){
      const m = movimenti.find(x => x.id === id);
      if(!m) return;
      const f = $('#movForm');
      f.data.value = m.data;
      f.tipo.value = m.tipo;
      f.metodo.value = m.metodo;
      f.categoria.value = m.categoria;
      f.fornitore.value = m.fornitore || '';
      f.descrizione.value = m.descrizione || '';
      f.imponibile.value = m.imponibile;
      f.ivaPercent.value = m.ivaPercent;
      f.dataset.editing = m.id;
      window.location.hash = '#nuovo';
      window.scrollTo({top: f.offsetTop-60, behavior: 'smooth'});
    }
  });

  // Form fornitori
  $('#fornForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = e.target.nome.value.trim();
    if(!name) return;
    if(!fornitori.find(f => f.nome.toLowerCase() === name.toLowerCase())){
      fornitori.push({nome: name});
      setLS('fornitori', fornitori);
      renderFornitoriUI(); renderFornitoriSelects();
    }
    e.target.reset();
  });

  // Delegation fornitori delete
  $('#tabForn').addEventListener('click', e => {
    if(e.target.classList.contains('del-forn')){
      const name = e.target.dataset.name;
      fornitori = fornitori.filter(f => f.nome !== name);
      setLS('fornitori', fornitori);
      renderFornitoriUI(); renderFornitoriSelects();
      // Rimuovi selezione fornitore dai movimenti che lo usano?
      // Manteniamo i movimenti, ma lasceremo il testo del vecchio fornitore storicizzato.
    }
  });
}

// === Render Fornitori ===
function renderFornitoriUI(){
  const tbody = $('#tabForn tbody');
  tbody.innerHTML = '';
  fornitori
    .slice()
    .sort((a,b)=> a.nome.localeCompare(b.nome))
    .forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(f.nome)}</td>
        <td><button class="del-forn" data-name="${escapeHtml(f.nome)}">🗑️</button></td>`;
      tbody.appendChild(tr);
    });
}

function renderFornitoriSelects(){
  const selForm = $('#fornitoreSelect');
  const selFiltro = $('#filtroFornitore');
  selForm.innerHTML = '<option value="">-- Nessuno --</option>';
  selFiltro.innerHTML = '<option value="">Tutti</option>';
  fornitori
    .slice()
    .sort((a,b)=> a.nome.localeCompare(b.nome))
    .forEach(f => {
      const opt = document.createElement('option');
      opt.textContent = f.nome; opt.value = f.nome;
      selForm.appendChild(opt);
      const opt2 = document.createElement('option');
      opt2.textContent = f.nome; opt2.value = f.nome;
      selFiltro.appendChild(opt2);
    });
}

// === Render Movimenti ===
function renderMovimenti(){
  const tbody = $('#tabMov tbody');
  tbody.innerHTML='';
  const filtered = movimenti
    .filter(m => filtroCorrente==='tutti' ? true : m.tipo === filtroCorrente)
    .filter(m => !filtroFornitore ? true : (m.fornitore || '') === filtroFornitore)
    .sort((a,b)=> new Date(b.data) - new Date(a.data));

  let entr=0, usc=0, deb=0, cred=0;
  filtered.forEach(m => {
    const iva = m.imponibile * (m.ivaPercent/100);
    const tot = m.imponibile + iva;
    if(m.tipo==='entrata'){ entr += tot; deb += iva; } else { usc += tot; cred += iva; }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(m.data)}</td>
      <td>${escapeHtml(m.tipo)}</td>
      <td>${escapeHtml(m.metodo || '')}</td>
      <td>${escapeHtml(m.categoria || '')}</td>
      <td>${escapeHtml(m.fornitore || '')}</td>
      <td>${escapeHtml(m.descrizione || '')}</td>
      <td>${cur.format(tot)}</td>
      <td>
        <button class="btn-edit" data-id="${m.id}">✏️</button>
        <button class="btn-del" data-id="${m.id}">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });

  // Update top KPIs & saldo
  $('#kEntrate').textContent = cur.format(entr);
  $('#kUscite').textContent  = cur.format(usc);
  $('#kDebito').textContent  = cur.format(deb);
  $('#kCredito').textContent = cur.format(cred);
  $('#saldo').textContent    = cur.format(entr - usc);
  drawChart();
  quickReport();
  ivaReminder();
}

// === Summary, Chart & Reports ===
function refreshSummary(){
  // recompute on whole dataset, not only filtered list
  let e=0,u=0,d=0,c=0;
  movimenti.forEach(m => {
    const iva = m.imponibile * (m.ivaPercent/100);
    const tot = m.imponibile + iva;
    if(m.tipo==='entrata'){ e+=tot; d+=iva; } else { u+=tot; c+=iva; }
  });
  $('#kEntrate').textContent = cur.format(e);
  $('#kUscite').textContent  = cur.format(u);
  $('#kDebito').textContent  = cur.format(d);
  $('#kCredito').textContent = cur.format(c);
  $('#saldo').textContent    = cur.format(e - u);
  drawChart();
  quickReport();
  ivaReminder();
}

function drawChart(){
  const c = $('#chart');
  const ctx = c.getContext('2d');
  const W = c.clientWidth, H = 240;
  c.width = W * devicePixelRatio;
  c.height = H * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0,0,W,H);

  // Build monthly balances
  const monthly = {};
  movimenti.forEach(m => {
    const key = (m.data || '').slice(0,7);
    if(!key) return;
    const iva = m.imponibile * (m.ivaPercent/100);
    const tot = m.imponibile + iva;
    monthly[key] = (monthly[key] || 0) + (m.tipo==='entrata' ? tot : -tot);
  });
  const keys = Object.keys(monthly).sort();
  if(keys.length === 0) return;

  const vals = keys.map(k => monthly[k]);
  const max = Math.max(...vals.map(v => Math.abs(v)), 1);
  const padL = 30, padR = 10, baseY = H/2;
  const colW = (W - padL - padR) / keys.length * 0.6;

  keys.forEach((k,i) => {
    const x = padL + i * (W - padL - padR) / keys.length;
    const h = (vals[i] / max) * (H - 60);
    ctx.fillStyle = vals[i] >= 0 ? '#10b981' : '#ef4444';
    ctx.fillRect(x, baseY - h, colW, Math.abs(h));
    ctx.fillStyle = '#555';
    ctx.fillText(k.slice(5), x, H - 10);
  });
}

function quickReport(){
  const p = $('#period').value;
  const now = new Date(); let from = new Date();
  if(p==='W') from.setDate(now.getDate()-7);
  if(p==='M') from.setMonth(now.getMonth()-1);
  if(p==='Q') from.setMonth(now.getMonth()-3);
  if(p==='Y') from.setFullYear(now.getFullYear()-1);
  let e=0,u=0;
  movimenti.forEach(m => {
    const d = new Date(m.data);
    if(d >= from){
      const iva = m.imponibile * (m.ivaPercent/100);
      const tot = m.imponibile + iva;
      if(m.tipo==='entrata') e+=tot; else u+=tot;
    }
  });
  $('#report').textContent = `Periodo: ${cur.format(e-u)} (Entrate ${cur.format(e)} – Uscite ${cur.format(u)})`;
}

function ivaReminder(){
  const now = new Date();
  const q = Math.floor(now.getMonth()/3)+1;
  let mEnd = q*3, y = now.getFullYear();
  if(mEnd>12){ mEnd=3; y++; }
  const dates = [[4,30],[7,31],[10,31],[1,31]]; // Apr 30, Jul 31, Oct 31, Jan 31
  const [m,d] = dates[q%4];
  const due = new Date(y, m-1, d);
  const diff = Math.ceil((due - now) / (1000*60*60*24));
  $('#ivaReminder').textContent = `Prossima scadenza: ${due.toLocaleDateString()} (mancano ${diff} giorni)`;
}

// === CSV Export ===
function exportCSV(){
  const rows = [['Data','Tipo','Metodo','Categoria','Fornitore','Descrizione','Imponibile','IVA%']];
  movimenti.forEach(m => rows.push([m.data,m.tipo,m.metodo||'',m.categoria||'',m.fornitore||'',m.descrizione||'',String(m.imponibile).replace('.',','),String(m.ivaPercent).replace('.',',')]));
  const csv = rows.map(r => r.map(cell => String(cell).includes(';') ? `"${cell}"` : cell).join(';')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'movimenti.csv';
  a.click();
}

// === Helpers ===
function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
