const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3448;

app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`宠物健康管理系统前端运行在 http://localhost:${PORT}`);
});
