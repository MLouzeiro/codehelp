import prisma from '../../config/database';

export interface AutoMessageConfig {
  slug: string;
  nome: string;
  descricao: string;
  mensagem: string;
  variaveis: string[];
}

export const AUTO_MESSAGES: AutoMessageConfig[] = [
  {
    slug: 'fila',
    nome: 'Chamado Aberto',
    descricao: 'Mensagem enviada quando o chamado é aberto na fila',
    mensagem: 'Olá {{nome_contato}}! 👋\n\nRecebemos sua mensagem e seu chamado foi aberto com sucesso.\n📋 Protocolo: *{{numero_protocolo}}*\n⏱️ Em breve um de nossos analistas irá te atender.\n\nAguarde um instante, por favor.\n\nAtenciosamente,\nEquipe Codemed',
    variaveis: ['{{nome_contato}}', '{{numero_protocolo}}'],
  },
  {
    slug: 'triagem',
    nome: 'Triagem',
    descricao: 'Mensagem enviada durante a triagem automática',
    mensagem: 'Olá {{nome_contato}}! 🤖\n\nEstou analisando sua solicitação para direcioná-la ao analista mais adequado.\n📋 Protocolo: *{{numero_protocolo}}*\n\nIsso leva apenas alguns segundos...\n\nEquipe Codemed',
    variaveis: ['{{nome_contato}}', '{{numero_protocolo}}'],
  },
  {
    slug: 'em_atendimento',
    nome: 'Em Atendimento',
    descricao: 'Mensagem enviada quando o atendente assume o chamado',
    mensagem: 'Olá {{nome_contato}}! 👨‍💻\n\nVocê foi atendido por *{{tecnico}}* e seu atendimento já está em andamento.\n📋 Protocolo: *{{numero_protocolo}}*\n\nCaso precise de algo, é só responder por aqui mesmo.\n\nAtenciosamente,\nEquipe Codemed',
    variaveis: ['{{nome_contato}}', '{{numero_protocolo}}', '{{tecnico}}'],
  },
  {
    slug: 'aguardando_cliente',
    nome: 'Aguardando Cliente',
    descricao: 'Mensagem enviada quando aguardando retorno do cliente',
    mensagem: 'Olá {{nome_contato}}! ⏳\n\nEstamos aguardando um retorno seu para dar continuidade ao atendimento do protocolo *{{numero_protocolo}}*.\n\nQuando puder, responda esta mensagem. Seu chamado continua aberto.\n\nAtenciosamente,\nEquipe Codemed',
    variaveis: ['{{nome_contato}}', '{{numero_protocolo}}'],
  },
  {
    slug: 'aguardando_os',
    nome: 'Aguardando OS',
    descricao: 'Mensagem enviada quando aguardando geração de OS',
    mensagem: 'Olá {{nome_contato}}! 📄\n\nVamos gerar a Ordem de Serviço referente ao seu atendimento.\n📋 Protocolo: *{{numero_protocolo}}*\n\nEm breve enviaremos o link para assinatura.\n\nAtenciosamente,\nEquipe Codemed',
    variaveis: ['{{nome_contato}}', '{{numero_protocolo}}'],
  },
  {
    slug: 'concluido',
    nome: 'Concluído',
    descricao: 'Mensagem enviada quando o atendimento é finalizado',
    mensagem: 'Olá {{nome_contato}}! ✅\n\nSeu atendimento do protocolo *{{numero_protocolo}}* foi concluído com sucesso.\n\nAgradecemos pelo contato! Caso precise de algo, é só nos chamar.\n\nAtenciosamente,\nEquipe Codemed',
    variaveis: ['{{nome_contato}}', '{{numero_protocolo}}'],
  },
  {
    slug: 'csat',
    nome: 'Avaliação (CSAT)',
    descricao: 'Mensagem de avaliação enviada após concluir o atendimento',
    mensagem: 'Olá! 👋\n\nSeu atendimento foi concluído.\n\nPor favor, avalie de 1 a 5 estrelas como foi sua experiência:\n\n⭐ 1 - Péssimo\n⭐⭐ 2 - Ruim\n⭐⭐⭐ 3 - Regular\n⭐⭐⭐⭐ 4 - Bom\n⭐⭐⭐⭐⭐ 5 - Excelente\n\nResponda esta mensagem com o número de estrelas (1 a 5).\n\nObrigado pelo feedback! 🙏\n\nEquipe Codemed',
    variaveis: [],
  },
  {
    slug: 'followup',
    nome: 'Follow-up',
    descricao: 'Mensagem de acompanhamento para clientes offline',
    mensagem: 'Olá {{nome_contato}}! 👋\n\nNotei que você ficou offline após nos enviar uma mensagem. Ainda precisa de ajuda?\n\nQuando quiser, é só responder esta mensagem por aqui mesmo. Seu atendimento continua registrado e um de nossos analistas irá te atender assim que você retornar.\n\nAtenciosamente,\nEquipe Codemed',
    variaveis: ['{{nome_contato}}'],
  },
  {
    slug: 'boas_vindas',
    nome: 'Boas-vindas',
    descricao: 'Mensagem de boas-vindas ao iniciar conversa',
    mensagem: 'Olá! {{nome}} {{saudacao}} 👋\n\nQue bom ter você por aqui!\n\nComo podemos te ajudar hoje? Descreva por aqui mesmo que um de nossos analistas te atenderá em instantes.',
    variaveis: ['{{nome}}', '{{saudacao}}'],
  },
  {
    slug: 'opcao_invalida',
    nome: 'Opção Inválida',
    descricao: 'Mensagem quando o cliente envia opção inválida',
    mensagem: 'Hmm, não entendi sua resposta, {{nome}} 😅\n\nPor favor, descreva com mais detalhes o que você precisa.',
    variaveis: ['{{nome}}'],
  },
  {
    slug: 'fora_horario',
    nome: 'Fora de Horário',
    descricao: 'Mensagem quando cliente fora do horário comercial',
    mensagem: 'Olá! Nosso horário de atendimento é de segunda a sexta, das 08:00 às 18:00. Deixamos seu contato registrado e um atendente humano o responderá assim que possível. 🙏',
    variaveis: [],
  },
];

const FIELD_MAP: Record<string, string> = {
  fila: 'autoMessage',
  triagem: 'mensagemTriagem',
  em_atendimento: 'mensagemEmAtendimento',
  aguardando_cliente: 'mensagemAguardandoCliente',
  aguardando_os: 'mensagemAguardandoOs',
  concluido: 'mensagemConcluido',
  csat: 'mensagemCsat',
  followup: 'mensagemFollowup',
  boas_vindas: 'mensagemBoasVindas',
  opcao_invalida: 'mensagemOpcaoInvalida',
  fora_horario: 'mensagemForaHorario',
};

function getFieldForSlug(slug: string): string {
  return FIELD_MAP[slug] || 'autoMessage';
}

function getMessageFromConfig(config: any, slug: string): string {
  const field = getFieldForSlug(slug);
  return config?.[field] || '';
}

export async function listAutoMessages(): Promise<(AutoMessageConfig & { mensagemAtual: string })[]> {
  const configs = await prisma.helpdeskConfig.findMany({
    where: { slug: { in: AUTO_MESSAGES.map(m => m.slug) } },
  });

  return AUTO_MESSAGES.map(msg => {
    const config = configs.find(c => c.slug === msg.slug);
    const mensagemAtual = config ? getMessageFromConfig(config, msg.slug) : '';
    return {
      ...msg,
      mensagemAtual: mensagemAtual || msg.mensagem,
    };
  });
}

export async function updateAutoMessage(slug: string, novaMensagem: string): Promise<void> {
  const config = await prisma.helpdeskConfig.findUnique({ where: { slug } });
  if (!config) throw new Error('Configuração não encontrada');

  const field = getFieldForSlug(slug);
  const data: any = {};
  data[field] = novaMensagem;

  await prisma.helpdeskConfig.update({ where: { id: config.id }, data });
}

export async function resetAutoMessage(slug: string): Promise<void> {
  const msg = AUTO_MESSAGES.find(m => m.slug === slug);
  if (!msg) throw new Error('Mensagem não encontrada');
  await updateAutoMessage(slug, msg.mensagem);
}
