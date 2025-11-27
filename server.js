
// src/server.js
import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------
// CONFIGURAÇÃO
// ---------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(
  session({
    secret: 'mdpescaria-secret-key',
    resave: false,
    saveUninitialized: true
  })
);

// ---------------------------------
// CONEXÃO COM MYSQL (POOL)
// ---------------------------------
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '1234',
  database: process.env.DB_NAME || 'md_pescaria',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ---------------------------------
// MIDDLEWARE DE AUTENTICAÇÃO
// ---------------------------------
function auth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/produto');
}

// ---------------------------------
// ROTAS
// ---------------------------------
app.get('/', (req, res) => {
  res.send(
    `<h2>Bem-vindo à MD Pescaria 🎣</h2>
     <a href="/index">index</a> |
     <a href="/register">Registrar-se</a>`
  );
});

// -------------- LOGIN --------------
app.get('/index', (req, res) => {
  res.sendFile(`${process.cwd()}/public/index.html`);
});

app.post('/index', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM clientes WHERE email = ?',
      [email]
    );

    if (rows.length === 0) return res.send('Usuário não encontrado!');

    const user = rows[0];
    const senhaOK = await bcrypt.compare(senha, user.senha);

    if (!senhaOK) return res.send('Senha incorreta!');

    req.session.user = user;
    res.redirect('/produtos');
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// ------------- REGISTRO -------------
app.get('/register', (req, res) => {
  res.sendFile(`${process.cwd()}/public/register.html`);
});

app.post('/register', async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const hash = await bcrypt.hash(senha, 10);

    await pool.execute(
      'INSERT INTO clientes (nome, email, senha) VALUES (?, ?, ?)',
      [nome, email, hash]
    );

    res.redirect('/index');
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// ---------- LISTA DE PRODUTOS ----------
app.get('/produtos', auth, async (req, res) => {
  try {
    const [produtos] = await pool.execute('SELECT * FROM produtos');

    let html = `<h2>Produtos – MD Pescaria 🎣</h2>
                <a href="/logout">Logout</a><hr/>`;

    produtos.forEach((p) => {
      html += `
        <div>
          <h3>${p.nome}</h3>
          <p>${p.descricao || ''}</p>
          <p>Preço: R$ ${p.preco.toFixed(2)}</p>
          <a href="/comprar/${p.id}">Comprar</a>
        </div>
        <hr/>`;
    });

    res.send(html);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// ----------- COMPRAR PRODUTO -----------
app.get('/comprar/:id', auth, async (req, res) => {
  const id_produto = req.params.id;
  const id_cliente = req.session.user.id;

  try {
    const [[produto]] = await pool.execute(
      'SELECT preco FROM produtos WHERE id = ?',
      [id_produto]
    );

    if (!produto) return res.send('Produto não encontrado!');

    await pool.execute(
      `INSERT INTO pedidos (id_cliente, id_produto, quantidade, total)
       VALUES (?, ?, 1, ?)`,
      [id_cliente, id_produto, produto.preco]
    );

    res.send(
      `<h2>Pedido realizado com sucesso 🎣</h2>
       <a href="/produtos">Voltar aos produtos</a>`
    );
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// --------------- LOGOUT ---------------
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// -------------- INICIAR --------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:3000`);
});

