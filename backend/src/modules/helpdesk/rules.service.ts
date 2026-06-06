import prisma from '../../config/database';

export interface HelpdeskRule {
  id: string;
  nome: string;
  categoria: string;
  prioridade: number;
  palavrasChave: string;
  ativo: boolean;
  ordem: number;
}

const REGRAS_PADRAO: Array<Omit<HelpdeskRule, 'id'>> = [
  {
    nome: 'Financeiro',
    categoria: 'financeiro',
    prioridade: 10,
    palavrasChave: 'boleto,fatura,2 via,segunda via,pix,cobranca,cobran\u00e7a,pagamento,financeiro,mensalidade,anuidade,vencimento,vencido,atraso,recibo,nota fiscal,nf,xml,danfe',
    ativo: true,
    ordem: 0,
  },
  {
    nome: 'Suporte T\u00e9cnico',
    categoria: 'suporte_tecnico',
    prioridade: 20,
    palavrasChave: 'erro,nao funciona,n\u00e3o funciona,n\u00e3o consigo,nao consigo,bug,problema,falha,travando,lento,trava,caiu,offline,sem conexao,sem conex\u00e3o,senha,login,acesso,libera\u00e7ao,libera,liberar,esqueci,resetar,configurar,instalar,atualizar,atualiza\u00e7\u00e3o,suporte,socorro,ajuda,urgente,emergencia',
    ativo: true,
    ordem: 1,
  },
  {
    nome: 'Comercial',
    categoria: 'comercial',
    prioridade: 30,
    palavrasChave: 'orcamento,or\u00e7amento,proposta,plano,planos,preco,pre\u00e7o,valor,contrato,adesao,ades\u00e3o,contratar,comprar,adquirir,venda,comercial,indica\u00e7\u00e3o,indicacao,parceria,demonstra\u00e7\u00e3o,demo',
    ativo: true,
    ordem: 2,
  },
  {
    nome: 'Cancelamento',
    categoria: 'cancelamento',
    prioridade: 5,
    palavrasChave: 'cancelar,cancelamento,desistir,desistencia,desist\u00eancia,encerrar,rescindir,rescisao,rescis\u00e3o,nao quero mais,n\u00e3o quero mais,reembolso,devolucao,devolu\u00e7\u00e3o',
    ativo: true,
    ordem: 3,
  },
];

export async function ensureHelpdeskRules() {
  for (const regra of REGRAS_PADRAO) {
    const existing = await prisma.helpdeskRule.findFirst({ where: { categoria: regra.categoria } });
    if (!existing) {
      await prisma.helpdeskRule.create({ data: regra });
    }
  }
}

export interface MatchResult {
  categoria: string;
  regraNome: string;
  matchedKeyword: string;
  prioridade: number;
}

function _normalizarTexto(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export const normalizarTexto = _normalizarTexto;

export async function classificarPorPalavrasChave(texto: string): Promise<MatchResult | null> {
  if (!texto || texto.trim().length < 3) return null;
  const regras = await prisma.helpdeskRule.findMany({
    where: { ativo: true },
    orderBy: [{ prioridade: 'asc' }, { ordem: 'asc' }],
  });
  if (regras.length === 0) return null;

  const textoNorm = normalizarTexto(texto);

  for (const regra of regras) {
    const palavras = regra.palavrasChave.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
    for (const palavra of palavras) {
      if (palavra.length < 3) continue;
      const palavraNorm = normalizarTexto(palavra);
      if (palavraNorm && textoNorm.includes(palavraNorm)) {
        return {
          categoria: regra.categoria,
          regraNome: regra.nome,
          matchedKeyword: palavra,
          prioridade: regra.prioridade,
        };
      }
    }
  }
  return null;
}
