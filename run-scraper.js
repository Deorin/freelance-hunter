require('dotenv').config();

// run-scraper.js (Versão 5 - Adaptado para Groq)
const { chromium } = require('playwright');
const { Pool } = require('pg');
const fs = require('fs');
const OpenAI = require('openai'); // A biblioteca continua a mesma, pois a API é compatível

// --- CONFIGURAÇÕES ---
const DATABASE_URL = process.env.DATABASE_URL;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TARGET_URL = 'https://www.99freelas.com.br/projects?order=mais-recentes&categoria=web-mobile-e-software';
const SESSION_FILE = 'session.json';
// --------------------

// Inicializa o cliente para se conectar com a API do Groq
const groq = new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1' // Aponta para o servidor do Groq
});

async function analyzeJobWithAI(job) {
  console.log(`  -> Analisando vaga com IA (Groq/Llama3): "${job.title}"`);

  // A "persona" que a IA deve usar para julgar os projetos.
  const myPersona = `
    Eu sou um desenvolvedor "Generalista Assistido por IA". Minha força não está em anos de especialização profunda em uma única tecnologia, mas na minha habilidade de entender sistemas, conectar diferentes ferramentas e resolver problemas de forma criativa. Eu utilizo IAs como o Gemini ou GPT-4 para gerar a maior parte do código e das instruções técnicas, e meu papel é guiar a IA, executar o código, depurar e garantir que as peças se conectem corretamente para entregar o projeto.

    Projetos ideais para mim são aqueles com escopo claro, como automações, integrações de APIs, landing pages, scripts e protótipos/MVPs. Eu me destaco em projetos que usam tecnologias modernas e populares (JavaScript, Node.js, React, Python, APIs REST, etc.), onde a IA pode me dar o máximo de suporte.

    Devo evitar projetos com escopo muito aberto, complexidade algorítmica profunda, manutenção em sistemas legados com tecnologias obscuras, ou que exijam otimização de performance em baixo nível, pois são áreas que demandam um especialista dedicado e não se beneficiam tanto do meu método de trabalho assistido por IA.
  `;

  const prompt = `
    Você é um assistente especialista em analisar projetos de freela para um desenvolvedor com um perfil específico.
    O Perfil dele é: ${myPersona}

    Agora, analise o seguinte projeto:
    - Título: ${job.title}
    - Descrição Completa: ${job.full_description}
    - Habilidades Desejadas no Anúncio: ${job.tags.join(', ')}

    Com base no perfil, avalie o projeto e responda APENAS com um objeto JSON válido, com a seguinte estrutura:
    {
      "is_fit": boolean, // true se o projeto for um bom fit para o perfil, senão false.
      "reason": "string", // Explicação curta do porquê é um bom fit ou não, considerando o método de trabalho do desenvolvedor.
      "complexity": "string", // Classifique a complexidade aparente em "Baixa", "Média", ou "Alta".
      "ai_friendliness": number, // De 0.0 a 1.0, o quão adequado este projeto é para uma abordagem de desenvolvimento fortemente assistida por IA. 1.0 é perfeito para IA.
      "suggested_bid": number // Um valor inicial sugerido em BRL para a proposta. Se não for possível estimar, retorne 0.
    }
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192", // Usando um modelo maior para uma análise mais sutil
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error(`    -> Erro ao analisar com a IA: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('Iniciando o robô scraper V5 com Groq...');
  if (!fs.existsSync(SESSION_FILE)) { 
    console.error(`Erro: Arquivo de sessão '${SESSION_FILE}' não encontrado.`);
    return;
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const dbClient = await pool.connect();
  console.log('Conectado ao banco de dados!');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  
  await page.waitForSelector('li.result-item', { timeout: 60000 });
  const jobSummaries = await page.locator('li.result-item').evaluateAll((cards) =>
    cards.map((card) => {
      const titleElement = card.querySelector('h1.title a');
      const descriptionElement = card.querySelector('div.item-text.description');
      const tagsElements = card.querySelectorAll('p.habilidades a.habilidade');
      return {
        title: titleElement ? titleElement.innerText.trim() : null,
        url: titleElement ? titleElement.href : null,
        description: descriptionElement ? descriptionElement.innerText.trim() : null,
        tags: Array.from(tagsElements).map(tag => tag.innerText.trim()),
        published_text: card.querySelector('.text-muted span')?.innerText.trim(),
      };
    })
  );

  console.log(`Encontrados ${jobSummaries.length} jobs na página.`);

  let newJobsCount = 0;
  for (const summary of jobSummaries) {
    if (!summary.url) continue;

    const res = await dbClient.query('SELECT * FROM jobs WHERE url = $1', [summary.url]);
    if (res.rowCount === 0) {
      newJobsCount++;
      console.log(`\n---\nVaga nova encontrada: "${summary.title}"`);
      
      const jobPage = await context.newPage();
      await jobPage.goto(summary.url, { waitUntil: 'domcontentloaded' });
      // Seletor corrigido para a página de detalhes
      const fullDescription = await jobPage.locator('div.project-description, .formatted-text.data-content').first().innerText();
      await jobPage.close();

      const jobData = { ...summary, full_description: fullDescription };

      const aiAnalysis = await analyzeJobWithAI(jobData);
      
      console.log(`  -> Salvando no banco de dados...`);
      await dbClient.query(
  `INSERT INTO jobs (title, url, description, tags, published_text, status, ai_is_fit, ai_reason, ai_confidence_score, ai_suggested_bid, complexity, ai_friendliness, created_at)
   VALUES ($1, $2, $3, $4, $5, 'ANALYZED', $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
  [jobData.title, jobData.url, jobData.full_description, jobData.tags, jobData.published_text, aiAnalysis?.is_fit, aiAnalysis?.reason, aiAnalysis?.confidence_score, aiAnalysis?.suggested_bid, aiAnalysis?.complexity, aiAnalysis?.ai_friendliness]
);
    }
  }

  console.log(`\n---\nProcessamento concluído. ${newJobsCount} novas vagas foram analisadas e salvas.`);

  await browser.close();
  await dbClient.release();
  await pool.end();
}

main().catch(console.error);