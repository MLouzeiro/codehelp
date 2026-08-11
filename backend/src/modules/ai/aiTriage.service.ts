import prisma from '../../config/database';
import { env } from '../../config/env';

// ── Claude API ─────────────────────────────────────────────────

async function callClaude(prompt: string, maxTokens = 800): Promise<string> {
  if (!env.anthropicKey) throw new Error('Chave Anthropic não configurada');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  return data.content?.[0]?.text || '';
}

function hasClaude(): boolean {
  return !!env.anthropicKey;
}

// ── Interfaces ─────────────────────────────────────────────────

export interface TriagemResultado {
  assunto: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  empresaDetectada?: string;
  categoria?: string;
}

export interface EmpresaDetectada {
  nome: string;
  existeNoCrm: boolean;
  clientId?: string;
}

// ── 1. ANALISE DE DESCRICAO DO PROBLEMA ────────────────────────

/**
 * Analisa a descrição do problema enviada pelo cliente e gera:
 * - Assunto curto
 * - Prioridade
 * - Detecção de empresa/laboratório mencionado
 * - Categoria do problema
 */
export async function analisarDescricaoProblema(
  ticketId: string,
  mensagemCliente: string
): Promise<TriagemResultado> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      contactName: true,
      departamentoId: true,
      departamento: { select: { nome: true } },
    },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  // Fallback sem Claude: usar regex
  if (!hasClaude()) {
    return analisarLocal(mensagemCliente, ticket.departamento?.nome);
  }

  try {
    const deptInfo = ticket.departamento ? `Departamento: ${ticket.departamento.nome}` : '';

    const prompt = `Você é um analista de triagem de suporte. Analise a descrição do problema do cliente e gere:

1. ASSUNTO: título curto (máximo 80 caracteres) resumindo o problema
2. PRIORIDADE: baseada na gravidade do problema
   - "urgente": sistema completamente inoperante, dado crítico perdido, segurança comprometida
   - "alta": funcionalidade principal afetada, sem workaround
   - "media": funcionalidade secundária afetada, ou problema intermitente
   - "baixa": dúvida, solicitação de melhoria, algo não crítico
3. EMPRESA_DETECTADA: nome de empresa, laboratório, clínica ou hospital mencionado (null se não mencionou)
4. CATEGORIA: "suporte_tecnico" | "financeiro" | "comercial" | "cancelamento" | "outros"

DESCRIÇÃO DO CLIENTE:
${mensagemCliente}

${deptInfo}

IMPORTANTE: Se o cliente mencionar um nome de organização (laboratório, clínica, hospital, empresa, consultório, unidade), extraia-o mesmo que não esteja formatado como "laboratório: X". Procure por nomes próprios de organizações no texto.

Responda APENAS com JSON (sem markdown):
{
  "assunto": "resumo curto do problema",
  "prioridade": "media",
  "empresaDetectada": null,
  "categoria": "suporte_tecnico"
}`;

    const resposta = await callClaude(prompt, 400);
    const jsonMatch = resposta.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const prioridades = ['baixa', 'media', 'alta', 'urgente'];
      return {
        assunto: String(parsed.assunto || 'Problema reportado').slice(0, 80),
        prioridade: prioridades.includes(parsed.prioridade) ? parsed.prioridade : 'media',
        empresaDetectada: parsed.empresaDetectada || undefined,
        categoria: parsed.categoria || undefined,
      };
    }
  } catch (e) {
    console.warn('[AI Triage] Falha LLM análise descrição:', (e as Error).message);
  }

  return analisarLocal(mensagemCliente, ticket.departamento?.nome);
}

// ── Analise local (fallback sem IA) ────────────────────────────

function analisarLocal(texto: string, deptNome?: string): TriagemResultado {
  const textoLower = texto.toLowerCase();

  // Detectar prioridade por palavras-chave
  let prioridade: TriagemResultado['prioridade'] = 'media';
  if (/urgent|crítico|crítico|parado|inoperante|não funciona|down|fora do ar|segurança|vazamento/.test(textoLower)) {
    prioridade = 'urgente';
  } else if (/importante|bloqueado|sem acesso|não consigo|erro Grave/.test(textoLower)) {
    prioridade = 'alta';
  } else if (/dúvida|como|gostaria|melhoria|sugestão|quando/.test(textoLower)) {
    prioridade = 'baixa';
  }

  // Gerar assunto das primeiras palavras significativas
  const palavras = texto.split(/\s+/).filter(w => w.length > 3).slice(0, 8);
  const assunto = palavras.join(' ').slice(0, 80) || 'Problema reportado';

  // Detectar empresa por padrões comuns
  // Padrão 1: "laboratório Lab Central", "clínica Saúde", etc.
  let empresaMatch = texto.match(/(?:laborat[oó]rio|cl[ií]nica|hospital|empresa|consult[oó]rio|unidade|centro)\s+(?:de\s+|do\s+|da\s+)?(.+?)(?:\s*[,.\n]|$)/i);
  let empresaDetectada = empresaMatch ? empresaMatch[1].trim() : undefined;

  // Padrão 2: Se a mensagem é curta e parece nome de empresa (sem palavras de problema)
  // Ex: "Lab Central", "Clínica Saúde", "Hospital São Lucas"
  if (!empresaDetectada && texto.length > 2 && texto.length < 80) {
    const palavrasProblema = ['sistema', 'erro', 'problema', 'não funciona', 'caiu', 'lento', 'lentidão', 'travou', 'bloqueado', 'acesso', 'senha', 'login', 'dados', 'relatório', 'nota', 'impressão'];
    const textoLower2 = texto.toLowerCase();
    const pareceEmpresa = !palavrasProblema.some(p => textoLower2.includes(p));
    if (pareceEmpresa) {
      // Verificar se parece um nome (primeira letra maiúscula, sem pontuação excessiva)
      const pareceNome = /^[A-ZÀ-Ú]/.test(texto.trim()) && !/[?!]{2,}/.test(texto);
      if (pareceNome) {
        empresaDetectada = texto.trim();
      }
    }
  }

  // Categoria por departamento
  let categoria = 'outros';
  if (deptNome) {
    const deptLower = deptNome.toLowerCase();
    if (deptLower.includes('suporte') || deptLower.includes('ti') || deptLower.includes('técnico')) {
      categoria = 'suporte_tecnico';
    } else if (deptLower.includes('financeiro') || deptLower.includes('billing')) {
      categoria = 'financeiro';
    } else if (deptLower.includes('comercial') || deptLower.includes('vendas')) {
      categoria = 'comercial';
    }
  }

  return { assunto, prioridade, empresaDetectada, categoria };
}

// ── 2. DETECAO E VINCULACAO DE EMPRESA ────────────────────────

/**
 * Detecta empresa na mensagem e vincula ao ticket.
 * Se a empresa não existe no CRM, cria automaticamente.
 */
export async function detectarEVincularEmpresa(
  ticketId: string,
  mensagemCliente: string
): Promise<EmpresaDetectada | null> {
  // Primeiro: buscar empresa já vinculada ao ticket
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { clientId: true, contactPhone: true, contactName: true },
  });
  if (!ticket) throw new Error('Ticket não encontrado');
  if (ticket.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: ticket.clientId },
      select: { id: true, razaoSocial: true },
    });
    if (client) {
      return { nome: client.razaoSocial, existeNoCrm: true, clientId: client.id };
    }
  }

  // Se não mencionou empresa, verificar se contato já está vinculado no CRM
  if (!ticket.clientId && ticket.contactPhone) {
    const phoneDigits = ticket.contactPhone.replace(/[^\d]/g, '');
    const phoneLookup = phoneDigits.slice(-11);

    // Buscar por colaborador
    const colaborador = await prisma.colaborador.findFirst({
      where: {
        OR: [
          { telefone: { contains: phoneLookup } },
          { whatsapp: { contains: phoneLookup } },
        ],
      },
      include: { client: { select: { id: true, razaoSocial: true } } },
    });

    if (colaborador?.client) {
      // Vincular ticket ao client existente
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { clientId: colaborador.client.id },
      });
      return {
        nome: colaborador.client.razaoSocial,
        existeNoCrm: true,
        clientId: colaborador.client.id,
      };
    }

    // Buscar por client direto (telefone)
    const clientDireto = await prisma.client.findFirst({
      where: { telefone: { contains: phoneLookup } },
      select: { id: true, razaoSocial: true },
    });
    if (clientDireto) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { clientId: clientDireto.id },
      });
      return {
        nome: clientDireto.razaoSocial,
        existeNoCrm: true,
        clientId: clientDireto.id,
      };
    }
  }

  // Analisar mensagem com IA para detectar empresa
  const triagem = await analisarDescricaoProblema(ticketId, mensagemCliente);

  if (!triagem.empresaDetectada) return null;

  // Buscar empresa no CRM por nome
  const empresaNormalizada = triagem.empresaDetectada.toLowerCase().trim();
  const clientExistente = await prisma.client.findFirst({
    where: {
      OR: [
        { razaoSocial: { contains: empresaNormalizada, mode: 'insensitive' } },
        { nomeFantasia: { contains: empresaNormalizada, mode: 'insensitive' } },
      ],
    },
    select: { id: true, razaoSocial: true },
  });

  if (clientExistente) {
    // Vincular ticket ao client existente
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { clientId: clientExistente.id },
    });
    return {
      nome: clientExistente.razaoSocial,
      existeNoCrm: true,
      clientId: clientExistente.id,
    };
  }

  // Criar novo client automaticamente
  const novoClient = await prisma.client.create({
    data: {
      razaoSocial: triagem.empresaDetectada,
      nomeFantasia: triagem.empresaDetectada,
      segmento: 'laboratorio',
      origem: 'whatsapp',
      status: 'ativo',
    },
  });

  // Vincular ticket ao novo client
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { clientId: novoClient.id },
  });

  console.log(`[AI Triage] Novo cliente criado automaticamente: "${novoClient.razaoSocial}" (id: ${novoClient.id})`);

  return {
    nome: novoClient.razaoSocial,
    existeNoCrm: false,
    clientId: novoClient.id,
  };
}

// ── 3. PROCESSAR DESCRICAO COMPLETA ────────────────────────────

/**
 * Processa a descrição completa do problema:
 * 1. Analisa e gera assunto + prioridade
 * 2. Detecta e vincula empresa
 * 3. Atualiza o ticket
 * 4. Retorna resultado para confirmação ao cliente
 */
export async function processarDescricaoProblema(
  ticketId: string,
  mensagemCliente: string
): Promise<{
  triagem: TriagemResultado;
  empresa: EmpresaDetectada | null;
  ticketAtualizado: boolean;
}> {
  // Analisar descrição
  const triagem = await analisarDescricaoProblema(ticketId, mensagemCliente);

  // Detectar e vincular empresa
  const empresa = await detectarEVincularEmpresa(ticketId, mensagemCliente);

  // Atualizar ticket com assunto, prioridade e categoria
  const updateData: Record<string, any> = {};
  if (triagem.assunto) updateData.assunto = triagem.assunto;
  if (triagem.prioridade) updateData.prioridade = triagem.prioridade;
  if (triagem.categoria) updateData.categoria = triagem.categoria;

  let ticketAtualizado = false;
  if (Object.keys(updateData).length > 0) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
    });
    ticketAtualizado = true;
  }

  return { triagem, empresa, ticketAtualizado };
}

// ── 4. MENSAGEM DE CONFIRMACAO AO CLIENTE ──────────────────────

/**
 * Monta mensagem de confirmação para o cliente após análise da IA
 */
export async function montarMensagemConfirmacao(
  ticketId: string,
  triagem: TriagemResultado,
  empresa: EmpresaDetectada | null
): Promise<string> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { contactName: true },
  });
  const nome = ticket?.contactName || 'Cliente';

  const linhas: string[] = [];
  linhas.push(`${nome}, suas informações foram recebidas! ✅`);
  linhas.push('');

  if (triagem.assunto) {
    linhas.push(`📋 *Assunto:* ${triagem.assunto}`);
  }
  if (triagem.prioridade) {
    const prioridadeLabel: Record<string, string> = {
      baixa: '🟢 Baixa',
      media: '🟡 Média',
      alta: '🟠 Alta',
      urgente: '🔴 Urgente',
    };
    linhas.push(`⚡ *Prioridade:* ${prioridadeLabel[triagem.prioridade] || triagem.prioridade}`);
  }
  if (empresa) {
    linhas.push(`🏢 *Empresa:* ${empresa.nome}${empresa.existeNoCrm ? '' : ' (cadastrada automaticamente)'}`);
  }

  linhas.push('');
  linhas.push('Estamos processando seu atendimento. Aguarde um momento.');

  return linhas.join('\n');
}
