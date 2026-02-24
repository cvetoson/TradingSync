# Trading Sync App

**Stable version: v3.6.0** – See [STABLE.md](STABLE.md) for release notes and production-ready baseline.

A portfolio aggregation application that syncs data from multiple trading platforms (Bondora, Moneyfit, Trading 212, IBKR, Iuvo, Revolut, etc.) by analyzing screenshots using AI.

## Features

- 📊 **Unified Dashboard**: View all your investments in one place with a beautiful pie chart
- 🤖 **AI-Powered Extraction**: Upload screenshots and let AI extract your portfolio data automatically
- 💰 **Real-time Calculations**: 
  - P2P accounts: Calculates interest based on fixed rates
  - Stocks/Crypto: Uses current market prices for accurate valuations
- 🔄 **Multi-Platform Support**: Works with Bondora, Moneyfit, Trading 212, IBKR, Iuvo, Revolut, Ledger, and more
- 📱 **Modern UI**: Clean, responsive interface built with React and Tailwind CSS

## How It Works

1. **Upload Screenshots**: Take screenshots of your account balances from any platform
2. **AI Analysis**: The app uses OpenAI Vision API (GPT-4) to extract:
   - Current balance
   - Interest rates (for P2P)
   - Holdings (for stocks/crypto)
   - Account information
3. **Automatic Updates**: The dashboard refreshes daily showing your current portfolio value
4. **Smart Calculations**: 
   - P2P: Uses interest rates to calculate future values
   - Stocks: Fetches current market prices for accurate valuations

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + Recharts
- **Backend**: Node.js + Express
- **Database**: SQLite (easily upgradeable to PostgreSQL)
- **AI**: OpenAI Vision API (GPT-4) for screenshot analysis

## Setup Instructions (New Computer)

### 1. Clone the repo

```bash
git clone https://github.com/cvetoson/TradingSync.git
cd TradingSync
```

### 2. Install dependencies

```bash
npm run install-all
```

### 3. Create backend `.env`

Copy the example and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with at least:

```
PORT=3001
APP_URL=http://localhost:3000
JWT_SECRET=your-secret-key-change-in-production
OPENAI_API_KEY=your_openai_api_key_here
```

For email (verification, password reset), add SMTP settings. Without them, reset/verify links appear on screen in dev.

### 4. Start the app

```bash
npm run dev
```

This starts:
- **Backend** on `http://localhost:3001`
- **Frontend** on `http://localhost:3000`

### 5. First run: create default user (optional)

The database (`backend/trading_sync.db`) is **not in git**—it’s created on first run. To add a default user:

```bash
cd backend
node scripts/seedDefaultUser.js
```

Default credentials: `default@tradingsync.local` / `changeme123` (or set `DEFAULT_USER_EMAIL` and `DEFAULT_USER_PASSWORD` in `.env`).

### 6. Open the app

Go to `http://localhost:3000` and sign in or register.

**Using an existing database:** Copy `backend/trading_sync.db` from another machine into `backend/` before starting. Then run the seed script only if you need to assign accounts to the default user.

---

### Manual start (alternative)

**Backend**:
```bash
cd backend
npm install
npm run dev
```

**Frontend** (in another terminal):
```bash
cd frontend
npm install
npm run dev
```

## Usage

1. Open `http://localhost:3000` in your browser
2. Click "Upload Screenshot" button
3. Select the platform (Bondora, Moneyfit, etc.)
4. Upload a screenshot of your account
5. The AI will extract the data and update your dashboard
6. View your unified portfolio with the pie chart visualization

## Project Structure

```
TradingSyncApp/
├── backend/
│   ├── routes/          # API routes
│   ├── services/        # Business logic (AI, calculations)
│   ├── uploads/         # Uploaded screenshots (gitignored)
│   ├── trading_sync.db  # SQLite database (gitignored)
│   └── server.js        # Express server
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API client
│   │   └── App.jsx      # Main app component
│   └── package.json
└── package.json         # Root package.json
```

## Next Steps / TODO

- [x] Integrate OpenAI Vision API for screenshot analysis
- [ ] Add market data API integration (Alpha Vantage, CoinGecko) for stock/crypto prices
- [x] Implement user authentication
- [ ] Add data export functionality
- [ ] Create mobile app version
- [ ] Add notifications for portfolio changes
- [ ] Implement historical tracking and charts

## Notes

- Currently uses mock data for AI extraction (Azure integration pending)
- Stock/crypto prices use placeholder logic (market API integration pending)
- The app encourages users to upload new screenshots when changes occur
- AI handles UI changes automatically once Azure is integrated

## License

MIT
