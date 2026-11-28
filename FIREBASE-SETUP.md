# LOVE RECORD · 云端 CHAR 与 Web Push（Spark 免费方案）

这套版本不使用 Firebase Cloud Functions，也不要求升级 Blaze。网页端负责取得 FCM Token、把获准同步的角色上下文写入用户自己的 Firestore UID 空间；GitHub Actions 负责定时读取这些数据、调用用户自己配置的 OpenAI-compatible API，并通过 Firebase Admin SDK 发送 FCM 推送。

> 重要：这是“云端角色任务 + 手机推送”，不是让 Android 上的网页进程永远常驻。PWA 被关闭后云端任务仍可运行；最终通知仍取决于 FCM、网络、Android 通知权限和系统省电策略，不能保证每条通知在每种设备状态下 100% 即时送达。

## 一次性部署步骤

### 1. 发布 Firestore 安全规则

Firebase Console → `love-record-0928` → Build → Firestore Database → Rules。

将规则替换为仓库根目录 `firestore.rules` 的完整内容，然后点击 **Publish**：

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read, write: if isOwner(userId);
      match /{document=**} {
        allow read, write: if isOwner(userId);
      }
    }
  }
}
```

这份规则分别覆盖 `/users/{uid}` 用户索引文档和它下面的所有子集合；每位登录用户只能读写自己的 UID 路径。不要改成 `allow read, write: if true`。发布后请返回 LOVE RECORD 重新启用本机通知。

### 2. 在 GitHub Actions 添加服务账号 Secret

1. Firebase Console → Project settings → Service accounts → **Generate new private key**，下载 JSON 文件。
2. 打开 GitHub 仓库 `heeyeonseo14-gif/loverecord` → Settings → Secrets and variables → Actions → **New repository secret**。
3. Name 填：`FIREBASE_SERVICE_ACCOUNT_JSON`。
4. Value 粘贴刚下载 JSON 文件的**完整内容**并保存。
5. JSON 私钥文件只能留在你自己的安全位置；不要上传到仓库、不要放进 ZIP、不要发到聊天。服务账号拥有后台访问 Firestore 和发送 FCM 的权限。公开仓库只有可信任的写入者才应保留写权限，因为写入者可能修改工作流并尝试使用 Secret。

GitHub Actions 使用公开仓库的标准 `ubuntu-latest` runner；标准 runner 在公开仓库免费。工作流约每 15 分钟运行一次，GitHub 可能延迟排队；工作流必须在默认分支。GitHub 对定时工作流有排队延迟，并可能在公开仓库连续 60 天没有仓库活动后自动停用定时工作流，需要重新启用。请不要把仓库改为私有，除非先核对 Actions 的额度与费用。

### 3. 发布 Firestore Rules 后，确认 GitHub Actions 启用

仓库根目录必须包含 `.github/workflows/lr-background.yml`（本 ZIP 已附带）。提交后进入仓库 → Actions → 如果显示需要启用 Actions，点击 **Enable**。找到 `LOVE RECORD Background CHAR` 工作流，先点击 **Run workflow** 做一次手动运行。

### 4. 手机端完成首次注册与授权

1. 用 Chrome 打开 LOVE RECORD，等新版本完全加载。
2. 设置 → 高级与开发者选项 → 后台活动与消息推送 → 点击 **启用本机后台通知**，允许通知。
3. 在 Firestore Rules 已发布、Actions Secret 已添加的前提下，页面应显示“本机推送登记成功”。若显示 permission-denied，先检查第 1 步是否真的点了 Publish。
4. 打开需要参与的单聊或群聊设置，开启该聊天的「允许后台保活」，保存；后台活动总开关也要开启。
5. 回到后台活动设置，点击 **同步角色资料与近期记忆到云端**。确认授权后，系统只同步已开启后台保活的聊天角色资料、世界书/长期记忆摘要、最近 20 条文字消息，以及当前 API Base、模型和 API Key；不上传图片、语音附件或完整本地备份。
6. 授权成功后，应用重新打开、聊天内容更新或恢复联网时会自动同步最新上下文。可再次手动点击同步按钮刷新资料。
7. 点击 **发送测试通知**，再到 GitHub Actions 手动运行 `LOVE RECORD Background CHAR`。成功后手机应收到测试推送。

## 角色活动规则

- 设置中心可调整全局默认主动联系间隔（15、30、60、90、120、180、240、360 或 720 分钟）；每个单聊和群聊也可单独覆盖，选择「跟随全局默认」则使用全局值。默认值仍为 120 分钟。GitHub Actions 约每 5 分钟巡检一次（实际可能延迟或漏触发），云端角色最短生成间隔仍为 15 分钟，因此小于 15 分钟的云端间隔不提供；实际生成时间还会受 GitHub 排队和 API 响应影响。
- 全局后台活动开关关闭时，云端停止生成；单聊/群聊各自的后台开关关闭时，该聊天上下文会被停用。
- 云端生成需要用户自己的 API 服务有效且允许调用。**AI 服务商的 API 用量可能收费**，这不由 Firebase 或 GitHub Actions 免费额度覆盖。首次同步前请先确认 API 服务商的计费与余额。
- API Key 存在当前 UID 下的 Firestore 私有路径，只允许该 UID 的客户端规则访问；项目所有者和 GitHub Actions 服务账号仍具备管理权限。AI 请求会把同步的角色上下文发送给用户选择的 API 服务商。

## 排错

- **点启用后显示 Firestore permission-denied**：第 1 步 Rules 没有发布成功，或 Firebase Console 里的规则不是上面这份。
- **Token 已登记但收不到测试推送**：检查 GitHub Actions Secret 名称和值、Actions 是否启用、手动运行工作流日志、Android Chrome 网站通知权限。
- **测试推送成功但 CHAR 不主动发消息**：检查全局开关、聊天独立开关、是否点过云端资料同步、API Base/Key/Model 是否仍有效，并查看 GitHub Actions 运行日志。
- **推送通知可到但关闭 PWA 后消息没有写进本地聊天**：云端消息会先保存在 Firestore；重新打开 LOVE RECORD 且联网后会自动导入本地聊天记录。
- Android 强制停止 Chrome、系统关闭后台数据、网络断开、FCM/Actions 排队延迟，都可能影响通知时效。通知不是绝对实时服务。

## 费用与服务

- 不部署 Firebase Cloud Functions，因此不需要为这套方案升级 Blaze。
- Firebase Cloud Messaging 本身目前列为 Firebase 免费服务；Firestore 仍受 Spark 免费额度及配额约束。
- GitHub 公开仓库标准托管 runner 免费；如果改为私有仓库或更大型 runner，费用规则不同。
- 用户自己的 AI API 请求仍按 API 服务商规则计费。

## 数据路径

- 用户索引：`users/{uid}`
- 设备 Token：`users/{uid}/devices/{tokenHash}`
- 全局后台设置：`users/{uid}/background/settings`
- 单聊/群聊后台开关：`users/{uid}/background/settings/conversations/{conversationHash}`
- 角色上下文：`users/{uid}/background/conversations/items/{conversationHash}`
- API 配置：`users/{uid}/background/private/secrets/apiConfig`
- 云端生成消息：`users/{uid}/background/messages/items/{messageId}`
- 测试推送队列：`users/{uid}/background/requests/queue/{requestId}`

## 技术边界

这套架构设计为让 GitHub Actions 在 PWA 关闭时继续定时执行角色生成，并向已登记设备发送 FCM 推送；它尚需按一次性部署步骤完成 Firebase Rules、GitHub Secret 和手机 Token 登记后才能实际运行。但不是连续运行的长驻进程；最短调度间隔、GitHub 排队、API 服务商响应、FCM 和 Android 省电策略都会影响时效。首次部署和真正送达必须在用户的 Firebase、GitHub Secret 与手机上完成实测，不能仅凭本地代码检查宣称已经上线成功。


## V29 · 定时巡检与前台自主发消息

- GitHub Actions 现在每 5 分钟巡检一次（cron `3-59/5 * * * *`），但 GitHub schedule 仍是 best-effort，可能延迟或漏掉触发；云端角色最短生成间隔仍由设置控制，至少 15 分钟。
- 后台每轮消息数默认自然生成 2–3 条；可以在「高级与开发者选项 → 后台活动与消息推送」改为每轮 1 条。
- 单聊和群聊设置中新增「自主发消息」：只在 LOVE RECORD 页面处于前台可见、设备联网时运行，间隔可选 1–30 分钟，默认 2 分钟，每轮默认 2–3 条。切换到其他手机应用、锁屏、关闭 PWA 或浏览器冻结页面后，前台计时会暂停；此时仍由云端后台活动和 FCM 通知负责。
- 聊天联系人、群聊和桌面聊天入口会显示未读数字；当前正在查看的那一段对话不会累计未读。页面前台收到 FCM 时会触发消息同步并显示应用内提示。
- Android 系统可能节流浏览器后台计时与通知，不能把前台 1–30 分钟选项当成锁屏后台定时器。
