# Railway Deployment Guide

## Quick Deploy to Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Navigate to server directory:**
   ```bash
   cd server
   ```

4. **Initialize Railway project:**
   ```bash
   railway init
   ```
   - Choose "Empty Project"
   - Name it "watch-party-backend"

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Get the deployment URL:**
   ```bash
   railway domain
   ```
   This will give you something like: `https://watch-party-backend.up.railway.app`

7. **Update Netlify Environment Variable:**
   - Go to your Netlify site dashboard
   - Site Settings → Environment Variables
   - Set `NEXT_PUBLIC_SERVER_URL` to your Railway URL
   - Trigger a new deployment

## Alternative: Deploy to Render

1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect your GitHub repo
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variable: `NODE_ENV=production`
7. Deploy

## Alternative: Deploy to Heroku

1. Install Heroku CLI
2. `heroku create your-app-name`
3. `git push heroku main`
4. Get the URL from Heroku dashboard
5. Update Netlify environment variable