# LeonBos 后端

这是 LeonBos 的后端运行目录。

默认启动：`node 后端/server.js`

可选环境变量：

- `LEONBOS_DB_PATH`：数据库文件路径
- `LEONBOS_DATA_DIR`：后端默认数据目录

在 Linux / Debian 下，若未设置上述变量，后端会默认使用：

`~/.local/share/leonbos/database/leonbos.db`

## Debian 运行

1. 安装 Node.js 18+

```bash
node -v
```

2. 安装依赖

```bash
npm install
```

3. 启动后端

```bash
npm run backend
```

或者直接在 `后端/` 目录启动：

```bash
cd 后端
npm start
```

4. 如果要做成 systemd 服务，使用 `leonbos.service` 模板，把项目目录改成你的实际路径，例如：

```bash
sudo cp 后端/leonbos.service /etc/systemd/system/leonbos.service
sudo systemctl daemon-reload
sudo systemctl enable --now leonbos
sudo systemctl status leonbos
```

5. 如果你想把数据目录固定在 Debian 服务器上，可以设置：

```bash
export LEONBOS_DATA_DIR=/var/lib/leonbos
```

6. 如果你想直接用脚本启动：

```bash
chmod +x 后端/start.sh
./后端/start.sh
```
