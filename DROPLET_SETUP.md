# 🚀 Digital Ocean Droplet Setup (FREE with $200 credit!)

## Step-by-Step Deployment Guide

### **Step 1: Create Digital Ocean Account**
- Go to [digitalocean.com](https://digitalocean.com)
- Sign up and claim your $200 credit
- Verify your account

### **Step 2: Create a Droplet**
1. Click **"Create"** → **"Droplets"**
2. Choose:
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic ($6/month) - covered by your credit!
   - **Region:** Choose closest to your users (e.g., NYC1, LON1)
   - **Authentication:** SSH Key (recommended) or password

### **Step 3: SSH Key Setup (Recommended)**
```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Paste it in Digital Ocean when creating droplet
```

### **Step 4: Connect to Your Droplet**
```bash
# Connect using the IP from Digital Ocean
ssh root@YOUR_DROPLET_IP
```

### **Step 5: Server Setup**
```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install Git
apt install git -y
```

### **Step 6: Deploy Your App**
```bash
# Clone your repository
git clone https://github.com/PATILYASHH/Party-player.git
cd Party-player/server

# Install dependencies
npm install

# Install PM2 for process management
npm install -g pm2

# Start the server
pm2 start index.js --name watch-party

# Save PM2 configuration
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs watch-party
```

### **Step 7: Configure Firewall**
```bash
# Allow SSH (already allowed)
ufw allow ssh

# Allow your app port
ufw allow 3001

# Enable firewall
ufw enable
```

### **Step 8: Get Your Server URL**
```bash
# Get your public IP
curl ifconfig.me
```
Your server URL will be: `http://YOUR_IP:3001`

### **Step 9: Update Netlify**
1. Go to your Netlify site dashboard
2. **Site Settings** → **Environment Variables**
3. Set `NEXT_PUBLIC_SERVER_URL` to `http://YOUR_IP:3001`
4. **Trigger deploy**

### **Step 10: Test**
- Health check: `http://YOUR_IP:3001/health`
- Your frontend should now create rooms!

## 🔧 **Useful Commands**

```bash
# Restart app
pm2 restart watch-party

# View logs
pm2 logs watch-party

# Update app
cd Party-player/server
git pull origin main
npm install
pm2 restart watch-party

# Monitor resources
htop
df -h
```

## 💡 **Pro Tips**
- Your $200 credit covers ~33 months of the $6 droplet!
- Set up monitoring: `npm install -g pm2-logrotate`
- Backup important data regularly
- Consider adding SSL later with Let's Encrypt

## 🎯 **You're All Set!**
With your $200 credit, you have FREE hosting for over 2 years! 🚀