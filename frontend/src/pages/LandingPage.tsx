import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Zap, BarChart3, ArrowRight, Check, Star, ChevronRight, MessageSquare, FileText, Users, Clock, Kanban, Bot } from 'lucide-react';

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Funcionalidades', href: '#funcionalidades' },
    { label: 'Para quem é', href: '#para-quem' },
    { label: 'Depoimentos', href: '#depoimentos' },
    { label: 'Preços', href: '#precos' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-slate-100' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <a href="#" className="flex items-center gap-1.5">
            <img src="/logo-codemed-horizontal.png" alt="Codemed" className={`h-8 w-auto`} />
          </a>

          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition-colors ${
                  scrolled ? 'text-slate-600 hover:text-blue-600' : 'text-white/70 hover:text-white'
                }`}
                style={{ fontFamily: 'Lexend, sans-serif' }}
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/login"
              className={`text-sm font-bold px-6 py-2.5 rounded-xl transition-all duration-200 ${
                scrolled
                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-brand shadow-sm'
                  : 'bg-white text-slate-900 hover:bg-blue-50'
              }`}
              style={{ fontFamily: 'Khand, sans-serif' }}
            >
              Acessar Sistema
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-xl"
            aria-label="Menu"
          >
            <div className={`w-6 h-0.5 mb-1.5 transition-all ${scrolled ? 'bg-slate-700' : 'bg-white'}`} />
            <div className={`w-6 h-0.5 mb-1.5 transition-all ${scrolled ? 'bg-slate-700' : 'bg-white'}`} />
            <div className={`w-5 h-0.5 transition-all ${scrolled ? 'bg-slate-700' : 'bg-white'}`} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 shadow-2xl animate-slide-down">
          <div className="px-4 py-4 space-y-1">
            {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-medium text-slate-700 py-3 px-3 rounded-xl hover:bg-blue-50 transition-colors"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                {l.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block text-center bg-blue-600 text-white font-bold px-5 py-3 rounded-xl mt-3 hover:bg-blue-700 transition-colors"
              style={{ fontFamily: 'Khand, sans-serif' }}
            >
              Acessar Sistema
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-hero">
      {/* Decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-[-200px] right-[-200px] w-[700px] h-[700px] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-blue-400/5 blur-3xl" />
        <div className="absolute top-1/4 right-1/3 w-2 h-2 rounded-full bg-blue-400/40 animate-pulse" />
        <div className="absolute top-2/3 left-1/4 w-3 h-3 rounded-full bg-blue-300/20" />
        <div className="absolute top-1/3 left-2/3 w-1.5 h-1.5 rounded-full bg-blue-500/30" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '80px 80px'
        }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Plataforma completa para laboratórios
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
            O sistema que cresce{' '}
            <span className="bg-gradient-to-r from-blue-300 to-blue-200 bg-clip-text text-transparent">com seu laboratório</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-xl mb-10 leading-relaxed" style={{ fontFamily: 'Lexend, sans-serif' }}>
            CRM, Ordem de Serviço Digital, WhatsApp nativo e Dashboard com IA —
            tudo em um sistema que seu time vai gostar de usar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-14">
            <a
              href="#precos"
              className="inline-flex items-center justify-center bg-blue-600 text-white font-bold px-8 py-4 rounded-xl text-base hover:bg-blue-500 hover:shadow-brand-xl transition-all duration-200 shadow-lg shadow-blue-600/30"
              style={{ fontFamily: 'Khand, sans-serif' }}
            >
              Começar agora
              <ArrowRight size={18} className="ml-2" />
            </a>
            <a
              href="#funcionalidades"
              className="inline-flex items-center justify-center bg-white/10 text-white font-semibold px-8 py-4 rounded-xl text-base hover:bg-white/15 backdrop-blur-sm border border-white/10 transition-all duration-200"
              style={{ fontFamily: 'Lexend, sans-serif' }}
            >
              Ver funcionalidades
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-8 text-sm">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full border-2 border-slate-900 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                >
                  {['JC', 'ML', 'RP', 'AS'][i - 1]}
                </div>
              ))}
              <div className="w-9 h-9 rounded-full border-2 border-slate-900 bg-blue-800 flex items-center justify-center text-[10px] font-bold text-blue-200">
                +1.2k
              </div>
            </div>
            <span className="text-slate-400">
              <strong className="text-white font-semibold">1.200+</strong> laboratórios confiam
            </span>
            <span className="text-white/20 hidden sm:inline">|</span>
            <span className="text-slate-400">
              <strong className="text-white font-semibold">98%</strong> satisfação
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Users,
    title: 'CRM Inteligente',
    desc: 'Gestão completa de clientes com pipeline de oportunidades, timeline de interações e busca global. Saiba exatamente onde cada cliente está.',
    highlight: 'Pipeline kanban • Histórico completo • Busca com debounce',
  },
  {
    icon: FileText,
    title: 'OS Digital com Assinatura',
    desc: 'Crie ordens de serviço em segundos e envie para assinatura digital via WhatsApp. PDF gerado automaticamente com valor legal.',
    highlight: 'Assinatura em canvas • Link via WhatsApp • PDF automático',
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp Nativo',
    desc: 'Conecte o WhatsApp do laboratório direto no sistema. Receba mensagens → viram tickets. Responda sem sair da plataforma.',
    highlight: 'QR Code • Tickets automáticos • Histórico completo',
  },
  {
    icon: BarChart3,
    title: 'Dashboard com IA',
    desc: '8 KPIs em tempo real, 5 tipos de gráfico e insights automáticos gerados por IA. Decisões baseadas em dados, não em achismo.',
    highlight: 'KPIs • Gráficos dinâmicos • Insights via IA',
  },
  {
    icon: Kanban,
    title: 'Kanban de Tarefas',
    desc: 'Organize projetos, sprints e prioridades com drag & drop. Substitua planners genéricos por um sistema feito para laboratórios.',
    highlight: 'Drag & drop • Prioridades • Projetos e sprints',
  },
  {
    icon: Clock,
    title: 'Alertas Semanais',
    desc: 'Relatórios automáticos toda segunda-feira via WhatsApp. Saiba exatamente como foi a semana do laboratório sem precisar abrir o sistema.',
    highlight: 'Cron semanal • WhatsApp • Relatório completo',
  },
];

function Features() {
  return (
    <section id="funcionalidades" className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="section-badge justify-center mx-auto mb-4">Funcionalidades</div>
          <h2 className="section-title mb-4">Tudo que seu laboratório precisa em um só lugar</h2>
          <p className="section-desc mx-auto">
            CRM, gestão de OS, WhatsApp integrado e inteligência de dados — sem precisar
            de 4 sistemas diferentes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl border border-slate-100 p-8 hover:shadow-premium-lg hover:border-blue-200/50 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-600/25 transition-all duration-300">
                <f.icon size={22} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3" style={{ fontFamily: 'Khand, sans-serif' }}>{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-5" style={{ fontFamily: 'Lexend, sans-serif' }}>{f.desc}</p>
              <div className="text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5 inline-block border border-blue-100">
                {f.highlight}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TargetAudience() {
  const problems = [
    'Ainda usa planilha ou papel para controlar ordens de serviço?',
    'Perde tempo procurando histórico de cliente em emails perdidos?',
    'Tem dificuldade de acompanhar o que cada técnico está fazendo?',
    'Usa 3 sistemas diferentes que não conversam entre si?',
    'Não consegue medir resultados e tomar decisões com dados?',
  ];

  return (
    <section id="para-quem" className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="section-badge mb-4">Para quem é</div>
            <h2 className="section-title mb-6">
              Feito para laboratório. <br />
              <span className="text-blue-600">Não adaptado.</span>
            </h2>
            <p className="text-slate-500 text-lg leading-relaxed mb-6" style={{ fontFamily: 'Lexend, sans-serif' }}>
              O Codemed Hub foi construído por quem entende a rotina de um laboratório
              de análises clínicas. Coleta às 6h, pressão do PCMSO, laudos, convênios,
              faturamento — a gente sabe como é.
            </p>
            <p className="text-slate-500 text-lg leading-relaxed mb-8" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Se você é dono ou gestor de laboratório em cidades de médio porte (tier 2/3),
              com 1 a 5 unidades e faturamento entre R$ 50K e R$ 500K/mês: esse sistema
              foi pensado para você.
            </p>
            <a
              href="#precos"
              className="inline-flex items-center gap-2 text-blue-600 font-bold hover:text-blue-700 transition-colors group"
              style={{ fontFamily: 'Khand, sans-serif' }}
            >
              Ver planos e preços
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          <div className="space-y-4">
            {problems.map((p, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200/50 hover:shadow-sm transition-all duration-200">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ fontFamily: 'Khand, sans-serif' }}>
                  {i + 1}
                </div>
                <p className="text-slate-700 font-medium leading-relaxed pt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>{p}</p>
              </div>
            ))}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-blue-800 font-bold text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
                Se você respondeu "sim" a qualquer pergunta acima, o Codemed Hub pode resolver.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const stats = [
  { value: '1.200+', label: 'Laboratórios atendidos' },
  { value: '98%', label: 'Satisfação dos clientes' },
  { value: '3 dias', label: 'Implantação média' },
  { value: '40%', label: 'Redução no tempo de OS' },
];

function Stats() {
  return (
    <section className="py-20 bg-gradient-hero relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((s, i) => (
            <div key={i} className="space-y-2 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-blue-300 to-blue-200 bg-clip-text text-transparent">{s.value}</div>
              <div className="text-sm text-slate-400 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const testimonials = [
  {
    name: 'Juliana Costa',
    role: 'Gestora de Laboratório',
    city: 'Montes Claros, MG',
    text: 'Reduzimos o tempo de liberação de laudos em 40% depois que implantamos o Codemed. O sistema entende a realidade do laboratório de verdade.',
    initials: 'JC',
  },
  {
    name: 'Marcelo Lima',
    role: 'Diretor Técnico',
    city: 'Patos de Minas, MG',
    text: 'Usávamos 3 sistemas diferentes. Agora é tudo em um lugar — CRM, OS, WhatsApp. A equipe inteira aprovou.',
    initials: 'ML',
  },
  {
    name: 'Renata Porto',
    role: 'Proprietária',
    city: 'Juazeiro do Norte, CE',
    text: 'O WhatsApp integrado foi um divisor de águas. Cliente manda mensagem, vira ticket, a gente resolve. Simples assim.',
    initials: 'RP',
  },
];

function Testimonials() {
  return (
    <section id="depoimentos" className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="section-badge justify-center mx-auto mb-4">Depoimentos</div>
          <h2 className="section-title mb-4">Quem usa, recomenda</h2>
          <p className="section-desc mx-auto">
            Laboratórios de todo o Brasil confiam no Codemed Hub para crescer com
            eficiência.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm hover:shadow-premium transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center gap-0.5 mb-6">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={16} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-slate-600 leading-relaxed mb-6" style={{ fontFamily: 'Lexend, sans-serif' }}>"{t.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900" style={{ fontFamily: 'Khand, sans-serif' }}>{t.name}</div>
                  <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{t.role} — {t.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const plans = [
  {
    name: 'Essencial',
    price: 'R$ 197',
    period: '/mês',
    desc: 'Para laboratórios que estão começando a organizar a gestão.',
    features: [
      'CRM completo',
      'OS Digital (até 100 OS/mês)',
      'Dashboard com KPIs',
      'Kanban de tarefas',
      '1 usuário',
      'Suporte por email',
    ],
    cta: 'Começar trial',
    highlight: false,
  },
  {
    name: 'Profissional',
    price: 'R$ 397',
    period: '/mês',
    desc: 'Para laboratórios em crescimento que querem eficiência total.',
    features: [
      'Tudo do Essencial',
      'OS Digital ilimitada',
      'WhatsApp nativo',
      'Dashboard IA com insights',
      'Até 5 usuários',
      'Alertas semanais WhatsApp',
      'Suporte prioritário',
    ],
    cta: 'Começar trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'R$ 797',
    period: '/mês',
    desc: 'Para redes de laboratórios com múltiplas unidades.',
    features: [
      'Tudo do Profissional',
      'Usuários ilimitados',
      'Múltiplas unidades',
      'API dedicada',
      'Relatórios personalizados',
      'Onboarding dedicado',
      'Suporte 24h',
      'SLA garantido',
    ],
    cta: 'Falar com comercial',
    highlight: false,
  },
];

function Pricing() {
  return (
    <section id="precos" className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="section-badge justify-center mx-auto mb-4">Planos</div>
          <h2 className="section-title mb-4">Transparente como deve ser</h2>
          <p className="section-desc mx-auto">
            Sem taxas escondidas. Sem contrato de fidelidade. Cancele quando quiser.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((p, i) => (
            <div
              key={i}
              className={`rounded-2xl border-2 p-8 flex flex-col transition-all duration-300 ${
                p.highlight
                  ? 'border-blue-500 bg-white shadow-2xl shadow-blue-500/10 relative scale-[1.02]'
                  : 'border-slate-100 bg-white hover:border-blue-200/50 hover:shadow-premium'
              }`}
            >
              {p.highlight && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white text-xs font-bold tracking-wider uppercase px-4 py-1.5 rounded-full shadow-lg shadow-blue-600/25" style={{ fontFamily: 'Khand, sans-serif' }}>
                  Mais popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-1" style={{ fontFamily: 'Khand, sans-serif' }}>{p.name}</h3>
                <p className="text-sm text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>{p.desc}</p>
              </div>

              <div className="mb-8">
                <span className="text-4xl font-extrabold text-slate-900" style={{ fontFamily: 'Khand, sans-serif' }}>{p.price}</span>
                <span className="text-slate-400 text-sm ml-1">{p.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-slate-600" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <Check size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                  p.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-brand shadow-lg shadow-blue-600/25'
                    : 'bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200'
                }`}
                style={{ fontFamily: 'Khand, sans-serif' }}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-slate-400 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Todos os planos incluem 7 dias de trial gratuito. Sem cartão de crédito.
          </p>
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="py-24 bg-gradient-hero relative overflow-hidden">
      <div className="absolute top-[-150px] right-[-150px] w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] rounded-full bg-blue-400/5 blur-3xl" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
          Teste grátis por 7 dias
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
          Pronto para crescer <br />
          <span className="bg-gradient-to-r from-blue-300 to-blue-200 bg-clip-text text-transparent">com seu laboratório?</span>
        </h2>

        <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto" style={{ fontFamily: 'Lexend, sans-serif' }}>
          Sem cartão de crédito. Sem fidelidade. Em 3 dias seu laboratório já está
          rodando com a gente.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-blue-600 text-white font-bold px-10 py-4 rounded-xl text-base hover:bg-blue-500 hover:shadow-brand-xl transition-all duration-200 shadow-lg shadow-blue-600/30" style={{ fontFamily: 'Khand, sans-serif' }}>
            Testar grátis por 7 dias
          </button>
          <button className="bg-white/10 text-white font-semibold px-10 py-4 rounded-xl text-base hover:bg-white/15 backdrop-blur-sm border border-white/10 transition-all duration-200" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Falar com especialista
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-white/10 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-1.5">
              <img src="/logo-codemed-horizontal.png" alt="Codemed" className="h-8 w-auto brightness-0 invert" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed" style={{ fontFamily: 'Lexend, sans-serif' }}>
              O sistema que cresce com seu laboratório.
            </p>
            <p className="text-sm text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>
              São Luís, MA — Brasil
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
              Produto
            </h4>
            <ul className="space-y-3">
              {['CRM', 'OS Digital', 'WhatsApp', 'Dashboard IA', 'Kanban'].map((item) => (
                <li key={item}>
                  <a href="#funcionalidades" className="text-sm text-slate-400 hover:text-blue-400 transition-colors" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
              Empresa
            </h4>
            <ul className="space-y-3">
              {['Sobre', 'Blog', 'Carreiras', 'Parceiros', 'Contato'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-slate-400 hover:text-blue-400 transition-colors" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
              Suporte
            </h4>
            <ul className="space-y-3">
              {['Central de Ajuda', 'API Docs', 'Status', 'Política de Privacidade', 'Termos de Uso'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-slate-400 hover:text-blue-400 transition-colors" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>
            &copy; {new Date().getFullYear()} Codemed — Desenvolvimento de Software Laboratorial. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            {['LinkedIn', 'Instagram', 'YouTube'].map((s) => (
              <a
                key={s}
                href="#"
                className="text-xs text-slate-500 hover:text-blue-400 transition-colors"
                style={{ fontFamily: 'Lexend, sans-serif' }}
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <TargetAudience />
      <Stats />
      <Testimonials />
      <Pricing />
      <Cta />
      <Footer />
    </div>
  );
}
