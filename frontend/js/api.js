// ================================================
// api.js — Client HTTP centralisé
// Les URLs utilisent window.location.hostname pour
// fonctionner aussi bien en local qu'en Docker
// ================================================

const HOST = window.location.hostname; // 'localhost' ou IP serveur

const API = {
  BOOKS : `http://${HOST}:3001`,
  USERS : `http://${HOST}:3002`,
  LOANS : `http://${HOST}:3003`,

  async _req(url, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res  = await fetch(url, opts);
      const data = await res.json();
      if (!data.success && res.status >= 400) throw new Error(data.message || 'Erreur serveur');
      return data;
    } catch (err) {
      if (err instanceof SyntaxError) throw new Error('Réponse invalide du serveur');
      throw err;
    }
  },

  books: {
    getAll  : ()       => API._req(`${API.BOOKS}/api/books`),
    search  : (q)      => API._req(`${API.BOOKS}/api/books/search?q=${encodeURIComponent(q)}`),
    getById : (id)     => API._req(`${API.BOOKS}/api/books/${id}`),
    create  : (body)   => API._req(`${API.BOOKS}/api/books`, 'POST', body),
    update  : (id, b)  => API._req(`${API.BOOKS}/api/books/${id}`, 'PUT', b),
    delete  : (id)     => API._req(`${API.BOOKS}/api/books/${id}`, 'DELETE'),
    health  : ()       => API._req(`${API.BOOKS}/health`),
  },

  users: {
    getAll  : (type)   => API._req(`${API.USERS}/api/users${type ? `?type=${encodeURIComponent(type)}` : ''}`),
    getById : (id)     => API._req(`${API.USERS}/api/users/${id}`),
    create  : (body)   => API._req(`${API.USERS}/api/users`, 'POST', body),
    update  : (id, b)  => API._req(`${API.USERS}/api/users/${id}`, 'PUT', b),
    delete  : (id)     => API._req(`${API.USERS}/api/users/${id}`, 'DELETE'),
    health  : ()       => API._req(`${API.USERS}/health`),
  },

  loans: {
    getAll    : ()    => API._req(`${API.LOANS}/api/loans`),
    getOverdue: ()    => API._req(`${API.LOANS}/api/loans/overdue`),
    getHistory: ()    => API._req(`${API.LOANS}/api/loans/history`),
    getByUser : (uid) => API._req(`${API.LOANS}/api/loans/user/${uid}`),
    create    : (body)=> API._req(`${API.LOANS}/api/loans`, 'POST', body),
    return    : (id)  => API._req(`${API.LOANS}/api/loans/${id}/return`, 'PUT'),
    health    : ()    => API._req(`${API.LOANS}/health`),
  },
};
