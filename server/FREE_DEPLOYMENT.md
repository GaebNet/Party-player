# Free Backend Deployment Options

## 🥇 **Render (Recommended - Most Reliable)**

**Free Tier:** 750 hours/month, sleeps after 15min inactivity

### Deploy Steps:
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Configure:
   - **Name:** watch-party-backend
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Production
6. Add environment variable: `NODE_ENV=production`
7. Click "Create Web Service"

**Pros:** Reliable, good for WebSockets, easy setup
**Cons:** Sleeps after inactivity (first request takes ~30 seconds)

---

## 🥈 **Railway (Free Trial)**

**Free Tier:** $5 credit for new users

### Quick Deploy:
```bash
npm install -g @railway/cli
railway login
cd server
railway init
railway up
railway domain
```

---

## 🥉 **Fly.io**

**Free Tier:** Limited but works

### Deploy Steps:
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. `fly launch` in server directory
3. Follow prompts

---

## 🎯 **Glitch**

**Free Tier:** Unlimited, but slower

### Deploy Steps:
1. Go to [glitch.com](https://glitch.com)
2. Click "New Project" → "Import from GitHub"
3. Connect your repo
4. Glitch auto-deploys on git push

---

## 📱 **Replit**

**Free Tier:** With deployment

### Deploy Steps:
1. Go to [replit.com](https://replit.com)
2. Import from GitHub
3. Click "Deploy" button
4. Choose "Autoscale" for free tier