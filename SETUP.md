# Quick Setup Guide

## Step 1: Install Node.js

You need Node.js 18+ to run this app. Here are the easiest ways to install it on macOS:

### Option A: Using Homebrew (Recommended)
```bash
brew install node
```

### Option B: Download from Official Website
1. Go to https://nodejs.org/
2. Download the LTS version (recommended)
3. Run the installer

### Option C: Using nvm (Node Version Manager)
```bash
# Install nvm first
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Then install Node.js
nvm install 18
nvm use 18
```

## Step 2: Verify Installation

After installing Node.js, verify it works:
```bash
node --version
npm --version
```

You should see version numbers for both.

## Step 3: Install Dependencies

Once Node.js is installed, run:
```bash
cd /Users/tsvetantsvetkov/Documents/TsvetanGit/TradingSyncApp
npm run install-all
```

This will install all dependencies for both backend and frontend.

## Step 4: Start the App

Start both servers:
```bash
npm run dev
```

This will start:
- **Backend** on `http://localhost:3001`
- **Frontend** on `http://localhost:3000`

## Step 5: Test the App

1. Open your browser and go to: **http://localhost:3000**
2. You should see the Trading Sync dashboard
3. Click "Upload Screenshot" button
4. Select a platform (Bondora, Moneyfit, etc.)
5. Upload a screenshot of your account
6. The AI will analyze it and extract your portfolio data!

## Troubleshooting

### If you get "port already in use" error:
- Change the PORT in `backend/.env` to a different number (e.g., 3002)
- Or kill the process using the port: `lsof -ti:3001 | xargs kill`

### If OpenAI API errors occur:
- Check that your API key is correct in `backend/.env`
- Make sure you have credits in your OpenAI account
- The API key should start with `sk-`

### If dependencies fail to install:
- Make sure you have internet connection
- Try deleting `node_modules` folders and running `npm run install-all` again

## Need Help?

The app is ready to go once Node.js is installed! The `.env` file with your OpenAI API key is already set up.
