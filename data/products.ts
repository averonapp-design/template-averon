import { Product } from "@/context/CartContext";

export const PRODUCTS: Product[] = [
  {
    id: "plan-starter",
    nome: "Plano Starter",
    descricao:
      "Ideal para pequenas empresas iniciando sua jornada digital. Inclui painel web, até 3 usuários, suporte por e-mail e 1.000 transações/mês.",
    valor: 99.0,
    categoria: "Planos",
    tags: ["mensal", "popular"],
  },
  {
    id: "plan-pro",
    nome: "Plano Pro",
    descricao:
      "Para empresas em crescimento. Até 10 usuários, suporte prioritário, 10.000 transações/mês, relatórios avançados e API ilimitada.",
    valor: 299.0,
    categoria: "Planos",
    destaque: true,
    tags: ["mensal", "mais vendido"],
  },
  {
    id: "plan-business",
    nome: "Plano Business",
    descricao:
      "Solução completa para médias empresas. Usuários ilimitados, SLA 99.9%, suporte dedicado, integrações premium e dashboard personalizado.",
    valor: 599.0,
    categoria: "Planos",
    tags: ["mensal"],
  },
  {
    id: "plan-enterprise",
    nome: "Plano Enterprise",
    descricao:
      "Infraestrutura dedicada, SLA 99.99%, gerente de conta exclusivo, onboarding personalizado e contrato customizado.",
    valor: 999.0,
    categoria: "Planos",
    tags: ["mensal", "enterprise"],
  },
  {
    id: "addon-support",
    nome: "Suporte Premium",
    descricao:
      "Suporte 24/7 via telefone, chat e e-mail com tempo de resposta garantido de até 1 hora.",
    valor: 49.0,
    categoria: "Add-ons",
    tags: ["mensal"],
  },
  {
    id: "addon-training",
    nome: "Treinamento Completo",
    descricao:
      "Treinamento presencial ou online para sua equipe. 8 horas de capacitação com certificado.",
    valor: 199.0,
    categoria: "Add-ons",
    tags: ["único"],
  },
  {
    id: "addon-integration",
    nome: "Integração Personalizada",
    descricao:
      "Desenvolvimento de integrações customizadas com seus sistemas legados. Preço por projeto.",
    valor: 499.0,
    categoria: "Add-ons",
    tags: ["único"],
  },
  {
    id: "addon-analytics",
    nome: "Analytics Avançado",
    descricao:
      "Módulo de BI com dashboards personalizados, exportação de dados e relatórios automáticos por e-mail.",
    valor: 79.0,
    categoria: "Add-ons",
    tags: ["mensal"],
  },
];

export const CATEGORIAS = ["Todos", "Planos", "Add-ons"];
