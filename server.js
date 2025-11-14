/* server.js */
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

/* ---------- Configurações ---------- */
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: 'clinica_super_segura',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- Conexão MySQL ---------- */
const pool = mysql.createPool({
  host:     'localhost',
  user:     'root',
  password: '1234',
  database: 'clinica_demo',
  waitForConnections: true,
  connectionLimit: 10
});

/* ---------- Rotas ---------- */

/* Tela inicial = login */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

/* Registro: tela */
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/register.html'));
});

/* Login */
app.post('/login', async (req, res) => {
  try {
    const { rg, senha } = req.body;
    const [rows] = await pool.execute(
      'SELECT * FROM usuario WHERE rg = ?', [rg]
    );
    if (rows.length === 0) return res.redirect('/?err=1');

    const user = rows[0];
    const match = await bcrypt.compare(senha, user.senha_hash);
    if (!match) return res.redirect('/?err=1');

    req.session.userId = user.id_usuario;
    req.session.userName = user.nome;
    return res.redirect('/agenda');
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro no servidor');
  }
});

/* Registro: gravação */
app.post('/register', async (req, res) => {
  try {
    const { nome, rg, senha } = req.body;
    const hash = await bcrypt.hash(senha, 10);
    await pool.execute(
      'INSERT INTO usuario (nome, rg, senha_hash) VALUES (?,?,?)',
      [nome, rg, hash]
    );
    return res.redirect('/');
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao registrar');
  }
});

/* Agenda: tela protegida */
app.get('/agenda', async (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  const [procs]  = await pool.execute('SELECT * FROM procedimentos');
  const [planos] = await pool.execute('SELECT * FROM planos_saude');
  /* Renderiza HTML simples injetando opções */
  let optionsProc  = procs .map(p => `<option value="${p.id_proc}">${p.nome}</option>`).join('');
  let optionsPlano = planos.map(p => `<option value="${p.id_plano}">${p.nome}</option>`).join('');

  res.send(`
    <h2>Olá, ${req.session.userName}</h2>
    <form method="POST" action="/agenda">
      <label>Procedimento:</label>
      <select name="proc_id">${optionsProc}</select><br><br>
      <label>Plano de saúde:</label>
      <select name="plano_id">${optionsPlano}</select><br><br>
      <button type="submit">Confirmar</button>
    </form>
  `);
});

/* Agenda: gravação */
app.post('/agenda', async (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  const { proc_id, plano_id } = req.body;
  await pool.execute(
    'INSERT INTO agendamentos (usuario_id, proc_id, plano_id) VALUES (?,?,?)',
    [req.session.userId, proc_id, plano_id]
  );
  res.redirect('/success');
});

/* Sucesso */
app.get('/success', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public/success.html'));
});

/* ---------- Inicia servidor ---------- */
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));