# TradingSyncApp - Version 1.0 (Stable)

## Overview
A portfolio aggregation application that allows users to upload screenshots from various trading platforms and automatically extract financial data using AI (OpenAI Vision API).

## Features

### Core Functionality
- **Screenshot Upload**: Upload screenshots from trading platforms (Bondora, Monefit, Trading 212, IBKR, Iuvo, Revolut, Ledger, etc.)
- **AI-Powered Data Extraction**: Uses OpenAI GPT-4 Vision API to extract:
  - Account balances
  - Interest rates
  - Account names
  - Multiple accounts/vaults from a single screenshot
- **Portfolio Dashboard**: 
  - Total portfolio value
  - Pie chart visualization
  - Account list with current values
- **Account Management**:
  - Editable account names
  - Editable account types (P2P Lending, ETF & Stocks, Cryptocurrency, Savings & Deposits, Fixed Income & Bonds, Alternative Investments)
  - Editable platform/app names
  - Auto-detection of platform names from screenshots
- **Account Detail View**:
  - Current value, interest rate, and category display
  - Value history table with daily changes
  - Line chart showing value over time
  - 3-month projection for P2P accounts
  - Compound interest calculations

### Investment Categories
- P2P Lending
- ETF & Stocks
- Cryptocurrency
- Savings & Deposits
- Fixed Income & Bonds
- Alternative Investments
- Auto Detect option

### Technical Features
- **Compound Interest Calculations**: All P2P accounts use compound interest formula: `FV = PV * (1 + r)^(t/365)`
- **History Tracking**: Daily snapshots of account balances stored in database
- **Backward Calculations**: Automatically calculates yesterday's value from today's value using reverse compound interest
- **Real-time Updates**: Portfolio values update based on interest rates and time elapsed

## Technology Stack

### Backend
- Node.js with Express
- SQLite database
- OpenAI Vision API (GPT-4)
- Multer for file uploads
- CORS enabled

### Frontend
- React with Vite
- Tailwind CSS for styling
- Recharts for data visualization
- Axios for API calls

## Database Schema

### Tables
- `accounts`: Stores account information (platform, name, type, balance, interest rate, etc.)
- `holdings`: Stores individual holdings for stocks/crypto accounts
- `transactions`: Tracks account transactions
- `screenshots`: Stores uploaded screenshot metadata
- `account_history`: Daily snapshots of account balances and interest rates

## API Endpoints

- `POST /api/upload` - Upload screenshot and extract data
- `GET /api/portfolio/summary` - Get portfolio summary with pie chart data
- `GET /api/accounts` - Get all accounts
- `GET /api/accounts/:id/history` - Get account history
- `PUT /api/accounts/:id/name` - Update account name
- `PUT /api/accounts/:id/type` - Update account type
- `PUT /api/accounts/:id/platform` - Update platform name
- `GET /api/health` - Health check

## Setup

1. Install dependencies:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. Create `.env` file in backend directory:
   ```
   OPENAI_API_KEY=your_api_key_here
   PORT=3001
   ```

3. Start backend:
   ```bash
   cd backend
   node server.js
   ```

4. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## Current Status

- ✅ Screenshot upload and AI extraction working
- ✅ Multiple accounts from single screenshot supported
- ✅ Portfolio dashboard with pie chart
- ✅ Account detail view with history and projections
- ✅ Compound interest calculations
- ✅ Account editing (name, type, platform)
- ✅ History tracking and daily value calculations
- ✅ Backward calculation for yesterday's values

## Known Limitations

- Market data for stocks/crypto not yet integrated (uses stored prices)
- No user authentication (single-user application)
- No data export functionality
- Projections only work for P2P accounts with fixed interest rates

## Next Steps (Future Enhancements)

- Market data API integration for stocks/crypto
- User authentication and multi-user support
- Data export (CSV, PDF)
- Email notifications for portfolio changes
- Mobile app version
- More sophisticated projection algorithms

---
**Version**: 1.0.0  
**Date**: January 18, 2026  
**Status**: Stable
