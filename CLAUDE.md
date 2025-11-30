# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Immigration Queue Manager (IQM) is a Korean-language web application for managing immigration officer assignments at Incheon International Airport Terminal 1. The system calculates required staff based on passenger forecasts using queueing theory (M/M/c model) and displays congestion alerts across different terminal zones.

**Tech Stack**: Vanilla JavaScript (ES6 modules), Python (data fetching/GitHub Actions), HTML/CSS with custom theming

**Primary Language**: Korean (UI labels, comments, variable names often in Korean)

## Development Commands

### Running the Application

**Local Development Server** (required for API features):
```bash
python server.py
```
- Starts HTTP server on port 8080
- Proxies requests to https://www.airport.kr for live airport data
- Serves static files from `src/` directory
- Access at: http://localhost:8080/index.html

**Simple Static Server** (no API access):
```bash
python -m http.server 8080
```
- Use when only testing static features without live data import

### Data Update Scripts

**Manual Data Fetch**:
```bash
python scripts/update_data.py
```
- Fetches current airport passenger data from airport.kr
- Parses HTML table with id="userEx"
- Saves to `src/data/latest_data.json`
- Used by GitHub Actions hourly workflow

**Automated Updates**:
- GitHub Actions workflow runs hourly: `.github/workflows/daily_update.yml`
- Commits updated data with message: "Update airport data [skip ci]"

### Dependencies

**Python** (for server and data fetching):
```bash
pip install requests beautifulsoup4
```

**No build process**: Direct ES6 module imports in browser

## Architecture

### Frontend Architecture (src/js/)

**Entry Point**: `app.js`
- Initializes `EventBus` for component communication
- Manages global state (settings, forecast, requirement, staffList)
- Bootstraps UI components (Dashboard, StaffUI)
- Loads data from localStorage or defaults to sample data

**Module Organization**:
```
src/js/
├── app.js                    # Main entry point, event coordination
├── config.js                 # Settings, constants, storage keys
├── core/
│   ├── calculator.js         # Staff requirement calculations
│   ├── queueModel.js         # M/M/c queueing theory implementation
│   └── alertSystem.js        # Congestion alert level determination
├── data/
│   ├── importer.js           # CSV/API data import logic
│   ├── sampleData.js         # Default fallback data
│   └── storage.js            # localStorage wrapper
├── ui/
│   ├── dashboard.js          # Main dashboard view
│   ├── staff.js              # Staff management UI
│   ├── chart.js              # Chart rendering
│   ├── components.js         # Reusable UI components
│   └── settings.js           # Settings panel
└── utils/
    └── helpers.js            # Utility functions
```

### Data Flow

1. **Data Ingestion** (three sources):
   - Live API: `server.py` → `AirportDataImporter.fetchFromApi()`
   - CSV Upload: File input → `AirportDataImporter.importFromFile()`
   - Sample Data: `SampleForecast` from `sampleData.js`

2. **Calculation Pipeline**:
   ```
   PassengerForecast → calculateAllRequirements() → StaffRequirement
   ```
   - Input: Hourly passenger data per zone (AB, C, D, EF)
   - Processing: M/M/c model calculates required staff per zone/hour
   - Output: Staff requirements + alert levels + summary statistics

3. **UI Rendering**:
   ```
   StaffRequirement → Dashboard.render() → DOM updates
   ```
   - EventBus coordinates updates between components
   - localStorage persists state between sessions

### Core Calculation Logic (calculator.js)

**Key Function**: `calculateRequiredStaff(passengers, options)`
- Formula: `c = ⌈λ / (ρ × μ)⌉`
  - λ (lambda): Arrival rate (passengers/hour)
  - μ (mu): Service rate (weighted avg of Korean/foreign processing speeds)
  - ρ (rho): Target utilization (default 0.85)
  - c: Required staff (ceiling)
- Accounts for auto-gate usage (30% default)
- Weighted by Korean/foreign passenger ratios

**M/M/c Model** (queueModel.js):
- `calculateMMcMetrics(lambda, mu, c)`: Returns queue metrics (Lq, Wq, utilization)
- `findMinimumServers(lambda, mu, targetWq)`: Finds minimum staff for target wait time
- Returns instability warning when ρ ≥ 1

### Zone Structure

**Airport Terminal Zones**:
- **Arrival**: AB, C, D, EF (4 zones)
- **Departure**: AB (zones 1+2), C (zone 3), D (zone 4), EF (zones 5+6)

Data mapping in `server.py` and `update_data.py`:
- Combines departure zones 1+2 into "AB"
- Maps remaining zones to C, D, EF

### Alert System (alertSystem.js)

**Congestion Levels**:
- 🔵 Blue: ≥7000 passengers/hour
- 🟡 Yellow: ≥7600 passengers/hour
- 🟠 Orange: ≥8200 passengers/hour
- 🔴 Red: ≥8600 passengers/hour

**Consecutive Alert Detection**: Escalates alerts if high traffic persists for multiple consecutive hours

### Configuration (config.js)

**Service Rates** (passengers/hour/officer):
```javascript
arrivalKorean: 60    // 1 min/person
arrivalForeign: 40   // 1.5 min/person
departureKorean: 70  // ~51 sec/person
departureForeign: 50 // ~72 sec/person
autoGate: 120        // 30 sec/person
```

**Key Settings**:
- Target wait time: 15 minutes
- Target utilization: 85%
- Auto-gate ratio: 30%
- Foreign passenger ratios: 60% (arrival), 30% (departure)

### Storage Schema

**localStorage Keys** (STORAGE_KEYS):
- `iqm_current_forecast`: Latest passenger forecast
- `iqm_current_requirement`: Calculated staff requirements
- `iqm_settings`: User settings (service rates, ratios, theme)
- `iqm_staff_list`: Staff roster and assignments
- `iqm_forecast_history`: Historical forecasts
- `iqm_app_state`: App UI state

### EventBus Communication

**Events**:
- `settings:changed`: Settings updated → recalculate requirements
- `staff:updated`: Staff roster changed → update UI
- `staff:assign`: Assign staff to booth → update staff status
- `staff:unassign`: Remove staff assignment → set to idle

### Data Fetching (server.py & scripts/)

**Airport Data Source**: https://www.airport.kr/ap_ko/883/subview.do
- HTML table scraping (id="userEx")
- Handles date parameter: `pday=YYYYMMDD`
- Fallback logic if table structure changes
- Error logging to `server_debug.log` and `server_error.log`

**HTML Parsing**:
- Expects 12+ columns per row
- Filters out total rows (합계)
- Converts comma-separated numbers to integers
- Extracts hour ranges (e.g., "00~01") → hourStart: 0

## Important Notes

### Korean Language Context
- UI text, comments, and many variable names are in Korean
- Terminal names: 제1여객터미널 (Terminal 1)
- Zone labels: 입국 (Arrival), 출국 (Departure)
- Understanding Korean context helpful but not required for code modifications

### Data Structure Expectations
When modifying data import logic, ensure output matches:
```javascript
{
  id: "uuid",
  date: "YYYY-MM-DD",
  terminal: "T1",
  lastUpdated: "ISO timestamp",
  source: "api" | "csv" | "manual",
  hourlyData: [
    {
      hour: "00~01",
      hourStart: 0,
      arrival: { AB: 100, C: 150, D: 120, EF: 80, total: 450 },
      departure: { AB: 200, C: 100, D: 90, EF: 110, total: 500 }
    },
    // ... 24 hours
  ]
}
```

### ES6 Module Usage
- All JavaScript uses ES6 imports/exports
- Served with `type="module"` in index.html
- No transpilation or bundling required
- Browser must support ES6 modules

### Queueing Theory Validation
When modifying calculation logic in `calculator.js` or `queueModel.js`:
- Verify ρ (utilization) stays below 1.0 to maintain system stability
- Test edge cases: zero passengers, very high traffic, single server
- Ensure factorial calculations don't overflow (max c < 100)

### GitHub Actions Considerations
- Workflow runs hourly but skips CI on commits (`[skip ci]` in message)
- Requires Python 3.9+ environment
- Dependencies installed fresh each run
- Commits as "GitHub Action" user

### Progressive Web App (PWA)
- Manifest defined in `src/manifest.json`
- Service worker: `src/sw.js` (if implemented)
- Designed for mobile/tablet portrait orientation
- Offline capability may be incomplete

### Testing Approach
Currently no automated test suite. When testing:
1. Verify calculations with known passenger counts
2. Check alert threshold transitions
3. Test data import from all three sources
4. Validate localStorage persistence
5. Test staff assignment workflow

### Performance Considerations
- Calculations run synchronously on main thread
- Large passenger volumes (>100K/day) may cause slowdown
- Consider Web Workers if calculation performance degrades
- Chart rendering may be slow with 24-hour datasets
