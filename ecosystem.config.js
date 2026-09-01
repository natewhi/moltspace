// pm2 process definition for the VPS.
//   pm2 start ecosystem.config.js      # first run
//   pm2 reload ecosystem.config.js     # after a deploy (near-zero downtime)
//
// Environment comes from the `.env` file in this directory, loaded at startup by
// `import "dotenv/config"` in src/index.ts — keep `.env` next to this file.
module.exports = {
  apps: [
    {
      name: "moltspace",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      kill_timeout: 5000,
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
