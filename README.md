# Trading Sync App

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

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. **Install all dependencies**:
   ```bash
   npm run install-all
   ```

2. **Set up environment variables** (required for AI):
   Create a `.env` file in the `backend` directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3001
   ```
   
   You can get your OpenAI API key from: https://platform.openai.com/api-keys

3. **Start the development servers**:
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on `http://localhost:3001`
   - Frontend dev server on `http://localhost:3000`

### Manual Start (Alternative)

If you prefer to run them separately:

**Backend**:
```bash
cd backend
npm install
npm run dev
```

**Frontend**:
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
- [ ] Implement user authentication
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
