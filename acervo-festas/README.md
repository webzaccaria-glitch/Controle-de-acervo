# ✦ Acervo de Festas

Sistema de controle de estoque e locação de materiais para festas.

## Funcionalidades

- 📦 **Acervo** — cadastro de itens com material, quantidade, preço e status de pintura
- 🛒 **Carrinho** — montagem de pedidos com cálculo automático de total
- 💳 **Financeiro** — controle de valor pago e débito em aberto
- 🖨 **Checklist** — geração de documento imprimível / PDF com cláusula de responsabilidade
- ✏️ **Ajustar Pedido** — edição de locações já registradas antes de imprimir
- 💾 **Salvamento automático** — dados persistem no navegador via localStorage

---

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev
```

Acesse: http://localhost:5173

---

## Deploy no GitHub + Vercel

### 1. Subir no GitHub

```bash
# Na pasta do projeto:
git init
git add .
git commit -m "primeiro commit — acervo de festas"

# Crie um repositório em https://github.com/new
# Depois conecte e suba:
git remote add origin https://github.com/SEU_USUARIO/acervo-festas.git
git branch -M main
git push -u origin main
```

### 2. Deploy no Vercel

1. Acesse **https://vercel.com** e faça login com sua conta GitHub
2. Clique em **"Add New Project"**
3. Importe o repositório `acervo-festas`
4. Configurações de build (já detectadas automaticamente):
   - **Framework:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Clique em **"Deploy"**
6. Pronto — seu app estará em `https://acervo-festas.vercel.app`

A cada `git push`, o Vercel faz o deploy automático.

---

## Deploy no Netlify

1. Acesse **https://netlify.com** e faça login com GitHub
2. Clique em **"Add new site → Import an existing project"**
3. Escolha o repositório `acervo-festas`
4. Configurações (já detectadas via `netlify.toml`):
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
5. Clique em **"Deploy site"**
6. Pronto — seu app estará em `https://acervo-festas.netlify.app`

---

## Sobre o salvamento de dados

Os dados são salvos no **localStorage** do navegador — ou seja:

- ✅ Persistem entre sessões (fechar e abrir o navegador)
- ✅ Funcionam sem internet
- ⚠️ Ficam apenas naquele navegador/dispositivo
- ⚠️ Limpar cache do navegador apaga os dados

> **Dica:** Para sincronizar dados entre dispositivos no futuro, é possível integrar um banco de dados como o [Supabase](https://supabase.com) (gratuito).

---

## Estrutura do projeto

```
acervo-festas/
├── src/
│   ├── App.jsx        ← componente principal
│   ├── storage.js     ← funções de salvar/carregar (localStorage)
│   └── main.jsx       ← entry point React
├── index.html
├── package.json
├── vite.config.js
├── vercel.json        ← configuração Vercel (SPA routing)
├── netlify.toml       ← configuração Netlify (SPA routing)
└── .gitignore
```
