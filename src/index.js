require('dotenv').config();
const http = require('http');
const { iniciarJobConfirmacao } = require('./services/confirmacao');

console.log('✅ Confirmação Clínica — iniciando...');
iniciarJobConfirmacao();

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Confirmação Clínica — online');
}).listen(PORT, () => {
  console.log(`[server] Rodando na porta ${PORT}`);
});
