FROM node:18-slim

RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    python3 -m pip install yt-dlp && \
    apt-get clean

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "nonspot.js"]
