import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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
        scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-neutral-100' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <a href="#" className="flex items-center gap-1.5">
            <Logomark />
          </a>

          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`text-sm font-semibold transition-colors hover:text-green-300 ${
                  scrolled ? 'text-codemed-800' : 'text-white/80 hover:text-white'
                }`}
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/login"
              className={`text-sm font-bold px-5 py-2.5 rounded-lg transition-all duration-200 ${
                scrolled
                  ? 'bg-green-300 text-codemed-700 hover:bg-green-200'
                  : 'bg-white text-codemed-700 hover:bg-green-50'
              }`}
            >
              Acessar Sistema
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg"
            aria-label="Menu"
          >
            <div className={`w-6 h-0.5 mb-1.5 transition-all ${scrolled ? 'bg-codemed-700' : 'bg-white'}`} />
            <div className={`w-6 h-0.5 mb-1.5 transition-all ${scrolled ? 'bg-codemed-700' : 'bg-white'}`} />
            <div className={`w-6 h-0.5 transition-all ${scrolled ? 'bg-codemed-700' : 'bg-white'}`} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-neutral-100 shadow-lg">
          <div className="px-4 py-4 space-y-3">
            {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-semibold text-codemed-800 py-2"
                >
                {l.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block text-center bg-green-300 text-codemed-700 font-bold px-5 py-3 rounded-lg"
            >
              Acessar Sistema
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function Logomark({ mono }: { mono?: boolean }) {
  return (
    <img
      src="/logo-codemed-horizontal.png"
      alt="Codemed"
      className={`h-8 w-auto ${mono ? 'brightness-0 invert' : ''}`}
    />
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-codemed-700">
      <div className="absolute inset-0 bg-gradient-radial from-codemed-100/30 via-codemed-700 to-codemed-700" />
      <div className="absolute inset-0">
        <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full bg-green-300/10 blur-3xl" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full bg-green-300/5 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full bg-green-300/40" />
        <div className="absolute top-2/3 left-1/4 w-3 h-3 rounded-full bg-green-300/30" />
        <div className="absolute top-1/4 left-2/3 w-1.5 h-1.5 rounded-full bg-green-300/20" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-green-300/20 border border-green-300/40 text-green-300 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-8">
            <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
            Plataforma completa para laboratórios
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
            O sistema que cresce{' '}
            <span className="text-green-300">com seu laboratório</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 max-w-xl mb-10 leading-relaxed">
            CRM, Ordem de Serviço Digital, WhatsApp nativo e Dashboard com IA —
            tudo em um sistema que seu time vai gostar de usar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <a
              href="#precos"
              className="inline-flex items-center justify-center bg-green-300 text-codemed-700 font-bold px-8 py-4 rounded-lg text-base hover:bg-green-200 hover:shadow-brand transition-all duration-200"
            >
              Começar agora
            </a>
            <a
              href="#funcionalidades"
              className="inline-flex items-center justify-center bg-white/10 text-white font-semibold px-8 py-4 rounded-lg text-base hover:bg-white/20 transition-all duration-200"
            >
              Ver funcionalidades
              <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-8 text-sm">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-codemed-700 bg-gradient-to-br from-green-300 to-green-400 flex items-center justify-center text-[10px] font-bold text-codemed-700"
                >
                  {['JC', 'ML', 'RP', 'AS'][i - 1]}
                </div>
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-codemed-700 bg-green-300 flex items-center justify-center text-[10px] font-bold text-codemed-700">
                +1.2k
              </div>
            </div>
            <span className="text-white/50">
              <strong className="text-white font-semibold">1.200+</strong> laboratórios confiam
            </span>
            <span className="text-white/20 hidden sm:inline">|</span>
            <span className="text-white/50">
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
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'CRM Inteligente',
    desc: 'Gestão completa de clientes com pipeline de oportunidades, timeline de interações e busca global. Saiba exatamente onde cada cliente está.',
    highlight: 'Pipeline kanban • Histórico completo • Busca com debounce',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'OS Digital com Assinatura',
    desc: 'Crie ordens de serviço em segundos e envie para assinatura digital via WhatsApp. PDF gerado automaticamente com valor legal.',
    highlight: 'Assinatura em canvas • Link via WhatsApp • PDF automático',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: 'WhatsApp Nativo',
    desc: 'Conecte o WhatsApp do laboratório direto no sistema. Receba mensagens → viram tickets. Responda sem sair da plataforma.',
    highlight: 'QR Code • Tickets automáticos • Histórico completo',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Dashboard com IA',
    desc: '8 KPIs em tempo real, 5 tipos de gráfico e insights automáticos gerados por IA. Decisões baseadas em dados, não em achismo.',
    highlight: 'KPIs • Gráficos dinâmicos • Insights via Claude AI',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    title: 'Kanban de Tarefas',
    desc: 'Organize projetos, sprints e prioridades com drag & drop. Substitua planners genéricos por um sistema feito para laboratórios.',
    highlight: 'Drag & drop • Prioridades • Projetos e sprints',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Alertas Semanais',
    desc: 'Relatórios automáticos toda segunda-feira via WhatsApp. Saiba exatamente como foi a semana do laboratório sem precisar abrir o sistema.',
    highlight: 'Cron semanal • WhatsApp • Relatório completo',
  },
];

function Features() {
  return (
    <section id="funcionalidades" className="py-24 lg:py-32 bg-neutral-50">
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
              className="group bg-white rounded-xl border border-neutral-100 p-8 hover:shadow-lg hover:border-green-300/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mb-5 group-hover:bg-green-300 group-hover:text-codemed-700 transition-all duration-300">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-codemed-700 mb-3">{f.title}</h3>
              <p className="text-neutral-500 text-sm leading-relaxed mb-4">{f.desc}</p>
              <div className="text-xs font-semibold text-green-600 bg-green-50 rounded-md px-3 py-1.5 inline-block">
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
              <span className="text-green-500">Não adaptado.</span>
            </h2>
            <p className="text-neutral-500 text-lg leading-relaxed mb-8">
              O Codemed Hub foi construído por quem entende a rotina de um laboratório
              de análises clínicas. Coleta às 6h, pressão do PCMSO, laudos, convênios,
              faturamento — a gente sabe como é.
            </p>
            <p className="text-neutral-500 text-lg leading-relaxed mb-8">
          Se você é dono ou gestor de laboratório em cidades de médio porte (tier 2/3),
          com 1 a 5 unidades e faturamento entre R$ 50K e R$ 500K/mês: esse sistema
          foi pensado para você.
            </p>
            <a
              href="#precos"
              className="inline-flex items-center gap-2 text-green-500 font-bold hover:text-green-600 transition-colors"
            >
              Ver planos e preços
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>

          <div className="space-y-4">
            {problems.map((p, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                  {i + 1}
                </div>
                <p className="text-codemed-800 font-medium leading-relaxed pt-1">{p}</p>
              </div>
            ))}
            <div className="p-4 rounded-lg bg-green-50 border border-green-100">
              <p className="text-green-800 font-bold text-sm">
                Se você respondeu "sim" a qualquer pergunta acima, o Codemed Hub pode
                resolver.
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
    <section className="py-20 bg-codemed-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((s, i) => (
            <div key={i} className="space-y-2">
              <div className="text-3xl lg:text-4xl font-extrabold text-green-300">{s.value}</div>
              <div className="text-sm text-white/50 font-medium">{s.label}</div>
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
    <section id="depoimentos" className="py-24 lg:py-32 bg-neutral-50">
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
            <div key={i} className="bg-white rounded-xl border border-neutral-100 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-1 mb-6">
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-neutral-600 leading-relaxed mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-300 to-green-500 flex items-center justify-center text-xs font-bold text-codemed-700">
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-bold text-codemed-700">{t.name}</div>
                  <div className="text-xs text-neutral-400">{t.role} — {t.city}</div>
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
              className={`rounded-2xl border-2 p-8 flex flex-col ${
                p.highlight
                  ? 'border-green-300 bg-white shadow-xl relative'
                  : 'border-neutral-100 bg-white'
              }`}
            >
              {p.highlight && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-300 text-codemed-700 text-xs font-bold tracking-wider uppercase px-4 py-1.5 rounded-full">
                  Mais popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-codemed-700 mb-1">{p.name}</h3>
                <p className="text-sm text-neutral-400">{p.desc}</p>
              </div>

              <div className="mb-8">
                <span className="text-3xl font-extrabold text-codemed-700">{p.price}</span>
                <span className="text-neutral-400 text-sm">{p.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-neutral-600">
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                  p.highlight
                    ? 'bg-green-300 text-codemed-700 hover:bg-green-200 hover:shadow-brand'
                    : 'bg-neutral-50 text-codemed-700 hover:bg-neutral-100 border border-neutral-200'
                }`}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-neutral-400 text-sm">
            Todos os planos incluem 7 dias de trial gratuito. Sem cartão de crédito.
          </p>
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="py-24 bg-codemed-700 relative overflow-hidden">
      <div className="absolute top-[-150px] right-[-150px] w-[400px] h-[400px] rounded-full bg-green-300/10 blur-3xl" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] rounded-full bg-green-300/5 blur-3xl" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-green-300/20 border border-green-300/40 text-green-300 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-8">
          Teste grátis por 7 dias
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
          Pronto para crescer <br />
          <span className="text-green-300">com seu laboratório?</span>
        </h2>

        <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto">
          Sem cartão de crédito. Sem fidelidade. Em 3 dias seu laboratório já está
          rodando com a gente.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-green-300 text-codemed-700 font-bold px-10 py-4 rounded-lg text-base hover:bg-green-200 hover:shadow-brand transition-all duration-200">
            Testar grátis por 7 dias
          </button>
          <button className="bg-white/10 text-white font-semibold px-10 py-4 rounded-lg text-base hover:bg-white/20 transition-all duration-200">
            Falar com especialista
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-codemed-700 border-t border-white/10 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-1.5">
              <Logomark mono />
            </div>
            <p className="text-sm text-white/40 leading-relaxed">
              O sistema que cresce com seu laboratório.
            </p>
            <p className="text-sm text-white/40">
              São Luís, MA — Brasil
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-widest uppercase text-white/50 mb-4">
              Produto
            </h4>
            <ul className="space-y-3">
              {['CRM', 'OS Digital', 'WhatsApp', 'Dashboard IA', 'Kanban'].map((item) => (
                <li key={item}>
                  <a href="#funcionalidades" className="text-sm text-white/60 hover:text-green-300 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-widest uppercase text-white/50 mb-4">
              Empresa
            </h4>
            <ul className="space-y-3">
              {['Sobre', 'Blog', 'Carreiras', 'Parceiros', 'Contato'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-white/60 hover:text-green-300 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-widest uppercase text-white/50 mb-4">
              Suporte
            </h4>
            <ul className="space-y-3">
              {['Central de Ajuda', 'API Docs', 'Status', 'Política de Privacidade', 'Termos de Uso'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-white/60 hover:text-green-300 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Codemed — Desenvolvimento de Software Laboratorial. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            {['LinkedIn', 'Instagram', 'YouTube'].map((s) => (
              <a
                key={s}
                href="#"
                className="text-xs text-white/40 hover:text-green-300 transition-colors"
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
