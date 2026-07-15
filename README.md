# Mermaid & PlantUML 选区预览

一个本地渲染 Mermaid 与 PlantUML 的 Chrome 扩展。选中网页中的图表源码，点击右键菜单，即可在当前页面浮层中预览，无需离开原文档。

[下载安装包](https://github.com/Tudou77826/mermaid-plantuml-selection-preview/releases/latest) · [完整使用说明](docs/USAGE.md) · [隐私政策](PRIVACY.md) · [Chrome 网上应用店](https://chromewebstore.google.com/detail/ahonaanmkbgmcbjlhfgpfleigbmedmlh)

![Mermaid 页内浮层预览](docs/images/mermaid-overlay.png)

## 功能

- 自动识别 Mermaid 与 PlantUML。
- 页面没有原生右键菜单时，可点击扩展图标读取选区；读取失败时直接粘贴源码。
- 支持包含或不包含 Markdown 代码围栏的选区。
- 在原页面上方显示轻量浮层，不跳转页面。
- 支持滚轮缩放、鼠标拖动、双击适应窗口和键盘快捷键。
- Mermaid 与 PlantUML 全部在浏览器本地渲染，不上传源码。
- 只在用户主动点击右键菜单、扩展图标或快捷键后临时访问当前页面。

## 安装

### Chrome 网上应用店

通过 [Chrome 网上应用店页面](https://chromewebstore.google.com/detail/ahonaanmkbgmcbjlhfgpfleigbmedmlh) 安装。若商店版本仍在审核，可使用下面的手动安装方式。

### GitHub Release

1. 从 [Releases](https://github.com/Tudou77826/mermaid-plantuml-selection-preview/releases/latest) 下载名称形如 `mermaid-plantuml-selection-preview-<版本号>.zip` 的文件。
2. 将 ZIP 解压到固定目录。
3. 打开 `chrome://extensions`。
4. 开启右上角“开发者模式”。
5. 点击“加载已解压的扩展程序”，选择刚才解压的目录。

手动安装的版本不会通过 Chrome 网上应用店自动更新。升级时需要下载新版 Release 并替换目录。

## 使用

1. 在网页中选中 Mermaid 或 PlantUML 源码。
2. 点击右键菜单“预览 Mermaid / PlantUML 图”，或直接点击扩展图标。
3. 在浮层中查看、缩放或拖动图表。
4. 点击浮层外区域、关闭按钮或按 `Esc` 退出。

页面无法提供标准选区时，扩展图标会打开一个极简粘贴框；粘贴源码后按 `Ctrl+Enter` 即可预览。也可以使用 `Ctrl+Shift+M` 打开同一入口，并在 `chrome://extensions/shortcuts` 中修改快捷键。

常用快捷键：

| 操作 | 鼠标或键盘 |
| --- | --- |
| 放大 / 缩小 | 滚轮、`+`、`-` |
| 移动画布 | 按住鼠标拖动 |
| 适应窗口 | 双击画布或按 `0` |
| 恢复 100% | `1` |
| 关闭预览 | `Esc` |

输入可以包含代码围栏：

````markdown
```mermaid
flowchart LR
  A[选中文本] --> B[右键预览]
```
````

也可以只选中图表正文。PlantUML 支持 `plantuml`、`puml`、`uml` 围栏；缺少 `@startuml` 和 `@enduml` 时会自动补齐。

更多示例、限制与故障排查见 [使用说明](docs/USAGE.md)。

## 隐私与安全

- 不申请全站网页读取权限。
- 选区只在本机用于生成预览，不访问远程渲染服务。
- 一次性选区读取后立即删除；异常残留最多保留 5 分钟。
- Mermaid 使用严格安全模式渲染。
- PlantUML 禁止 `!include` 和 `!import`，避免隐式网络或文件读取。

详细说明见 [隐私政策](PRIVACY.md)。

## 本地开发

需要 Node.js 20+ 与 Chrome。

```powershell
npm install
npm run check
```

`npm run check` 会依次生成图标、运行单元测试、构建扩展并执行真实浏览器端到端测试。构建结果位于 `dist`。

生成可发布 ZIP：

```powershell
npm run package
```

发布包位于 `release`。项目结构与开发说明见 [使用说明](docs/USAGE.md#开发与构建)。

## 许可证

本项目使用 [MIT License](LICENSE)。第三方依赖遵循各自许可证。
