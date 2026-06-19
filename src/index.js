require('dotenv').config();
const { iniciarJobConfirmacao } = require('./services/confirmacao');

console.log('✅ Confirmação Clínica — iniciando...');
iniciarJobConfirmacao();
