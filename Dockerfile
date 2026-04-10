FROM node:18-slim

# Установка Python, pip и yt-dlp
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    python3 -m pip install --upgrade pip && \
    python3 -m pip install yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем остальные файлы
COPY . .

# Создаем health check сервер и запускаем бота
EXPOSE 3000

CMD ["node", "nonspot.js"]
