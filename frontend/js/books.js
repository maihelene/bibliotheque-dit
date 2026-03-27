// ================================================
// books.js — Page Livres
// ================================================
let allBooks = [];

async function renderBooks() {
  document.getElementById('pageTitle').textContent = 'Livres';
  const container = document.getElementById('mainContent');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Chargement des livres...</div>`;
  try {
    const res = await API.books.getAll();
    allBooks = res.data;
    renderBooksUI(allBooks);
  } catch (err) {
    container.innerHTML = `<div class="empty-state">❌<p>${escHtml(err.message)}</p></div>`;
  }
}

function renderBooksUI(books) {
  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div><h2>📖 Livres</h2><p>${books.length} titre(s) dans le catalogue</p></div>
      <button class="btn btn-primary" onclick="openBookModal()">+ Ajouter un livre</button>
    </div>
    <div class="section-card">
      <div class="section-header">
        <div class="search-bar">
          <div class="search-input-wrap">
            <input type="text" id="bookSearch" placeholder="Rechercher par titre, auteur, ISBN..." />
          </div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Titre</th><th>Auteur</th><th>ISBN</th><th>Catégorie</th><th>Disponibles</th><th>Actions</th></tr></thead>
          <tbody id="booksTableBody">${renderBooksRows(books)}</tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('bookSearch').addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    if (!q) { document.getElementById('booksTableBody').innerHTML = renderBooksRows(allBooks); return; }
    try {
      const res = await API.books.search(q);
      document.getElementById('booksTableBody').innerHTML = renderBooksRows(res.data);
    } catch { document.getElementById('booksTableBody').innerHTML = renderBooksRows([]); }
  });
}

function renderBooksRows(books) {
  if (!books.length) return `<tr><td colspan="7"><div class="empty-state">📭<p>Aucun livre trouvé</p></div></td></tr>`;
  return books.map((b, i) => {
    const cls = b.available === 0 ? 'out' : b.available <= 1 ? 'low' : 'ok';
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(b.title)}</strong></td>
      <td>${escHtml(b.author)}</td>
      <td><code>${escHtml(b.isbn)}</code></td>
      <td>${b.category ? `<span class="badge badge-info">${escHtml(b.category)}</span>` : '—'}</td>
      <td><span class="avail ${cls}">${b.available}/${b.quantity}</span></td>
      <td><div class="actions-cell">
        <button class="btn btn-sm btn-outline" onclick="openBookModal(${b.id})">✏️</button>
        <button class="btn btn-sm btn-danger"  onclick="deleteBook(${b.id},'${escHtml(b.title)}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

async function openBookModal(id = null) {
  let book = null;
  if (id) { try { book = (await API.books.getById(id)).data; } catch {} }
  openModal(id ? 'Modifier le livre' : 'Ajouter un livre', `
    <form id="bookForm">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Titre <span>*</span></label>
          <input class="form-control" name="title" value="${book ? escHtml(book.title) : ''}" required /></div>
        <div class="form-group"><label class="form-label">Auteur <span>*</span></label>
          <input class="form-control" name="author" value="${book ? escHtml(book.author) : ''}" required /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">ISBN <span>*</span></label>
          <input class="form-control" name="isbn" value="${book ? escHtml(book.isbn) : ''}" required /></div>
        <div class="form-group"><label class="form-label">Catégorie</label>
          <input class="form-control" name="category" value="${book && book.category ? escHtml(book.category) : ''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Quantité</label>
        <input class="form-control" type="number" name="quantity" min="1" value="${book ? book.quantity : 1}" /></div>
      <div class="form-group"><label class="form-label">Description</label>
        <textarea class="form-control" name="description" rows="3">${book && book.description ? escHtml(book.description) : ''}</textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
      </div>
    </form>
  `);
  document.getElementById('bookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (id) { await API.books.update(id, body); showToast('Livre mis à jour.', 'success'); }
      else     { await API.books.create(body);    showToast('Livre ajouté.', 'success'); }
      closeModal(); renderBooks();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function deleteBook(id, title) {
  if (!confirm(`Supprimer "${title}" ?`)) return;
  try { await API.books.delete(id); showToast('Livre supprimé.', 'success'); renderBooks(); }
  catch (err) { showToast(err.message, 'error'); }
}
