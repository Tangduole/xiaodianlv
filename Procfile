FROM node:18-alpine
WORKDIR /app
COPY package*.json ./backend/
RUN cd backend && npm install --production
COPY backend ./backend
WORKDIR /app/backend
ENV PORT 3000
EXPOSE 3000
CMD ["node", "src/app.js"]
