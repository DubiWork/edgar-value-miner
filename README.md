<div align="center">

# 💎 EDGAR Value Miner

### *Find gems in the market*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**A beautiful, intuitive value investing research tool powered by SEC EDGAR data**

[Live Demo](#) · [Features](#features) · [Getting Started](#getting-started) · [Roadmap](#roadmap)

---

<img src="https://via.placeholder.com/800x400/1a1a2e/eaeaea?text=EDGAR+Value+Miner+Dashboard" alt="Dashboard Preview" width="800"/>

</div>

## Why EDGAR Value Miner?

Traditional financial research tools are either:
- 💸 **Expensive** - Bloomberg, FactSet, etc. cost thousands per year
- 🤯 **Overwhelming** - Too many features, steep learning curve
- 📊 **Ugly** - Cluttered interfaces designed for traders, not investors

**EDGAR Value Miner** is different:

✨ **Beautiful** - Clean, modern UI that's a joy to use  
🎯 **Focused** - Built for value investors, not day traders  
🆓 **Free data** - Powered by official SEC EDGAR filings  
📱 **Responsive** - Works beautifully on desktop and mobile  

---

## Features

### 📈 Visual Financial Analysis
Beautiful charts showing 5+ years of company fundamentals:
- Revenue & growth trends
- Free Cash Flow analysis  
- Profit margins (Gross, Operating, Net)
- Key financial ratios

### 💰 Smart Valuations
Multiple valuation methods to find your margin of safety:
- P/E Fair Value (simple)
- DCF Analysis (comprehensive)
- Forward P/E projections
- Scenario modeling

### 📋 Professional Scoring Systems
Rate companies using proven methodologies:
- **Feroldi Quality Score** - Comprehensive quality rating
- **Anti-Fragile Score** - Resilience & survival analysis
- **Custom Checklists** - Your own investment criteria

### 📊 Watchlist & Tracking
- Track your favorite companies
- Quarterly snapshot history
- Price target alerts
- Portfolio integration

---

## Screenshots

<div align="center">
<table>
<tr>
<td align="center"><b>Company Dashboard</b></td>
<td align="center"><b>Financial Charts</b></td>
</tr>
<tr>
<td><img src="https://via.placeholder.com/400x250/16213e/eaeaea?text=Dashboard" width="400"/></td>
<td><img src="https://via.placeholder.com/400x250/16213e/eaeaea?text=Charts" width="400"/></td>
</tr>
<tr>
<td align="center"><b>Valuation Analysis</b></td>
<td align="center"><b>Watchlist</b></td>
</tr>
<tr>
<td><img src="https://via.placeholder.com/400x250/16213e/eaeaea?text=Valuation" width="400"/></td>
<td><img src="https://via.placeholder.com/400x250/16213e/eaeaea?text=Watchlist" width="400"/></td>
</tr>
</table>
</div>

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, TailwindCSS |
| **Charts** | Recharts / Chart.js |
| **Backend** | Firebase (Auth, Firestore, Functions) |
| **Data Source** | SEC EDGAR API |
| **Deployment** | Vercel / Firebase Hosting |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/DubiWork/edgar-value-miner.git

# Navigate to project
cd edgar-value-miner

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the app.

---

## Roadmap

### Phase 1 - Foundation ⏳
- [x] Project setup
- [ ] SEC EDGAR API integration
- [ ] Company dashboard with charts
- [ ] P/E fair value calculation
- [ ] Local watchlist (3 companies)
- [ ] Dark/Light theme

### Phase 2 - Scoring Systems
- [ ] Feroldi Quality Score
- [ ] Anti-Fragile Score
- [ ] Custom checklist builder
- [ ] Master Score ranking

### Phase 3 - Advanced Valuations
- [ ] DCF Calculator
- [ ] Forward P/E projection
- [ ] Scenario analysis
- [ ] Price target setting

### Phase 4 - Premium Features
- [ ] User authentication
- [ ] Unlimited watchlist
- [ ] AI-powered research
- [ ] Export to Excel/PDF
- [ ] Portfolio tracking

---

## Data Source

All financial data comes from the **SEC EDGAR** database - the official source for U.S. public company filings.

- ✅ Free and publicly available
- ✅ Official regulatory data
- ✅ Updated with each filing
- ✅ 5+ years of history

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [SEC EDGAR](https://www.sec.gov/edgar) for providing free access to financial data
- [Brian Feroldi](https://twitter.com/BrianFeroldi) for the Quality Score methodology
- The value investing community for inspiration

---

<div align="center">

**Built with ❤️ for value investors**

[⬆ Back to top](#-edgar-value-miner)

</div>
