# Começa com a imagem oficial do n8n
FROM n8nio/n8n

# Vai para o diretório de dados do n8n
WORKDIR /data

# Copia os arquivos do nosso robô para dentro do container do n8n
# O ponto '.' significa "copiar tudo da pasta atual (do nosso projeto)"
COPY . .

# Instala as dependências do nosso robô (playwright, pg, etc.)
# O --unsafe-perm é necessário para rodar como root dentro do container
RUN npm install --unsafe-perm

# O Playwright precisa que os navegadores sejam baixados
RUN npx playwright install --with-deps
