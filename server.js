// Set DB defaults early so `node server.js` uses the expected TiDB config when no env vars are present
process.env.DB_NAME = process.env.DB_NAME || 'lab';
process.env.DB_HOST = process.env.DB_HOST || 'gateway01.us-east-1.prod.aws.tidbcloud.com';
process.env.DB_USER = process.env.DB_USER || '3XCNBfWUvxfEhKC.root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'ZbVKYuQq4IzITdoE';
process.env.DB_PORT = process.env.DB_PORT || '4000';

const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const solicitudesRoutes = require('./routes/solicitudes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/solicitudes', solicitudesRoutes);

app.get('/', (req, res) => {
  res.type('text/plain').send('Hello from app-lab-back (express)!');
});

app.listen(port, () => console.log(`Server listening on port ${port}`));
