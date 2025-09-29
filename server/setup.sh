#!/bin/bash

# 🚀 Automated Digital Ocean Droplet Setup
# Run this script on your fresh Ubuntu droplet

echo "🚀 Setting up Watch Party Server on Digital Ocean..."

# Update system
echo "📦 Updating system..."
apt update && apt upgrade -y

# Install Node.js 18
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Git
echo "📦 Installing Git..."
apt install git -y

# Verify installations
echo "✅ Node.js version: $(node --version)"
echo "✅ NPM version: $(npm --version)"

# Clone repository
echo "📥 Cloning repository..."
git clone https://github.com/PATILYASHH/Party-player.git
cd Party-player/server

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install PM2
echo "📦 Installing PM2..."
npm install -g pm2

# Start the server
echo "🚀 Starting server..."
pm2 start index.js --name watch-party
pm2 save
pm2 startup

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow ssh
ufw allow 3001
ufw --force enable

# Get server info
SERVER_IP=$(curl -s ifconfig.me)
echo ""
echo "🎉 Setup Complete!"
echo "🌐 Server URL: http://$SERVER_IP:3001"
echo "💚 Health Check: http://$SERVER_IP:3001/health"
echo ""
echo "📝 Next steps:"
echo "1. Update Netlify environment variable:"
echo "   NEXT_PUBLIC_SERVER_URL=http://$SERVER_IP:3001"
echo "2. Redeploy your Netlify site"
echo ""
echo "🔧 Useful commands:"
echo "pm2 status          # Check server status"
echo "pm2 logs watch-party # View logs"
echo "pm2 restart watch-party # Restart server"