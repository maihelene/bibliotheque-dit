// ================================================
// loans.js — Page Emprunts & Retards
// ================================================
async function renderLoans() {
  document.getElementById('pageTitle').textContent = 'Emprunts';
  const container = document.getElementById('mainContent');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Chargement...</div>`;
  try {
    const res = await API.loans.getAll();
    renderLoansUI(res.data);
  } catch (err) {
    container.innerHTML = `<div class="empty-state">❌<p>${escHtml(err.message)}</p></div>`;
  }
}

function renderLoansUI(loans) {
  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div><h2>🤝 Emprunts</h2><p>${loans.length} emprunt(s)</p></div>
      <button class="btn btn-primary" onclick="openLoanModal()">+ Nouvel emprunt</button>
    </div>
    <div class="section-card">
      <div class="filter-tabs" id="loanFilterTabs">
        <button class="filter-tab active" data-status="all">Tous</button>
        <button class="filter-tab" data-status="active">Actifs</button>
        <button class="filter-tab" data-status="overdue">En retard</button>
        <button class="filter-tab" data-status="returned">Retournés</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Livre</th><th>Utilisateur</th><th>Emprunt</th><th>Retour prévu</th><th>Retourné le</th><th>Statut</th><th>Action</th></tr></thead>
          <tbody id="loansTableBody">${renderLoansRows(loans)}</tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelectorAll('#loanFilterTabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#loanFilterTabs .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const s = btn.dataset.status;
      document.getElementById('loansTableBody').innerHTML = renderLoansRows(s === 'all' ? loans : loans.filter(l => l.status === s));
    });
  });
}

function renderLoansRows(loans) {
  if (!loans.length) return `<tr><td colspan="8"><div class="empty-state">📭<p>Aucun emprunt</p></div></td></tr>`;
  return loans.map((l, i) => `<tr>
    <td>${i+1}</td>
    <td><strong>${escHtml(l.book_title)}</strong></td>
    <td>${escHtml(l.user_name)}</td>
    <td>${formatDate(l.loan_date)}</td>
    <td>${formatDate(l.due_date)}</td>
    <td>${l.return_date ? formatDate(l.return_date) : '—'}</td>
    <td>${loanStatusBadge(l.status)}</td>
    <td>${l.status !== 'returned'
      ? `<button class="btn btn-sm btn-success" onclick="returnLoan(${l.id},'${escHtml(l.book_title)}')">↩ Retourner</button>`
      : `<span style="color:var(--gray-400);font-size:.82rem">Terminé</span>`}
    </td>
  </tr>`).join('');
}

async function renderOverdue() {
  document.getElementById('pageTitle').textContent = 'Retards';
  const container = document.getElementById('mainContent');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Chargement...</div>`;
  try {
    const res   = await API.loans.getOverdue();
    const loans = res.data;
    container.innerHTML = `
      <div class="page-header"><div><h2>⚠️ Emprunts en retard</h2><p>${loans.length} retard(s)</p></div></div>
      ${loans.length > 0 ? `<div class="alert-banner">⚠️ <span>Ces livres n'ont pas été retournés dans les délais.</span></div>` : ''}
      <div class="section-card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Livre</th><th>Utilisateur</th><th>Date limite</th><th>Jours de retard</th><th>Action</th></tr></thead>
            <tbody>
              ${loans.length === 0
                ? `<tr><td colspan="6"><div class="empty-state">✅<p>Aucun retard — tout est en ordre !</p></div></td></tr>`
                : loans.map((l, i) => `<tr>
                    <td>${i+1}</td>
                    <td><strong>${escHtml(l.book_title)}</strong></td>
                    <td>${escHtml(l.user_name)}</td>
                    <td>${formatDate(l.due_date)}</td>
                    <td><span class="badge badge-danger">${l.days_overdue} jour(s)</span></td>
                    <td><button class="btn btn-sm btn-success" onclick="returnLoan(${l.id},'${escHtml(l.book_title)}')">↩ Retourner</button></td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">❌<p>${escHtml(err.message)}</p></div>`;
  }
}

async function openLoanModal() {
  let books = [], users = [];
  try { books = (await API.books.getAll()).data.filter(b => b.available > 0); } catch {}
  try { users = (await API.users.getAll()).data; } catch {}

  openModal('Nouvel emprunt', `
    <form id="loanForm">
      <div class="form-group"><label class="form-label">Livre <span>*</span></label>
        <select class="form-control" name="book_id" required>
          <option value="">-- Sélectionner un livre --</option>
          ${books.map(b => `<option value="${b.id}">${escHtml(b.title)} (${b.available} dispo.)</option>`).join('')}
        </select>
        ${books.length === 0 ? `<p style="color:var(--warning);font-size:.82rem;margin-top:4px">Aucun livre disponible.</p>` : ''}
      </div>
      <div class="form-group"><label class="form-label">Utilisateur <span>*</span></label>
        <select class="form-control" name="user_id" required>
          <option value="">-- Sélectionner un utilisateur --</option>
          ${users.map(u => `<option value="${u.id}">${escHtml(u.name)} (${u.type})</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">Date de retour prévue</label>
        <input type="date" class="form-control" name="due_date" min="${new Date().toISOString().split('T')[0]}" />
        <small style="color:var(--gray-400)">Par défaut : 14 jours</small>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">🤝 Enregistrer</button>
      </div>
    </form>
  `);
  document.getElementById('loanForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    if (!body.due_date) delete body.due_date;
    try {
      await API.loans.create(body);
      showToast('Emprunt enregistré.', 'success');
      closeModal(); renderLoans();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function returnLoan(id, title) {
  if (!confirm(`Confirmer le retour de "${title}" ?`)) return;
  try {
    await API.loans.return(id);
    showToast('Livre retourné.', 'success');
    const active = document.querySelector('.nav-item.active');
    if (active && active.dataset.page === 'overdue') renderOverdue(); else renderLoans();
  } catch (err) { showToast(err.message, 'error'); }
}
