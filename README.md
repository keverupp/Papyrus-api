# 📜 Papyrus API

API open-source para **geração de PDFs com templates personalizáveis**, construída com **Fastify** e **Puppeteer**. Ideal para aplicações educacionais, empresariais, médicas e documentos diversos.

---

## 🚀 Início Rápido

### 📋 Pré-requisitos

- Node.js 16+
- PostgreSQL
- NPM ou Yarn

### ⚙️ Instalação

```bash
git clone https://github.com/keverupp/papyrus-api.git
cd papyrus
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações

# Criar banco e aplicar migrações
createdb papyrus
npm run migrate:latest

# Criar API keys de exemplo
npm run seed:run

# Iniciar servidor
npm run dev
```

🌐 **API rodando em:** `http://localhost:4000`

---

## 🔐 Autenticação

Todas as requisições exigem o header `x-api-key` com uma chave válida:

```bash
curl -H "x-api-key: SUA_API_KEY_AQUI" http://localhost:4000/pdf/templates
```

### 🔑 Tipos de API Keys

| Tipo | Limite | Descrição |
|------|--------|-----------|
| `basic` | 10 req/min | Para uso básico e testes |
| `premium` | 100 req/min | Para uso comercial |
| `unlimited` | Ilimitado | Para administradores |

---

## 📚 Endpoints Disponíveis

### 🏥 Health Check

**GET** `/health` - Verificar status da API (sem autenticação)

```bash
curl http://localhost:4000/health
```

**Resposta:**

```json
{
  "status": "healthy",
  "timestamp": "2025-06-23T19:43:05.747Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "pdf_engine": "ready",
    "templates": "loaded"
  }
}
```

---

### 📄 Templates

#### **GET** `/pdf/templates` - Listar todos os templates

```bash
curl -H "x-api-key: SUA_KEY" http://localhost:4000/pdf/templates
```

#### **GET** `/pdf/templates/:type` - Detalhes de um template específico

```bash
curl -H "x-api-key: SUA_KEY" http://localhost:4000/pdf/templates/budget-premium
```

---

### 🎨 Geração de PDFs

#### **POST** `/pdf` - Gerar PDF

**Estrutura base:**

```json
{
  "type": "template_type",
  "title": "Título do documento",
  "data": { /* dados específicos do template */ },
  "config": { /* configurações opcionais do PDF */ }
}
```

#### **POST** `/pdf/preview` - Preview HTML (para debug)

```bash
curl -X POST http://localhost:4000/pdf/preview \
  -H "x-api-key: SUA_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "blank", "title": "Preview Teste"}'
```

---

## 📋 Templates Disponíveis

### 📝 **Básicos**

| Tipo | Nome | Descrição |
|------|------|-----------|
| `blank` | Página em Branco | Documento básico sem formatação específica |
| `logo` | Com Logotipo | Documento com espaço para logotipo no cabeçalho |
| `watermark` | Com Marca d'água | Documento com marca d'água personalizada |

### 🎓 **Educacionais**

| Tipo | Nome | Descrição |
|------|------|-----------|
| `exam` | Prova/Exame | Template para provas e exames escolares |
| `assessment` | Avaliação | Template para avaliações e questionários |
| `quiz` | Quiz/Questionário | Template para questionários simples |

### 💼 **Empresariais**

| Tipo | Nome | Descrição |
|------|------|-----------|
| `budget` | Orçamento | Template básico para orçamentos |
| `budget-premium` | Orçamento Premium | Template avançado com logo e marca d'água |
| `report` | Relatório | Template para relatórios executivos |
| `invoice` | Fatura/Invoice | Template para faturas e notas fiscais |

### 🏥 **Médicos**

| Tipo | Nome | Descrição |
|------|------|-----------|
| `anamnesis` | Ficha de Anamnese | Template para fichas médicas |
| `prescription` | Receita Médica | Template para receitas médicas |
| `clinical_form` | Formulário Clínico | Template para formulários clínicos |

---

## 💰 Exemplos Práticos - Orçamento Premium

### 🎯 **Exemplo 1: Orçamento Básico**

```bash
curl -X POST http://localhost:4000/pdf \
  -H "x-api-key: SUA_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "budget-premium",
    "title": "Orçamento Simples",
    "data": {
      "budget": {
        "number": "ORÇ-2025-001",
        "company": {
          "name": "Minha Empresa LTDA",
          "cnpj": "12.345.678/0001-90"
        },
        "client": {
          "name": "Cliente Teste",
          "email": "cliente@teste.com"
        },
        "items": [
          {
            "description": "Desenvolvimento Web",
            "quantity": 1,
            "unitPrice": 5000
          }
        ]
      }
    }
  }' \
  --output orcamento-simples.pdf
```

### 🖼️ **Exemplo 2: Com Logo no Cabeçalho**

```bash
curl -X POST http://localhost:4000/pdf \
  -H "x-api-key: SUA_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "budget-premium",
    "title": "Orçamento com Logo",
    "data": {
      "logo": {
        "url": "https://via.placeholder.com/150x60/3498db/ffffff?text=EMPRESA",
        "width": "150px",
        "height": "60px"
      },
      "budget": {
        "company": {"name": "Empresa com Logo"},
        "client": {"name": "Cliente VIP"},
        "items": [
          {"description": "Serviço Premium", "quantity": 1, "unitPrice": 10000}
        ]
      }
    }
  }' \
  --output orcamento-com-logo.pdf
```

### 🔐 **Exemplo 3: Com Marca d'Água de Texto**

```bash
curl -X POST http://localhost:4000/pdf \
  -H "x-api-key: SUA_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "budget-premium",
    "title": "Orçamento Confidencial",
    "data": {
      "watermark": {
        "type": "text",
        "text": "CONFIDENCIAL",
        "opacity": 0.08,
        "rotation": -45,
        "fontSize": "80px"
      },
      "budget": {
        "company": {"name": "Empresa Segura"},
        "client": {"name": "Cliente Especial"},
        "items": [
          {"description": "Projeto Secreto", "quantity": 1, "unitPrice": 15000}
        ]
      }
    }
  }' \
  --output orcamento-confidencial.pdf
```

### 🎨 **Exemplo 4: Com Marca d'Água de Logo**

```bash
curl -X POST http://localhost:4000/pdf \
  -H "x-api-key: SUA_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "budget-premium",
    "title": "Orçamento com Marca",
    "data": {
      "logo": {
        "url": "https://via.placeholder.com/150x60/3498db/ffffff?text=LOGO"
      },
      "watermark": {
        "type": "logo",
        "logo": {
          "url": "https://via.placeholder.com/300x300/cccccc/ffffff?text=MARCA",
          "opacity": 0.05,
          "width": "300px"
        }
      },
      "budget": {
        "company": {"name": "Empresa Premium"},
        "client": {"name": "Cliente Exclusivo"},
        "items": [
          {"description": "Solução Completa", "quantity": 1, "unitPrice": 25000}
        ]
      }
    }
  }' \
  --output orcamento-premium.pdf
```

### 💎 **Exemplo 5: Orçamento Completo**

```json
{
  "type": "budget-premium",
  "title": "PROPOSTA COMERCIAL COMPLETA",
  "data": {
    "logo": {
      "url": "https://via.placeholder.com/150x60/3498db/ffffff?text=PAPYRUS",
      "width": "150px",
      "height": "65px"
    },
    "watermark": {
      "type": "text",
      "text": "CONFIDENCIAL",
      "opacity": 0.06
    },
    "budget": {
      "number": "ORÇ-PREMIUM-2025-001",
      "validUntil": "2025-07-23",
      "company": {
        "name": "Papyrus Solutions LTDA",
        "cnpj": "12.345.678/0001-90",
        "address": "Rua da Inovação, 123 - São Paulo - SP",
        "phone": "(11) 99999-8888",
        "email": "comercial@papyrussolutions.com.br",
        "website": "www.papyrussolutions.com.br"
      },
      "client": {
        "name": "Empresa Inovadora S.A.",
        "document": "98.765.432/0001-10",
        "email": "projetos@empresainovadora.com.br",
        "phone": "(21) 88888-7777"
      },
      "items": [
        {
          "description": "Sistema de Gestão Empresarial",
          "details": "ERP completo com módulos financeiro, estoque e vendas",
          "quantity": 1,
          "unitPrice": 45000
        },
        {
          "description": "Aplicativo Mobile",
          "details": "App nativo para Android e iOS",
          "quantity": 2,
          "unitPrice": 15000
        },
        {
          "description": "Treinamento",
          "details": "40 horas de capacitação",
          "quantity": 40,
          "unitPrice": 350
        }
      ],
      "discount": 5000,
      "taxRate": 10,
      "notes": "• Prazo: 90 dias\n• Garantia: 12 meses\n• Suporte: 24/7",
      "terms": "• Pagamento: 30% + 40% + 30%\n• Valores válidos por 60 dias"
    }
  },
  "config": {
    "format": "A4",
    "orientation": "portrait"
  }
}
```

---

## 📝 Outros Templates

### 📄 **Documento Básico**

```bash
curl -X POST http://localhost:4000/pdf \
  -H "x-api-key: SUA_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blank",
    "title": "Meu Documento",
    "data": {
      "content": "Este é o conteúdo do meu documento.\nPode ter múltiplas linhas."
    }
  }' \
  --output documento-basico.pdf
```

### 🎓 **Prova Escolar**

```bash
curl -X POST http://localhost:4000/pdf \
  -H "x-api-key: SUA_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "exam",
    "title": "Prova de Matemática",
    "data": {
      "exam": {
        "subject": "Matemática",
        "duration": "2 horas",
        "professor": "Prof. João Silva",
        "instructions": {
          "list": [
            "Use caneta azul ou preta",
            "Não é permitido uso de calculadora",
            "Leia todas as questões antes de começar"
          ]
        },
        "questions": [
          {
            "text": "Qual é o resultado de 2 + 2?",
            "type": "multiple_choice",
            "points": 2,
            "options": ["3", "4", "5", "6"]
          },
          {
            "text": "Resolva a equação: x² - 4 = 0",
            "type": "calculation",
            "points": 5
          }
        ]
      }
    }
  }' \
  --output prova-matematica.pdf
```

---

## ⚙️ Configurações de PDF

### 📐 **Opções de Config**

```json
{
  "config": {
    "format": "A4",           // A4, A5, Letter, Legal
    "orientation": "portrait", // portrait, landscape
    "margin": {
      "top": "2cm",
      "right": "1.5cm",
      "bottom": "2cm", 
      "left": "1.5cm"
    }
  }
}
```

---

## 🔑 Gestão de API Keys

### **GET** `/api-keys/current` - Info da sua API key

```bash
curl -H "x-api-key: SUA_KEY" http://localhost:4000/api-keys/current
```

### **GET** `/api-keys/types` - Tipos disponíveis

```bash
curl -H "x-api-key: SUA_KEY" http://localhost:4000/api-keys/types
```

### **POST** `/api-keys` - Criar nova key (apenas admins)

```bash
curl -X POST http://localhost:4000/api-keys \
  -H "x-api-key: ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cliente Premium",
    "type": "premium",
    "description": "Key para cliente VIP"
  }'
```

---

## 📊 Estatísticas

### **GET** `/pdf/stats` - Estatísticas da sua API key

```bash
curl -H "x-api-key: SUA_KEY" http://localhost:4000/pdf/stats
```

---

## 🚨 Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `401` | API key inválida ou não fornecida |
| `429` | Limite de requisições excedido |
| `400` | Dados inválidos na requisição |
| `404` | Template não encontrado |
| `500` | Erro interno do servidor |

### 💡 **Exemplo de Resposta de Erro**

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Limite de requisições excedido",
  "details": {
    "api_key_name": "Demo Key",
    "api_key_type": "basic",
    "requests_per_minute": 10,
    "ttl": 45000
  }
}
```

---

## 🛠️ Scripts Disponíveis

```bash
npm run dev              # Iniciar em desenvolvimento
npm run start           # Iniciar em produção
npm run migrate:latest  # Aplicar migrações
npm run migrate:rollback # Reverter migração
npm run seed:run        # Executar seeds (criar API keys)
```

---

## 📈 Roadmap

- [ ] ✅ Sistema de templates básicos
- [ ] ✅ Autenticação por API Key
- [ ] ✅ Rate limiting por tipo de key
- [ ] ✅ Templates premium com logo e marca d'água
- [ ] 🔄 Dashboard web para gestão
- [ ] 🔄 Webhooks para notificações
- [ ] 🔄 Templates customizados via upload
- [ ] 🔄 Assinatura digital de PDFs
- [ ] 🔄 CLI para uso local

---

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

---

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para mais detalhes.

---

## 🆘 Suporte

- 📧 **Email:** <clevertonruppenthal1@gmail.com>
- 🐛 **Issues:** [GitHub Issues](https://github.com/keverupp/papyrus-api/issues)

---

<p align="center">
  <strong>Feito com ❤️ pela equipe Papyrus</strong><br>
  <em>Transformando dados em documentos profissionais</em>
</p>
