const express = require('express');
const router = express.Router();
const {
  getAllBooks,
  searchBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  updateAvailability,
} = require('../controllers/booksController');

router.get('/search', searchBooks);
router.get('/', getAllBooks);
router.get('/:id', getBookById);
router.post('/', createBook);
router.put('/:id', updateBook);
router.delete('/:id', deleteBook);
router.patch('/:id/availability', updateAvailability);

module.exports = router;
