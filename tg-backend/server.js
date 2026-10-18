const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get('/', (req,res) => res.send('pure-ai LIVE OK'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server LIVE on port ${PORT}`);
});
