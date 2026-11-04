FROM node:22-slim

ENV PORT=3000

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
