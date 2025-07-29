// save-session.js
const { chromium } = require('playwright');
const fs = require('fs');

const sessionFile = 'session.json';

(async () => {
  // Lançamos o navegador em modo "não-headless" para que possamos vê-lo e interagir
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navegando para a página de login do 99Freelas...');
  await page.goto('https://www.99freelas.com.br/login');

  console.log('------------------------------------------------------------------');
  console.log('>>> AÇÃO NECESSÁRIA: Por favor, faça o login na janela do navegador que abriu.');
  console.log('O script continuará automaticamente assim que o login for bem-sucedido.');
  console.log('------------------------------------------------------------------');

  // O script vai pausar aqui e esperar até que a URL mude para a página de projetos,
  // o que indica que o login foi feito com sucesso.
  await page.waitForURL('https://www.99freelas.com.br/projects', { timeout: 300000 }); // Timeout de 5 minutos

  console.log('Login detectado com sucesso!');

  // Salvando o estado da sessão (cookies, etc.) no arquivo session.json
  const session = await context.storageState();
  fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));

  console.log(`Sessão salva com sucesso no arquivo: ${sessionFile}`);

  await browser.close();
})();