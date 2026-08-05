const express = require('express');
const { login, logout } = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/login', login);
router.post('/logout', verificarToken, logout);

module.exports = router;
