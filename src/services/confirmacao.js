const axios = require('axios');

const BASE_URL = 'https://api.aplicativo.net';
const BOTCONVERSA_BASE = 'https://backend.botconversa.com.br/api/v1/webhook';
const ESTABELECIMENTO_ID = 19857;
const BOTCONVERSA_TOKEN = process.env.BOTCONVERSA_TOKEN;
const DESATIVADO = process.env.CONFIRMACAO_DESATIVADO === 'true';

let tokenCache = { token: null, expiracao: null };
let feriadosCache = { ano: null, feriados: [] };
let tagsCache = null;

async function getToken() {
  const agora = new Date();
  if (tokenCache.token && tokenCache.expiracao && new Date(tokenCache.expiracao) > new Date(agora.getTime() + 5 * 60 * 1000)) return tokenCache.token;
  tokenCache = { token: null, expiracao: null };
  const params = new URLSearchParams();
  params.append('Nome', process.env.APLICATIVO_USUARIO);
  params.append('Senha', process.env.APLICATIVO_SENHA);
  const loginRes = await axios.post(`${BASE_URL}/v4/Auth/pm`, params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const token = loginRes.data.data?.accessToken;
  const expiracao = loginRes.data.data?.expiration || new Date(Date.now() + 30 * 60 * 1000).toISOString();
  tokenCache = { token, expiracao };
  console.log('[confirmacao] Token renovado — expira:', expiracao);
  return token;
}

async function getFeriados(ano) {
  if (feriadosCache.ano === ano) return feriadosCache.feriados;
  try {
    const res = await axios.get(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
    const datas = res.data.map(f => f.date);
    feriadosCache = { ano, feriados: datas };
    console.log(`[confirmacao] Feriados ${ano} carregados: ${datas.length}`);
    return datas;
  } catch (e) { console.log(`[confirmacao] Erro ao buscar feriados — ignorando`); return []; }
}

function somarDias(data, dias) { const d = new Date(data); d.setDate(d.getDate() + dias); return d; }
function toDateStr(data) { return data.toISOString().split('T')[0]; }

async function calcularDataAlvo() {
  const agora = new Date();
  const hoje = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  hoje.setHours(0, 0, 0, 0);
  const diaSemanaHoje = hoje.getDay();
  if (diaSemanaHoje === 5) { const segunda = somarDias(hoje, 3); console.log(`[confirmacao] Hoje é sexta → buscando segunda ${toDateStr(segunda)}`); return toDateStr(segunda); }
  if (diaSemanaHoje === 0 || diaSemanaHoje === 6) { console.log(`[confirmacao] Fim de semana — job não envia`); return null; }
  let alvo = somarDias(hoje, 1);
  const feriados = await getFeriados(alvo.getFullYear());
  let tentativas = 0;
  while (tentativas < 7) {
    const alvoStr = toDateStr(alvo);
    const dia = alvo.getDay();
    if (dia === 0 || dia === 6 || feriados.includes(alvoStr)) { alvo = somarDias(alvo, 1); tentativas++; }
    else break;
  }
  return toDateStr(alvo);
}

function formatarDataHora(dataIso) {
  const diasNomes = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const partes = dataIso.replace('T', ' ').split(' ');
  const [ano, mes, dia] = partes[0].split('-').map(Number);
  const [hora, min] = partes[1].split(':').map(Number);
  const d = new Date(ano, mes - 1, dia, 12, 0, 0);
  return { dataFormatada: `${diasNomes[d.getDay()]}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`, horaFormatada: `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}` };
}

async function buscarOuCriarSubscriber(celular, nomeCompleto) {
  const telefone = celular.length === 11 ? `55${celular}` : celular;
  try {
    const res = await axios.get(`${BOTCONVERSA_BASE}/subscriber/get_by_phone/${telefone}/`, { headers: { 'api-key': BOTCONVERSA_TOKEN } });
    const id = res.data?.id || res.data?.subscriber_id;
    if (id) { console.log(`[confirmacao] Subscriber encontrado: ${id}`); return id; }
  } catch (e) { if (e.response?.status !== 404) { console.log(`[confirmacao] Erro ao buscar subscriber: ${e.response?.status}`); return null; } }
  try {
    const nome = nomeCompleto?.split(' ')[0] || 'Paciente';
    const sobrenome = nomeCompleto?.split(' ').slice(1).join(' ') || '';
    const res = await axios.post(`${BOTCONVERSA_BASE}/subscriber/`, { phone: telefone, first_name: nome, last_name: sobrenome }, { headers: { 'api-key': BOTCONVERSA_TOKEN, 'Content-Type': 'application/json' } });
    const id = res.data?.id || res.data?.subscriber_id;
    console.log(`[confirmacao] Subscriber criado: ${id}`);
    return id;
  } catch (e) { console.error(`[confirmacao] Erro ao criar subscriber:`, JSON.stringify(e.response?.data)); return null; }
}

async function buscarIdTag(nomeTag) {
  if (!tagsCache) {
    const res = await axios.get(`${BOTCONVERSA_BASE}/tags/`, { headers: { 'api-key': BOTCONVERSA_TOKEN } });
    tagsCache = res.data?.results || res.data || [];
  }
  const tag = tagsCache.find(t => t.name === nomeTag || t.slug === nomeTag);
  return tag?.id || null;
}

async function adicionarEtiqueta(subscriberID, nomeTag) {
  try {
    const tagID = await buscarIdTag(nomeTag);
    if (!tagID) { console.log(`[confirmacao] Tag "${nomeTag}" não encontrada`); return; }
    await axios.post(`${BOTCONVERSA_BASE}/subscriber/${subscriberID}/tags/${tagID}/`, {}, { headers: { 'api-key': BOTCONVERSA_TOKEN, 'Content-Type': 'application/json' } });
    console.log(`[confirmacao] Etiqueta "${nomeTag}" adicionada`);
  } catch (e) { console.error(`[confirmacao] Erro ao adicionar etiqueta:`, e.response?.data || e.message); }
}

async function salvarCampos(subscriberID, agendamentoID, pessoaID, dataFormatada, horaFormatada) {
  try {
    const camposRes = await axios.get(`${BOTCONVERSA_BASE}/custom_fields/`, { headers: { 'api-key': BOTCONVERSA_TOKEN } });
    const campos = camposRes.data?.results || camposRes.data || [];
    const campoAg = campos.find(c => c.key === 'agendamento_id');
    const campoPe = campos.find(c => c.key === 'pessoa_id');
    const campoResumo = campos.find(c => c.key === 'resumo_da_conversa');
    if (campoAg) { await axios.post(`${BOTCONVERSA_BASE}/subscriber/${subscriberID}/custom_fields/${campoAg.id}/`, { value: String(agendamentoID) }, { headers: { 'api-key': BOTCONVERSA_TOKEN, 'Content-Type': 'application/json' } }); console.log(`[confirmacao] agendamento_id salvo: ${agendamentoID}`); }
    if (campoPe) { await axios.post(`${BOTCONVERSA_BASE}/subscriber/${subscriberID}/custom_fields/${campoPe.id}/`, { value: String(pessoaID) }, { headers: { 'api-key': BOTCONVERSA_TOKEN, 'Content-Type': 'application/json' } }); console.log(`[confirmacao] pessoa_id salvo: ${pessoaID}`); }
    if (campoResumo) { const resumo = `Confirmação de agendamento enviada para ${dataFormatada} às ${horaFormatada}. Aguardando resposta do paciente.`; await axios.post(`${BOTCONVERSA_BASE}/subscriber/${subscriberID}/custom_fields/${campoResumo.id}/`, { value: resumo }, { headers: { 'api-key': BOTCONVERSA_TOKEN, 'Content-Type': 'application/json' } }); console.log(`[confirmacao] resumo_da_conversa salvo`); }
  } catch (e) { console.error(`[confirmacao] Erro ao salvar campos:`, e.message); }
}

async function enviarMensagem(subscriberID, nomeCompleto, dataFormatada, horaFormatada) {
  const nome = nomeCompleto?.split(' ')[0] || 'Paciente';
  const mensagem = `Olá, ${nome}! Aqui é a Ane da Stilo Odonto, tudo bem? Passando para confirmar sua consulta agendada para *${dataFormatada}* às *${horaFormatada}*. Tudo certo, posso confirmar sua presença?`;
  await axios.post(`${BOTCONVERSA_BASE}/subscriber/${subscriberID}/send_message/`, { type: 'text', value: mensagem }, { headers: { 'api-key': BOTCONVERSA_TOKEN, 'Content-Type': 'application/json' } });
  console.log(`[confirmacao] Mensagem enviada → ${subscriberID} (${nome})`);
}

async function executarConfirmacoesPorData(dataAlvo) {
  const token = await getToken();
  console.log(`[confirmacao] Buscando agendamentos para ${dataAlvo}`);
  const res = await axios.get(`${BASE_URL}/v6/Agendamento/Estabelecimento/${ESTABELECIMENTO_ID}/${dataAlvo}/${dataAlvo}`, { headers: { Authorization: `Bearer ${token}` } });
  const lista = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
  console.log(`[confirmacao] ${lista.length} agendamentos encontrados`);
  if (lista.length === 0) return { enviados: 0, erros: 0 };
  let enviados = 0, erros = 0;
  for (const ag of lista) {
    try {
      const celularRaw = ag.contato || ag.consumidorPessoaFone1 || ag.celular || ag.telefone;
      if (!celularRaw) { console.log(`[confirmacao] Agendamento ${ag.id} sem celular — pulando`); continue; }
      const celular = String(celularRaw).replace(/\D/g, '');
      const nomeCompleto = ag.nomeCompleto || ag.nomePaciente || ag.apelido || 'Paciente';
      const subscriberID = await buscarOuCriarSubscriber(celular, nomeCompleto);
      if (!subscriberID) { console.log(`[confirmacao] Sem subscriber para ${nomeCompleto} — pulando`); continue; }
      const pessoaIDCorreto = ag.consumidorPessoaID || ag.pessoaID;
      const { dataFormatada, horaFormatada } = formatarDataHora(ag.dataInicio || ag.inicio || dataAlvo);
      await salvarCampos(subscriberID, ag.id, pessoaIDCorreto, dataFormatada, horaFormatada);
      await adicionarEtiqueta(subscriberID, 'Confirmacao_Agenda');
      console.log(`[confirmacao] Enviando para ${nomeCompleto} — ${dataFormatada} às ${horaFormatada}`);
      await enviarMensagem(subscriberID, nomeCompleto, dataFormatada, horaFormatada);
      enviados++;
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) { console.error(`[confirmacao] Erro no agendamento ${ag.id}:`, e.message); erros++; }
  }
  return { enviados, erros };
}

async function executarConfirmacoes() {
  if (DESATIVADO) { console.log(`[confirmacao] ⛔ SISTEMA DESATIVADO`); return; }
  console.log(`[confirmacao] ===== Iniciando job ${new Date().toISOString()} =====`);
  try {
    const dataAlvo = await calcularDataAlvo();
    if (!dataAlvo) { console.log(`[confirmacao] Fim de semana — job encerrado`); return; }
    const resultado = await executarConfirmacoesPorData(dataAlvo);
    console.log(`[confirmacao] ===== Job concluído — ${resultado.enviados} enviados, ${resultado.erros} erros =====`);
  } catch (e) { console.error('[confirmacao] ERRO GERAL:', e.message); }
}

function iniciarJobConfirmacao() {
  if (DESATIVADO) { console.log('[confirmacao] ⛔ SISTEMA DESATIVADO — job não será agendado'); return; }
  console.log('[confirmacao] Job registrado — roda todo dia às 8h (Brasília)');
  function agendarProximaExecucao() {
    const agora = new Date();
    const proxima = new Date();
    proxima.setUTCHours(11, 0, 0, 0);
    if (proxima <= agora) proxima.setDate(proxima.getDate() + 1);
    const msAte = proxima - agora;
    console.log(`[confirmacao] Próxima execução: ${proxima.toISOString()} (em ${Math.round(msAte / 60000)} minutos)`);
    setTimeout(async () => { await executarConfirmacoes(); agendarProximaExecucao(); }, msAte);
  }
  agendarProximaExecucao();
}

module.exports = { iniciarJobConfirmacao, executarConfirmacoesPorData };
