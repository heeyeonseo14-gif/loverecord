# LOVE RECORD Firebase 后台接入说明（阶段 1）

## 当前阶段包含
- Web Push / FCM Service Worker 接收器
- 浏览器端通知权限、FCM token 注册
- Firebase Anonymous Auth（为每个安装设备建立隔离 UID）
- Callable Function 安全登记设备 token、保存后台偏好
- Firestore 用户数据隔离规则
- 每 15 分钟运行的混合活动调度器基础框架

## 尚未启用的部分
后台 AI 生成不会在本阶段擅自启动。现有角色设定、聊天历史、记忆和 API 配置保存在浏览器本地存储；Cloud Functions 无法读取这些本地数据。必须先实现用户明确授权的云端角色/聊天上下文同步，再让定时任务生成消息。否则后台模型没有可靠上下文，容易出现角色设定丢失或编造对话。

## Firebase Console 必须完成
1. 创建 Firebase 项目并添加 Web App。
2. 开启 Authentication → Sign-in method → Anonymous。
3. 创建 Firestore Database。
4. Cloud Messaging → Web Push certificates，生成 VAPID key。
5. 把 Web App 配置填入 `firebase-config.js`，并将 VAPID 公钥填入 `LR_FIREBASE_VAPID_KEY`。
6. 网站必须部署在 HTTPS 域名；FCM Web 不支持普通 HTTP（localhost 开发例外）。
7. 安装 Firebase CLI，登录并在项目目录执行 `firebase use --add`，选择自己的项目。
8. 在 `functions/` 执行 `npm install`，再部署 `firebase deploy --only functions,firestore:rules`。
9. Android Chrome/PWA 中打开 LOVE RECORD，在高级与开发者选项启用后台通知，并允许系统通知。

## 安全说明
- Firebase Web config 与 VAPID 公钥属于客户端配置，不是服务器密钥。
- 不要把 AI API Key 放进 `firebase-config.js` 或前端 JS。后续后台 AI 必须用 Cloud Functions Secret Manager 保存服务器密钥。
- 匿名登录 UID 与设备绑定；清除站点数据/换浏览器后会生成新的 UID。后续需要账户绑定或迁移流程。
- Firebase Functions 的 Scheduler 需要启用相应 Google Cloud 服务；定时任务可能产生费用。正式启用前应设置预算告警与频率上限。
