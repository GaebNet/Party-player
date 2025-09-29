# 🚀 Deploy to Render (FREE)

## Step-by-Step Guide

### 1. **Create Render Account**
- Go to [render.com](https://render.com)
- Sign up with GitHub (recommended)

### 2. **Create New Web Service**
- Click **"New +"** → **"Web Service"**
- Connect your GitHub repository: `PATILYASHH/Party-player`

### 3. **Configure Build Settings**
```
Name: watch-party-backend
Runtime: Node
Build Command: npm install
Start Command: npm start
```

### 4. **Add Environment Variables**
```
NODE_ENV = production
```

### 5. **Advanced Settings** (Optional)
```
Health Check Path: /health
```

### 6. **Deploy**
- Click **"Create Web Service"**
- Wait for deployment (5-10 minutes)
- Copy the deployment URL (e.g., `https://watch-party-backend.onrender.com`)

### 7. **Update Netlify**
- Go to Netlify dashboard → Site settings → Environment variables
- Set `NEXT_PUBLIC_SERVER_URL` to your Render URL
- Redeploy the frontend

## ⚠️ **Important Notes**
- **Free tier sleeps after 15 minutes** of inactivity
- **First request after sleep takes ~30 seconds**
- **750 hours/month limit** (resets monthly)
- **No custom domains** on free tier

## 🧪 **Test Your Deployment**
Once deployed, test these URLs:
- Health check: `https://your-app.onrender.com/health`
- Your frontend should now work!

## 🔄 **If You Need to Update**
Just push changes to GitHub - Render auto-deploys!