# LeonBos Backend

标准后端目录。

- 服务入口：`backend/server.js`
- Debian 启动脚本：`backend/start.sh`
- systemd 模板：`backend/leonbos.service`
- 环境变量样板：`backend/.env.example`

当前服务逻辑仍复用 `src/ui/server.js`，但运行入口已标准化到 `backend/`。
