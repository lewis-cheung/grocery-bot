# Telegram Commander Starter
A framework for building Telegram bots with Telegram Commander (https://github.com/lewislun/telegram-commander).
## Requirements
- Node.js v20.11.1+
- MongoDB v8.0.3+
## To use this starter code, do the followings:
- change values in `package.json`
  - `name`
- change values in `ecosystem.config.cjs`
  - `name`
  - `max_memory_restart`
- remove these files:
  - `app/testable.js`
  - `app/testable.test.js`
- remove sample command in `app/index.js`
## Installation and Usage
1. Install dependencies
```bash
npm install
```
2. Create `config.yaml` from `config.template.yaml` and fill in the values
```bash
cp config.template.yaml config.yaml
```
3. Run the app
```bash
npm run pm2:start  # for production
npm run pm2:dev  # for development
```
4. Run tests
```bash
npm run test
```
