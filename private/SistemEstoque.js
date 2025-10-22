document.addEventListener('DOMContentLoaded', () => {
    const loggedUser = localStorage.getItem('loggedUser');
    if (!loggedUser) {
        window.location.href = "/public/Login.html";
    }
});

function uid(prefix = 'id') { return prefix + '_' + Math.random().toString(36).slice(2, 10); }
const KEY_PRODUCTS = 'vtz_produtos';
const KEY_LOGS = 'vtz_logs';
const KEY_SALES = 'vtz_vendas';

let products = JSON.parse(localStorage.getItem(KEY_PRODUCTS) || 'null') || [];
let logs = JSON.parse(localStorage.getItem(KEY_LOGS) || 'null') || [];
let sales = JSON.parse(localStorage.getItem(KEY_SALES) || 'null') || [];

let storedUser = localStorage.getItem('vtz_user');
let currentUser = storedUser || (document.getElementById('usuarioAtualHeader') && document.getElementById('usuarioAtualHeader').value) || 'admin';
let currentSearch = '';
let currentDetailProductIndex = null;
let sellingIndex = null;
let editingIndex = null;

function persistAll() {
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
    localStorage.setItem(KEY_LOGS, JSON.stringify(logs));
    localStorage.setItem(KEY_SALES, JSON.stringify(sales));
}

function esc(s) { if (s === null || s === undefined) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function addLogStructured(type, message, before = null, after = null, meta = null) {
    const entry = { id: uid('log'), ts: new Date().toISOString(), user: currentUser, type, message, before, after, meta };
    logs.unshift(entry);
    if (logs.length > 1000) logs.length = 1000;
    persistAll();
    renderLogs();
}
function addLog(msg) { addLogStructured('info', msg); }

function renderLogs() {
    const el = document.getElementById('logList');
    if (!el) return;
    el.innerHTML = logs.map(l => {
        const time = (new Date(l.ts)).toLocaleString();
        let extra = '';
        if (l.before !== null || l.after !== null) {
            extra = `<div style="font-family:var(--mono);color:#333;margin-top:6px;font-size:12px">Antes: ${esc(String(l.before || ''))} → Depois: ${esc(String(l.after || ''))}</div>`;
        }
        return `<div style="padding:8px;border-bottom:1px dashed #f0f0f0">
                <div style="font-size:13px"><strong>${esc(l.user)}</strong> • ${esc(l.type)} • <small style="color:#007bff; font-weight:bold;">${time}</small></div>
                <div style="margin-top:6px">${esc(l.message)}</div>
                ${extra}
              </div>`;
    }).join('');
}

function updateDashboard() {
    document.getElementById('cardProducts').innerText = products.length;
    document.getElementById('sideTotalCount').innerText = products.length;
    const totalQty = products.reduce((a, b) => a + (b.quantidade || 0), 0);
    document.getElementById('sideTotalQty').innerText = totalQty;
    // low stock threshold
    const lowThreshold = 5;
    const lowCount = products.filter(p => (p.quantidade || 0) <= lowThreshold).length;
    const expireCount = products.filter(p => {
        if (!p.validade) return false;
        const diff = (new Date(p.validade) - new Date()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 30;
    }).length;
    document.getElementById('sideLowCount').innerText = lowCount;
    document.getElementById('cardLow').innerText = lowCount;
    document.getElementById('sideExpireCount').innerText = expireCount;
    document.getElementById('cardExpire').innerText = expireCount;
}

function updateAlertsAndSales() {
    const alertsEl = document.getElementById('alertsList');
    alertsEl.innerHTML = '';
    const lowThreshold = 5;
    const lowItems = products.filter(p => (p.quantidade || 0) <= lowThreshold);
    const soonExpire = products.filter(p => {
        if (!p.validade) return false;
        const diff = (new Date(p.validade) - new Date()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 30;
    });
    const items = [];
    lowItems.slice(0, 5).forEach(p => {
        const div = document.createElement('div');
        div.className = 'alert-item';
        div.innerText = `Baixo estoque: ${p.nome} • ${p.quantidade || 0} unidades`;
        div.onclick = () => { currentSearch = p.nome; document.getElementById('searchInput').value = p.nome; renderProductList(p.nome); };
        alertsEl.appendChild(div);
    });
    soonExpire.slice(0, 5).forEach(p => {
        const div = document.createElement('div');
        div.className = 'alert-item';
        div.innerText = `Vence em breve: ${p.nome} • validade: ${p.validade || '-'}`;
        div.onclick = () => { currentSearch = p.nome; document.getElementById('searchInput').value = p.nome; renderProductList(p.nome); };
        alertsEl.appendChild(div);
    });

    // sales list
    const salesEl = document.getElementById('salesList');
    salesEl.innerHTML = '';
    sales.slice(0, 8).forEach(s => {
        const d = document.createElement('div');
        d.style.padding = '6px';
        d.style.borderBottom = '1px dashed #eee';
        d.innerHTML = `<div style="font-weight:800">${esc(s.produto)}</div><small style="color:var(--muted-text)">${new Date(s.ts).toLocaleString()}</small>`;
        salesEl.appendChild(d);
    });
}

function renderProductList(filterText = '') {
    const listEl = document.getElementById('productList');
    listEl.innerHTML = '';
    const normalizedFilter = (filterText || currentSearch || '').trim().toLowerCase();
    products.forEach((p, idx) => {
        if (normalizedFilter) {
            const hay = `${p.nome} ${p.codigo || ''} ${p.localizacao || ''}`.toLowerCase();
            if (!hay.includes(normalizedFilter)) return;
        }
        const div = document.createElement('div');
        div.className = 'row-card';
        div.onclick = () => openDetails(idx);
        div.innerHTML = `
        <div class="index-pill" title="Índice">${idx + 1}</div>
        <div class="thumb"><img title="Imagem do produto" src="${esc(p.imagem) || 'https://via.placeholder.com/140x90?text=SEM'}" alt="${esc(p.nome)}" /></div>
        <div class="col"><input title="Nome do produto" value="${esc(p.nome)}" onchange="onInlineEdit(${idx}, 'nome', this.value)" /></div>
        <div class="col"><input title="Unidade de medida" value="${esc(p.peso || '')}" onchange="onInlineEdit(${idx}, 'peso', this.value)" /></div>
        <div class="col"><input title="Localização" value="${esc(p.localizacao || '')}" onchange="onInlineEdit(${idx}, 'localizacao', this.value)" /></div>
        <div class="col"><input title="Código do produto" value="${esc(p.codigo || '')}" onchange="onInlineEdit(${idx}, 'codigo', this.value)" /></div>
        <div class="col"><input title="Entrada no estoque" type="date" value="${esc(p.entrada || '')}" onchange="onInlineEdit(${idx}, 'entrada', this.value)" /></div>
        <div class="col"><input title="Validade" type="date" value="${esc(p.validade || '')}" onchange="onInlineEdit(${idx}, 'validade', this.value)" /></div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:center">
          <div class="qty">
            <button title="Diminuir" onclick="adjustQty(${idx}, -1)">-</button>
            <div style="min-width:20px;text-align:center;font-weight:500">${p.quantidade || 0}</div>
            <button title="Aumentar" onclick="adjustQty(${idx}, 1)">+</button>
          </div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <div class="gear" title="Detalhar" onclick="openDetails(${idx})">🔎</div>
            <div class="gear" title="Vender" onclick="openSell(${idx})">💰</div>
            <div class="gear" title="Remover" onclick="removeProduct(${idx})">🗑️</div>
          </div>
        </div>
      `;
        listEl.appendChild(div);
    });
    updateDashboard();
    updateAlertsAndSales();
    persistAll();
}

function onInlineEdit(index, field, newValue) {
    const product = products[index];
    const before = product[field];
    const value = (field === 'quantidade') ? (parseInt(newValue) || 0) : newValue;
    product[field] = value;
    addLogStructured('edit', `Editou campo "${field}" do produto "${product.nome}"`, before, value, { productId: product.id });
    persistAll();
    renderProductList(currentSearch);
}

function adjustQty(index, delta) {
    const product = products[index];
    const before = product.quantidade || 0;
    let after = before + delta;
    if (after < 0) after = 0;
    product.quantidade = after;
    addLogStructured('quantidade', `Alterou quantidade de "${product.nome}"`, before, after, { productId: product.id });
    persistAll();
    renderProductList(currentSearch);
    updateAlertsAndSales();
}

function removeProduct(index) {
    const p = products[index];
    if (!confirm(`Confirmar remoção do produto "${p.nome}" (código: ${p.codigo || '—'})?`)) return;
    products.splice(index, 1);
    addLogStructured('remover', `Removeu produto "${p.nome}"`, null, null, { productId: p.id });
    persistAll();
    renderProductList(currentSearch);
    renderLogs();
}

function openAddModal(editIdx = null) {
    editingIndex = (typeof editIdx === 'number') ? editIdx : null;
    document.getElementById('modalAddTitle').innerText = editingIndex === null ? 'Adicionar Produto' : 'Editar Produto';
    if (editingIndex !== null) {
        const p = products[editingIndex];
        document.getElementById('field_nome').value = p.nome || '';
        document.getElementById('field_peso').value = p.peso || '';
        document.getElementById('field_local').value = p.localizacao || '';
        document.getElementById('field_codigo').value = p.codigo || '';
        document.getElementById('field_entrada').value = p.entrada || '';
        document.getElementById('field_validade').value = p.validade || '';
        document.getElementById('field_quantidade').value = p.quantidade || 0;
        document.getElementById('field_imagem').value = p.imagem || '';
    } else {
        document.getElementById('field_nome').value = '';
        document.getElementById('field_peso').value = '';
        document.getElementById('field_local').value = '';
        document.getElementById('field_codigo').value = '';
        document.getElementById('field_entrada').value = '';
        document.getElementById('field_validade').value = '';
        document.getElementById('field_quantidade').value = 1;
        document.getElementById('field_imagem').value = '';
    }
    document.getElementById('modalAdd').style.display = 'flex';
}

function closeAddModal() {
    document.getElementById('modalAdd').style.display = 'none';
    editingIndex = null;
}

function saveProduct() {
    const nome = document.getElementById('field_nome').value.trim();
    const peso = document.getElementById('field_peso').value.trim();
    const localizacao = document.getElementById('field_local').value.trim();
    const codigo = document.getElementById('field_codigo').value.trim();
    const entrada = document.getElementById('field_entrada').value;
    const validade = document.getElementById('field_validade').value;
    const quantidade = parseInt(document.getElementById('field_quantidade').value) || 0;
    const imagem = document.getElementById('field_imagem').value.trim();

    if (!nome) { alert('Nome é obrigatório'); return; }

    const novo = { id: uid('p'), nome, peso, localizacao, codigo, entrada, validade, quantidade, imagem };

    if (editingIndex !== null) {
        const beforeObj = { ...products[editingIndex] };
        products[editingIndex] = novo;
        addLogStructured('editar', `Editou lote do produto "${novo.nome}"`, beforeObj.quantidade, novo.quantidade, { before: beforeObj, after: novo });
        persistAll();
        renderProductList(currentSearch);
        closeAddModal();
        return;
    }

    const exactIndex = products.findIndex(p => p.nome === novo.nome && p.codigo === novo.codigo && p.localizacao === novo.localizacao);
    if (exactIndex >= 0) {
        const choice = confirm(`Já existe um produto com mesmo Nome + Código + Localização:\n${novo.nome} • ${novo.codigo} • ${novo.localizacao}\n\nDeseja somar a quantidade ao registro existente? (OK = Somar / Cancel = Criar novo)`);
        if (choice) {
            const before = products[exactIndex].quantidade || 0;
            products[exactIndex].quantidade = before + novo.quantidade;
            addLogStructured('merge', `Mesclou quantidades para "${novo.nome}"`, before, products[exactIndex].quantidade, { targetIndex: exactIndex });
            persistAll();
            renderProductList(currentSearch);
            closeAddModal();
            return;
        } else {
            products.push(novo);
            addLogStructured('novo', `Criou novo lote duplicado para "${novo.nome}"`, null, novo.quantidade, { new: novo });
            persistAll();
            renderProductList(currentSearch);
            closeAddModal();
            return;
        }
    }

    const similars = products.filter(p => p.nome === novo.nome && p.codigo === novo.codigo);
    if (similars.length > 0) {
        const want = confirm(`Encontrado(s) ${similars.length} lote(s) com mesmo Nome+Código em outras localizações.\nDeseja somar a um lote existente? (OK) ou criar novo (Cancelar)?`);
        if (want) {
            let msg = 'Escolha o número do lote para somar:\n';
            similars.forEach((s, i) => {
                msg += `${i + 1}) Local: ${s.localizacao || '-'} • qtd: ${s.quantidade || 0} • validade: ${s.validade || '-'}\n`;
            });
            const pick = prompt(msg + '\nDigite o número (1..' + similars.length + ') ou deixe em branco para cancelar:');
            const n = parseInt(pick);
            if (n >= 1 && n <= similars.length) {
                const sim = similars[n - 1];
                const globalIndex = products.findIndex(p => p.id === sim.id);
                if (globalIndex >= 0) {
                    const before = products[globalIndex].quantidade || 0;
                    products[globalIndex].quantidade = before + novo.quantidade;
                    addLogStructured('merge_similar', `Somou ${novo.quantidade} ao lote existente de "${novo.nome}" (local ${products[globalIndex].localizacao})`, before, products[globalIndex].quantidade, { targetIndex: globalIndex });
                    persistAll();
                    renderProductList(currentSearch);
                    closeAddModal();
                    return;
                }
            }
        }
    }

    products.push(novo);
    addLogStructured('novo', `Adicionou novo produto "${novo.nome}"`, null, novo.quantidade, { new: novo });
    persistAll();
    renderProductList(currentSearch);
    closeAddModal();
}

function openDetails(index) {
    currentDetailProductIndex = index;
    const base = products[index];
    const same = products
        .map((p, i) => ({ ...p, __idx: i }))
        .filter(p => p.nome === base.nome && p.codigo === base.codigo)
        .sort((a, b) => {
            if (!a.validade) return 1;
            if (!b.validade) return -1;
            return new Date(a.validade) - new Date(b.validade);
        });

    const body = document.getElementById('modalDetailsBody');
    body.innerHTML = '';
    same.forEach(s => {
        const el = document.createElement('div');
        el.className = 'detail-row';
        el.innerHTML = `
        <div style="flex:1">
          <div style="font-weight:800">${esc(s.nome)}</div>
          <div style="font-size:13px;color:var(--muted-text)">Local: ${esc(s.localizacao || '-')} • Código: ${esc(s.codigo || '-')}</div>
          <div style="font-size:13px;color:var(--muted-text)">Entrada: ${esc(s.entrada || '-')} • Validade: ${esc(s.validade || '-')}</div>
        </div>
        <div style="width:120px;text-align:center">
          <div style="font-weight:900;font-size:18px">${s.quantidade || 0}</div>
          <div style="display:flex;gap:6px;justify-content:center;margin-top:8px">
            <button class="btn btn-ghost" onclick="openAddModal(${s.__idx})">Editar</button>
            <button class="btn btn-warn" onclick="openSell(${s.__idx})">Vender</button>
          </div>
        </div>
      `;
        body.appendChild(el);
    });

    document.getElementById('modalDetails').style.display = 'flex';
}

function closeDetailsModal() {
    document.getElementById('modalDetails').style.display = 'none';
    currentDetailProductIndex = null;
}

function openSell(index) {
    sellingIndex = index;
    const p = products[index];
    document.getElementById('sellItemInfo').value = `${p.nome} • ${p.localizacao || '-'} • qtd: ${p.quantidade || 0}`;
    document.getElementById('sellQty').value = 1;
    document.getElementById('sellBuyer').value = '';
    document.getElementById('sellDoc').value = '';
    document.getElementById('modalSell').style.display = 'flex';
}

function closeSellModal() {
    document.getElementById('modalSell').style.display = 'none';
    sellingIndex = null;
}

function confirmSell() {
    const qty = parseInt(document.getElementById('sellQty').value) || 0;
    const buyer = document.getElementById('sellBuyer').value.trim() || 'Consumidor';
    const doc = document.getElementById('sellDoc').value.trim() || '';
    if (sellingIndex === null) { alert('Nenhum produto selecionado'); return; }
    const p = products[sellingIndex];
    if ((p.quantidade || 0) < qty) { alert('Quantidade insuficiente'); return; }
    const before = p.quantidade || 0;
    p.quantidade = before - qty;
    const sale = { id: uid('s'), produto: p.nome, quantidade: qty, comprador: buyer, doc, ts: new Date().toISOString(), productId: p.id };
    sales.unshift(sale);
    addLogStructured('venda', `Vendeu ${qty} de "${p.nome}" para ${buyer}`, before, p.quantidade, { saleId: sale.id });
    persistAll();
    renderProductList(currentSearch);
    updateAlertsAndSales();
    closeSellModal();
}

function exportCSV() {
    const rows = [['id', 'nome', 'peso', 'localizacao', 'codigo', 'entrada', 'validade', 'quantidade', 'imagem']];
    products.forEach(p => rows.push([p.id || '', p.nome || '', p.peso || '', p.localizacao || '', p.codigo || '', p.entrada || '', p.validade || '', p.quantidade || 0, p.imagem || '']));
    const csv = rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vtz_produtos_${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

function exportJSON() {
    const data = JSON.stringify({ products, logs, sales }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `vtz_backup_${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

function exportPDF() {
    // Simples: abrir nova janela com tabela e chamar print
    let html = `<html><head><title>Exportar PDF - VTZ</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}</style></head><body>`;
    html += `<h2>Produtos VTZ — ${new Date().toLocaleString()}</h2>`;
    html += `<table><thead><tr><th>Nome</th><th>Local</th><th>Código</th><th>Qtd</th><th>Validade</th></tr></thead><tbody>`;
    products.forEach(p => {
        html += `<tr><td>${esc(p.nome)}</td><td>${esc(p.localizacao || '')}</td><td>${esc(p.codigo || '')}</td><td>${p.quantidade || 0}</td><td>${esc(p.validade || '')}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    // Give user chance to print
}

function exportLogsPDF() {
    // Cria o conteúdo HTML do PDF
    let html = `
             ml>
      <head>
        <title>Logs de           - VTZ</title>
        <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 20px; }
        h2 { color: #0b5e20; }
        table { width: 100%; border-collap          llapse; margin-top: 12px;                    h, td { border: 1px sol          c; padding: 8px; text-align: left; font-size: 13px; }
            th { background-color: #e8f5e9; color: #0b5e20; }
      tr:nth-child(even) { background-color: #fafafa; }
      small { color: #666; }
    </style>
  </head>
  <body>
    <h2>📜 Logs de Ações — ${new Date().toLocaleString()}</h2>
    <table>
           thead>
        <tr>
          <th>Data / Hora</th>
          <th>U          </th>
          <th>Tipo</th>
          <th>Mensagem</th>
          <th>Antes → Depois</th>
        </tr>
      </thead>
          <tbody>
  `;
    logs.forEach(l => {
        const beforeAfter =
            (l.before !== null || l.after !== null)
                ? `${l.before || ''} → ${l.after || ''}`
                : '';
        html += `
      <tr>
        <td>${new Date(l.ts).toLocaleString()}</td>
        <td>${l.user || '-'}</td>
        <td>${l.type || '-'}</td>
        <td>${l.message || '-'}</td>
        <td>${beforeAfter}</td>
      </tr>
    `;
    });

    html += `
      </tbody>
    </table>
  </body>
  </html>
  `;

    // Abre nova janela e imprime (gerando PDF)
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
}

function onSearch() {
    const v = document.getElementById('searchInput').value || '';
    currentSearch = v;
    renderProductList(v);
}

// allow changing user inline
document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'usuarioAtualHeader') {
        currentUser = e.target.value.trim() || 'admin';
        localStorage.setItem('vtz_user', currentUser);
    }
});

// Init demo data if empty
window.onload = function () {
    if (!products || products.length === 0) {
        products = [
            { id: uid('p'), nome: 'Nabo', peso: '10 KG', localizacao: 'N1', codigo: '725156365', entrada: '2023-07-02', validade: '2025-09-02', quantidade: 28, imagem: '' },
            { id: uid('p'), nome: 'TRIGO MOURISCO', peso: '05 KG', localizacao: 'S2', codigo: '78955332', entrada: '2023-07-02', validade: '2025-10-02', quantidade: 32, imagem: '' },
            { id: uid('p'), nome: 'BRACHIARIAS', peso: '10 KG', localizacao: 'S1', codigo: '56284587', entrada: '2023-07-02', validade: '2025-11-02', quantidade: 45, imagem: '' },
            { id: uid('p'), nome: 'Exemplo 2', peso: '50 Metros', localizacao: 'S3', codigo: 'EX002', entrada: '2024-02-10', validade: '2025-02-09', quantidade: 12, imagem: '' },
            { id: uid('p'), nome: 'Exemplo 3', peso: '05 KG', localizacao: 'S4', codigo: 'EX003', entrada: '2024-03-12', validade: '2025-09-02', quantidade: 3, imagem: '' },
        ];
        addLog(`Dados iniciais carregados (demo)`);
        persistAll();
    }


    if (!localStorage.getItem('loggedUser')) {
        window.location.href = "Login.html";
    } else {
        currentUser = localStorage.getItem('loggedUser');
        const headerUser = document.getElementById('usuarioAtualHeader');
        if (headerUser) headerUser.value = currentUser;
    }

    renderProductList();
    renderLogs();
    updateDashboard();
    updateAlertsAndSales();
}
function previewProductImage(url) {
    const img = document.getElementById("previewImg");
    if (url && url.startsWith("http")) {
        img.src = url;
        img.style.display = "block";
    } else {
        img.style.display = "none";
    }
}

// Validação visual no Salvar
const requiredFields = ["field_nome", "field_peso", "field_local", "field_codigo"];
function validateFields() {
    let valid = true;
    requiredFields.forEach(id => {
        const input = document.getElementById(id);
        if (!input.value.trim()) {
            input.style.border = "2px solid #e74c3c";
            valid = false;
        } else {
            input.style.border = "1px solid #cfd8dc";
        }
    });
    return valid;
}

const oldSave = saveProduct;
saveProduct = function () {
    if (!validateFields()) {
        alert("⚠️ Preencha todos os campos obrigatórios!");
        return;
    }
    oldSave();
};

// ---------------------------------------------
// 📥 Baixar modelo Excel padrão
// ---------------------------------------------
function downloadExcelTemplate() {
    const wb = XLSX.utils.book_new();
    const wsData = [
        ["Nome", "Peso", "Localização", "Código", "Entrada", "Validade", "Quantidade", "Imagem"],
        ["Exemplo Produto", "10 KG", "N1", "123456", "2024-07-01", "2026-07-01", "50", "https://exemplo.com/imagem.jpg"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "Modelo_Estoque_VTZ.xlsx");
}

// ---------------------------------------------
// 📤 Importar planilha Excel (.xlsx) com modal de revisão
// ---------------------------------------------
let importPreview = []; // guarda produtos importados + status temporário

document.getElementById("excelInput").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
            alert("⚠️ Nenhum dado encontrado no Excel.");
            return;
        }

        importPreview = json.map(row => {
            const novo = {
                id: uid('p'),
                nome: String(row.Nome || "").trim(),
                peso: String(row.Peso || "").trim(),
                localizacao: String(row.Localização || row.Local || "").trim(),
                codigo: String(row.Código || "").trim(),
                entrada: row.Entrada || "",
                validade: row.Validade || "",
                quantidade: parseInt(row.Quantidade) || 0,
                imagem: row.Imagem || ""
            };

            const existente = products.find(p =>
                p.nome === novo.nome &&
                p.codigo === novo.codigo &&
                p.validade === novo.validade &&
                p.localizacao === novo.localizacao &&
                p.peso === novo.peso
            );

            return {
                ...novo,
                duplicado: !!existente,
                existenteId: existente ? existente.id : null,
                action: existente ? "none" : "new" // 'sum', 'ignore', 'replace', 'new'
            };
        });

        renderImportModal();
    };

    reader.readAsArrayBuffer(file);
});

// ---------------------------------------------
// 🪟 Renderiza modal de revisão
// ---------------------------------------------
function renderImportModal() {
    const tbody = document.querySelector("#importTable tbody");
    tbody.innerHTML = "";

    importPreview.forEach((p, idx) => {
        const row = document.createElement("tr");
        row.style.background = p.duplicado ? "#fff8e1" : "#e8f5e9";

        // texto de status
        let statusText = "✅ Novo";
        let actionButtons = "-";

        if (p.duplicado) {
            if (p.action === "sum") {
                statusText = "➕ Somando";
            } else if (p.action === "ignore") {
                statusText = "🚫 Ignorado";
            } else if (p.action === "replace") {
                statusText = "🔁 Substituído";
            } else {
                statusText = "⚠️ Duplicado";
            }

            const disabled = (a) => (p.action && p.action !== "none" && p.action !== a ? "disabled" : "");

            actionButtons = `
          <button class="btn btn-ghost" ${disabled("sum")} onclick="setImportAction(${idx},'sum')">
          ${p.action === "sum" ? "✅ Confirmado" : "➕ Somar"}
          </button>
          <button class="btn btn-ghost" ${disabled("ignore")} onclick="setImportAction(${idx},'ignore')">
          ${p.action === "ignore" ? "✅ Confirmado" : "🚫 Ignorar"}
          </button>
          <button class="btn btn-ghost" ${disabled("replace")} onclick="setImportAction(${idx},'replace')">
          ${p.action === "replace" ? "✅ Confirmado" : "🔁 Substituir"}
          </button>
        `;
        }

        row.innerHTML = `
        <td>${p.nome}</td>
        <td>${p.peso}</td>
        <td>${p.localizacao}</td>
        <td>${p.codigo}</td>
        <td>${p.validade}</td>
        <td>${p.quantidade}</td>
        <td>${statusText}</td>
        <td>${actionButtons}</td>
      `;
        tbody.appendChild(row);
    });

    document.getElementById("importModal").style.display = "flex";
}

function setImportAction(index, action) {
    importPreview[index].action = action;
    renderImportModal();
}

function closeImportModal() {
    if (confirm("Deseja cancelar a importação? Nenhuma alteração será aplicada.")) {
        importPreview = [];
        document.getElementById("importModal").style.display = "none";
    }
}

// ---------------------------------------------
// ✅ Confirmar importação e aplicar no estoque
// ---------------------------------------------
function confirmImportChanges() {
    let importedCount = 0;
    let mergedCount = 0;
    let replacedCount = 0;

    importPreview.forEach(item => {
        if (item.duplicado) {
            const existente = products.find(p => p.id === item.existenteId);
            if (!existente) return;

            if (item.action === "sum") {
                const before = existente.quantidade;
                existente.quantidade += item.quantidade;
                mergedCount++;
                addLogStructured("merge_import", `Somou ${item.quantidade} unidades ao produto "${item.nome}"`, before, existente.quantidade, { produto: existente });
            } else if (item.action === "replace") {
                existente.quantidade = item.quantidade;
                existente.entrada = item.entrada;
                existente.validade = item.validade;
                existente.imagem = item.imagem;
                replacedCount++;
                addLogStructured("replace_import", `Substituiu dados do produto "${item.nome}"`, null, item.quantidade, { produto: existente });
            } // ignore = nada
        } else if (item.action === "new") {
            products.push(item);
            importedCount++;
            addLogStructured("novo_import", `Importou novo produto "${item.nome}" do Excel`, null, item.quantidade, { novo: item });
        }
    });

    persistAll();
    renderProductList();
    updateAlertsAndSales();
    document.getElementById("importModal").style.display = "none";

    alert(`✅ Importação concluída!
      🆕 Novos: ${importedCount}
      ➕ Somados: ${mergedCount}
      🔁 Substituídos: ${replacedCount}`);
}

// ---------------------------------------------
// 🔎 Pesquisa inteligente com Fuse.js
// ---------------------------------------------
const fuseOptions = {
    keys: ['nome', 'codigo', 'localizacao', 'validade', 'peso'],
    threshold: 0.4,
};

function handleSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        renderProductList(products);
        return;
    }

    const fuse = new Fuse(products, fuseOptions);
    const results = fuse.search(query).map(r => r.item);
    renderProductList(results);
}

function logout() {
  localStorage.removeItem('loggedUser');
  window.location.href = "Login.html";

}
