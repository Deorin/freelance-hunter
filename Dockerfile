ARG CACHE_BUSTER=1
# Começa com a imagem oficial do n8n
FROM n8nio/n8n

# Define o diretório de trabalho para /home/node, o padrão do n8n.
WORKDIR /home/node

# Copia os arquivos do nosso robô para dentro do diretório de trabalho
COPY . .

# Instala as dependências do nosso robô
RUN npm install --unsafe-perm

# O Playwright precisa que os navegadores sejam baixados
RUN npx playwright install --with-deps
