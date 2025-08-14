# 🚀 Deployment Guide - Tic-Tac-Toe dApp

## 📋 Prerequisites

- Node.js (v16+)
- npm or yarn
- Git
- MetaMask browser extension
- Sepolia testnet ETH for gas fees

## 🏗️ Build Process

### 1. Build the Application
```bash
npm run build
```

This will:
- Create a `dist` directory
- Minify CSS and JavaScript files
- Copy all necessary files for production
- Remove development dependencies

### 2. Verify Build Output
```bash
ls dist/
# Should show:
# - public/ (minified static files)
# - server.js
# - package.json
# - README.md
```

## 🌐 Deployment Options

### Option 1: Local Production Server
```bash
cd dist
npm install
npm start
```

### Option 2: Heroku Deployment
1. **Install Heroku CLI**
2. **Create Heroku App**
```bash
heroku create your-tic-tac-toe-app
```

3. **Deploy**
```bash
git add .
git commit -m "Deploy Tic-Tac-Toe dApp"
git push heroku main
```

4. **Set Environment Variables**
```bash
heroku config:set NODE_ENV=production
heroku config:set PORT=8081
```

### Option 3: Vercel Deployment
1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Deploy**
```bash
vercel
```

3. **Follow the prompts and deploy**

### Option 4: Railway Deployment
1. **Connect GitHub repository**
2. **Set environment variables**
3. **Deploy automatically**

## 🔧 Environment Configuration

### Required Environment Variables
```env
NODE_ENV=production
PORT=8081
API_BASE=https://your-backend-api.com
API_KEY=your-api-key
```

### Optional Environment Variables
```env
# For custom configurations
CORS_ORIGIN=https://your-frontend-domain.com
SOCKET_CORS_ORIGIN=https://your-frontend-domain.com
```

## 📊 Performance Optimization

### Built-in Optimizations
- ✅ Minified CSS and JavaScript
- ✅ Removed development dependencies
- ✅ Optimized file structure
- ✅ Production-ready server configuration

### Additional Optimizations
- **CDN**: Use CloudFlare or AWS CloudFront for static assets
- **Compression**: Enable gzip compression on your server
- **Caching**: Set appropriate cache headers for static files

## 🔒 Security Considerations

### Production Security
- ✅ Environment variables for sensitive data
- ✅ CORS configuration
- ✅ Input validation
- ✅ Error handling without exposing internals

### Additional Security Measures
- **HTTPS**: Always use HTTPS in production
- **Rate Limiting**: Implement rate limiting for API endpoints
- **Monitoring**: Set up logging and monitoring
- **Backup**: Regular backups of game state and user data

## 🧪 Testing Deployment

### Pre-deployment Checklist
- [ ] All tests pass
- [ ] Build completes successfully
- [ ] Environment variables configured
- [ ] Database/backend API accessible
- [ ] MetaMask integration working
- [ ] Smart contracts deployed and verified

### Post-deployment Testing
1. **Connect Wallet**: Test MetaMask connection
2. **Find Match**: Test matchmaking functionality
3. **Stake Tokens**: Test on-chain staking
4. **Play Game**: Test real-time gameplay
5. **Collect Rewards**: Test reward distribution

## 📈 Monitoring & Maintenance

### Health Checks
```bash
# Check if server is running
curl https://your-app.com/health

# Expected response:
# {"ok": true}
```

### Logs
```bash
# View application logs
heroku logs --tail  # For Heroku
vercel logs         # For Vercel
```

### Performance Monitoring
- Monitor response times
- Track error rates
- Monitor blockchain transaction success rates
- Track user engagement metrics

## 🔄 Updates & Rollbacks

### Updating the Application
1. **Make changes in development**
2. **Test thoroughly**
3. **Build new version**
4. **Deploy to staging**
5. **Test staging environment**
6. **Deploy to production**

### Rollback Process
1. **Identify the issue**
2. **Revert to previous version**
3. **Deploy rollback**
4. **Verify functionality**
5. **Investigate and fix the issue**

## 📞 Support & Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Deployment Failures
- Check environment variables
- Verify port configuration
- Check server logs for errors
- Ensure all dependencies are installed

#### Runtime Issues
- Check browser console for errors
- Verify MetaMask connection
- Check blockchain network configuration
- Monitor server logs

### Getting Help
- Check the README.md for detailed documentation
- Review the API documentation
- Check GitHub issues for known problems
- Contact support team

---

**🎮 Your Tic-Tac-Toe dApp is now ready for production!**
