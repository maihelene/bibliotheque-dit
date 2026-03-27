const { getPool } = require('../db');

// GET /api/books — lister tous les livres
const getAllBooks = async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM books ORDER BY created_at DESC');
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/books/search?q= — recherche par titre, auteur ou ISBN
const searchBooks = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'Paramètre de recherche manquant.' });
  try {
    const [rows] = await getPool().query(
      `SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ?`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/books/:id — obtenir un livre par ID
const getBookById = async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Livre non trouvé.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/books — ajouter un livre
const createBook = async (req, res) => {
  const { title, author, isbn, description, category, quantity } = req.body;
  if (!title || !author || !isbn) {
    return res.status(400).json({ success: false, message: 'Titre, auteur et ISBN sont requis.' });
  }
  try {
    const qty = parseInt(quantity) || 1;
    const [result] = await getPool().query(
      'INSERT INTO books (title, author, isbn, description, category, quantity, available) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, author, isbn, description || null, category || null, qty, qty]
    );
    const [book] = await getPool().query('SELECT * FROM books WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Livre ajouté avec succès.', data: book[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Un livre avec cet ISBN existe déjà.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/books/:id — modifier un livre
const updateBook = async (req, res) => {
  const { title, author, isbn, description, category, quantity } = req.body;
  try {
    const [existing] = await getPool().query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Livre non trouvé.' });

    const book = existing[0];
    const newQty = quantity !== undefined ? parseInt(quantity) : book.quantity;
    const diff = newQty - book.quantity;
    const newAvailable = Math.max(0, book.available + diff);

    await getPool().query(
      'UPDATE books SET title=?, author=?, isbn=?, description=?, category=?, quantity=?, available=? WHERE id=?',
      [
        title || book.title,
        author || book.author,
        isbn || book.isbn,
        description !== undefined ? description : book.description,
        category !== undefined ? category : book.category,
        newQty,
        newAvailable,
        req.params.id,
      ]
    );
    const [updated] = await getPool().query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Livre mis à jour.', data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/books/:id — supprimer un livre
const deleteBook = async (req, res) => {
  try {
    const [existing] = await getPool().query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Livre non trouvé.' });
    await getPool().query('DELETE FROM books WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Livre supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/books/:id/availability — mettre à jour la disponibilité (utilisé par loans-service)
const updateAvailability = async (req, res) => {
  const { action } = req.body; // 'borrow' or 'return'
  try {
    const [rows] = await getPool().query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Livre non trouvé.' });
    const book = rows[0];
    if (action === 'borrow') {
      if (book.available <= 0) return res.status(400).json({ success: false, message: 'Aucun exemplaire disponible.' });
      await getPool().query('UPDATE books SET available = available - 1 WHERE id = ?', [req.params.id]);
    } else if (action === 'return') {
      await getPool().query('UPDATE books SET available = LEAST(available + 1, quantity) WHERE id = ?', [req.params.id]);
    }
    const [updated] = await getPool().query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllBooks, searchBooks, getBookById, createBook, updateBook, deleteBook, updateAvailability };
