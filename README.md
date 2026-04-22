# 履带小车基地三维控制台

一个基于 `Vite + Three.js` 的 Web 端履带小车三维控制台，包含模型加载、基地场景、履带动画、手动控制、自动巡航、小地图、环境模拟、传感器可视化和诊断面板。

## 本地运行

```bash
npm install
npm run dev
```

## 生产构建

```bash
npm run build
npm run preview:public
```

如果要发布到带子路径的 GitHub Pages 地址，例如：

```text
https://zhuzhaoyu56.github.io/dingyikun/
```

使用：

```bash
npm run build:dingyikun
```

## GitHub Pages 部署

默认采用 GitHub Pages 分支发布模式：

- `main` 分支保存源码
- `gh-pages` 分支保存构建后的静态站点

推荐仓库名：

```text
zhuzhaoyu56.github.io
```

如果使用这个仓库名，最终公网地址将是：

```text
https://zhuzhaoyu56.github.io/
```

本项目的人物教室展示页也可以作为子路径发布：

```text
https://zhuzhaoyu56.github.io/dingyikun/
```
