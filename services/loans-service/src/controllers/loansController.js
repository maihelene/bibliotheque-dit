const { getPool } = require('../db');

// Requête de base avec JOIN pour récupérer titre et nom
const LOAN_SELECT = `
  SELECT
    l.id, l.book_id, l.user_id,
    l.loan_date, l.due_date, l.return_date, l.status,
    l.created_at, l.updated_at,
    b.title  AS book_title,
    u.name   AS user_name
  FROM loans l
  JOIN books b ON l.book_id = b.id
  JOIN users u ON l.user_id = u.id
`;

// Synchroniser les statuts overdue
const syncOverdue = async () => {
  await getPool().query(
    `UPDATE loans SET status = 'overdue'
     WHERE due_date < CURDATE() AND status = 'active'`
  );
};

// GET /api/loans
const getAllLoans = async (req, res) => {
  try {
    await syncOverdue();
    const [rows] = await getPool().query(`${LOAN_SELECT} ORDER BY l.created_at DESC`);
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/loans/history
const getLoanHistory = async (req, res) => {
  try {
    const [rows] = await getPool().query(`${LOAN_SELECT} ORDER BY l.loan_date DESC`);
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/loans/overdue
const getOverdueLoans = async (req, res) => {
  try {
    await syncOverdue();
    const [rows] = await getPool().query(`
      ${LOAN_SELECT}
      WHERE l.status = 'overdue'
      ORDER BY l.due_date ASC
    `);
    // Ajouter le nombre de jours de retard
    const data = rows.map(r => ({
      ...r,
      days_overdue: Math.floor((new Date() - new Date(r.due_date)) / 86400000),
    }));
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/loans/user/:userId
const getLoansByUser = async (req, res) => {
  try {
    await syncOverdue();
    const [rows] = await getPool().query(
      `${LOAN_SELECT} WHERE l.user_id = ? ORDER BY l.created_at DESC`,
      [req.params.userId]
    );
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/loans/:id
const getLoanById = async (req, res) => {
  try {
    const [rows] = await getPool().query(`${LOAN_SELECT} WHERE l.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Emprunt non trouvé.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/loans — emprunter un livre
const createLoan = async (req, res) => {
  const { book_id, user_id, due_date } = req.body;
  if (!book_id || !user_id) {
    return res.status(400).json({ success: false, message: 'book_id et user_id sont requis.' });
  }

  try {
    // Vérifier que l'utilisateur n'a pas déjà ce livre
    const [existing] = await getPool().query(
      `SELECT id FROM loans WHERE book_id = ? AND user_id = ? AND status IN ('active','overdue')`,
      [book_id, user_id]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Cet utilisateur a déjà emprunté ce livre.' });
    }

    // Vérifier disponibilité du livre
    const [bookRows] = await getPool().query('SELECT available FROM books WHERE id = ?', [book_id]);
    if (!bookRows.length) return res.status(404).json({ success: false, message: 'Livre introuvable.' });
    if (bookRows[0].available <= 0) {
      return res.status(400).json({ success: false, message: 'Aucun exemplaire disponible.' });
    }

    // Vérifier que l'utilisateur existe
    const [userRows] = await getPool().query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (!userRows.length) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    const loanDate = new Date().toISOString().split('T')[0];
    const dueDate = due_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    })();

    // Insérer l'emprunt
    const [result] = await getPool().query(
      'INSERT INTO loans (book_id, user_id, loan_date, due_date, status) VALUES (?, ?, ?, ?, ?)',
      [book_id, user_id, loanDate, dueDate, 'active']
    );

    // Décrémenter disponibilité
    await getPool().query('UPDATE books SET available = available - 1 WHERE id = ?', [book_id]);

    const [loan] = await getPool().query(`${LOAN_SELECT} WHERE l.id = ?`, [result.insertId]);
    res.status(201).json({ success: true, message: 'Emprunt enregistré avec succès.', data: loan[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/loans/:id/return
const returnLoan = async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM loans WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Emprunt non trouvé.' });
    if (rows[0].status === 'returned') {
      return res.status(400).json({ success: false, message: 'Ce livre a déjà été retourné.' });
    }

    const returnDate = new Date().toISOString().split('T')[0];
    await getPool().query(
      `UPDATE loans SET status = 'returned', return_date = ? WHERE id = ?`,
      [returnDate, req.params.id]
    );

    // Incrémenter disponibilité
    await getPool().query(
      'UPDATE books SET available = LEAST(available + 1, quantity) WHERE id = ?',
      [rows[0].book_id]
    );

    const [updated] = await getPool().query(`${LOAN_SELECT} WHERE l.id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Livre retourné avec succès.', data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllLoans, getLoanHistory, getOverdueLoans, getLoansByUser, getLoanById, createLoan, returnLoan };
