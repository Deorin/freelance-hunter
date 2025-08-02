// submit-proposal.js
const { chromium } = require('playwright');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv)).options({
  url: { type: 'string', demandOption: true },
  text: { type: 'string', demandOption: true },
  bid: { type: 'number', demandOption: true },
  days: { type: 'number', default: 15 }, // Duração padrão de 15 dias
}).argv;

(async () => {
  console.log(`Iniciando submissão para: ${argv.url}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: 'session.json' });
  const page = await context.newPage();

  try {
    await page.goto(argv.url, { waitUntil: 'domcontentloaded' });

    // Clica no botão para abrir o formulário de proposta
    await page.locator('a:has-text("Enviar proposta"), button:has-text("Enviar proposta")').click();

    // Espera o formulário carregar e preenche os campos
    console.log('Preenchendo o formulário da proposta...');
    await page.waitForSelector('#offer_value');
    await page.fill('#offer_value', String(argv.bid));
    await page.fill('#offer_days', String(argv.days));
    await page.fill('#offer_message', argv.text);

    // Clica no botão final para enviar
    await page.locator('button[type="submit"]:has-text("Enviar Proposta")').click();

    // Espera por uma confirmação de sucesso
    await page.waitForURL('**\/proposals**', { timeout: 15000 });

    console.log('SUCESSO: Proposta enviada com sucesso!');
    await browser.close();
    process.exit(0); // Sai com código de sucesso
  } catch (error) {
    console.error('ERRO: Falha ao submeter a proposta.', error);
    await browser.close();
    process.exit(1); // Sai com código de erro
  }
})();