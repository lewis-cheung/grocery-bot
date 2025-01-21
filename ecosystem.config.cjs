module.exports = {
  apps : [
    {
      name: 'grocery-bot',
      script: 'npm run start',
      max_memory_restart: '512M',
    },
    {
      name: 'grocery-bot-dev',
      script: 'npm run start',
      max_memory_restart: '512M',
      watch: ['app/**/*.js', 'config.yaml'],
    }
  ],
}