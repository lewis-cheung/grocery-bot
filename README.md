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
- change values in `.npmrc`
  - `tag-version-prefix`
- remove these files:
  - `app/testable.js`
  - `app/testable.test.js`
- remove sample command in `app/index.js`
- remove sample migration `migrations/20250125220301-sample-migration.js`
## Installation and Usage
### Github Actions Deployment
1. Configure secrets and variables in GitHub repository settings:
  - `HOST`
  - `SSH_USERNAME`
  - `SSH_PRIVATE_KEY`
  - `DEPLOY_KEY`
  - `APP_PATH`
2. Configure `.github/workflows/ssh-deploy.yaml`
  - change `on.push.tags` to tag pattern that you want to deploy (e.g. `v*`)
  - make sure `jobs.check-secrets.environment` and `jobs.deploy.environment` is the same as the environment your GitHub Actions secrets are set for
3. Create and push a new tag to trigger the deployment

### Manual Deployment
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
