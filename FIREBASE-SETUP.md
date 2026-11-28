# LOVE RECORD Firebase 后台接入说明（阶段 1）

## 当前阶段包含
- 启动时自动恢复/创建 Firebase Anonymous Auth 身份，并在「设置 → 隐私与安全」显示 UID、创建时间、最近登录时间及复制按钮
- Web Push / FCM Service Worker 接收器
- 浏览器端通知权限、FCM token 注册
- Firebase Anonymous Auth（为每个安装设备建立隔离 UID）
- Callable Function 安全登记设备 token、保存全局后台偏好、通过 `saveBackgroundConversationControl` 分别保存单聊/群聊后台开关、发送测试通知
- 设置页可选择混合模式、夜间免打扰，并将全局与每个单聊/群聊的后台开关分别保存到 Firestore
- Firestore 用户数据隔离规则
- 每 15 分钟运行的混合活动调度器基础框架

## 尚未启用的部分
后台通知在 Firebase 配置、部署并允许系统通知后可用。CHAR 后台 AI 自主生成仍未启用：角色设定、聊天历史、长期记忆和 API 配置目前保存在浏览器本地，Cloud Functions 无法直接读取。必须先在前端提供可审查的数据范围、用户明确同意后才同步必要的角色资料/记忆/对话上下文，并将 AI API Key 安全写入 Secret Manager；不能把 API Key 放进 Web 配置或 Firestore。当前定时器只检查全局开关和每个聊天的独立开关，并标记等待上下文；不会编造或发送角色消息。

## Firebase Console 必须完成
1. 创建 Firebase 项目并添加 Web App。
2. 开启 Authentication → Sign-in method → Anonymous。
3. 创建 Firestore Database。
4. Cloud Messaging → Web Push certificates，生成 VAPID key。
5. `firebase-config.js` 已填入项目 `love-record-0928` 的 Web App 客户端配置；仅在 Firebase 控制台生成 VAPID 公钥后，再填入 `LR_FIREBASE_VAPID_KEY`。
6. 网站必须部署在 HTTPS 域名；FCM Web 不支持普通 HTTP（localhost 开发例外）。
7. 安装 Firebase CLI，登录并在项目目录执行 `firebase use --add`，选择自己的项目。
   - 如果部署域名不是 `love-record-0928.firebaseapp.com`，请在 Authentication → Settings → Authorized domains 中添加 LOVE RECORD 实际使用的域名（只填写主机名，不带 `https://` 和路径）。
8. 在 `functions/` 执行 `npm install`，再部署 `firebase deploy --only functions,firestore:rules`。
9. Android Chrome/PWA 中打开 LOVE RECORD，在高级与开发者选项启用后台通知，并允许系统通知。

## 安全说明
- Firebase Web config 与 VAPID 公钥属于客户端配置，不是服务器密钥。
- 不要把 AI API Key 放进 `firebase-config.js` 或前端 JS。后续后台 AI 必须用 Cloud Functions Secret Manager 保存服务器密钥。
- 匿名登录 UID 默认保存在当前浏览器的 Firebase Auth 本地持久化中；清除站点数据/换浏览器/换设备后可能生成新的 UID。当前版本尚未提供跨设备账号绑定或恢复流程。
- Firebase Functions 的 Scheduler 需要启用相应 Google Cloud 服务；定时任务可能产生费用。正式启用前应设置预算告警与频率上限。


## 测试推送
完成 Web 配置、VAPID、匿名登录和 Functions 部署后，在 设置 → 高级与开发者选项 → 后台活动与消息推送 中点击“启用本机后台通知”，再点击“发送测试通知”。使用数据消息由根目录 `sw.js` 的 `onBackgroundMessage` 显示通知。Android 的系统省电/通知权限仍会影响送达。

## 本次客户端身份接入说明
- 页面启动后会自动调用 Firebase Anonymous Auth；用户无需填写账号或密码。
- 用户 UID 与创建/最近登录时间显示在「设置 → 隐私与安全 → 我的账户」。
- UID 可以在 Firebase Console → Authentication → Users 中查看；用户总数也可在该用户列表中统计。
- 这一步仅建立 Firebase 身份并展示 UID；LOVE RECORD 的聊天、角色、社区等数据仍由现有本地模块保存，尚未自动同步到 Firestore。不要把“有 UID”理解为全部资料已经云端备份。
- Firestore 初始生产规则仍然拒绝客户端读写。本次没有部署或放宽 Firestore Rules。后续必须先按实际数据结构实现用户 UID 隔离，再部署规则。
