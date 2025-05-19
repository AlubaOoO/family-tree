<template>
  <div class="app-container">
    <header class="app-header">
      <!-- 需要隐藏这个 h1 -->
      <!-- <h1>家族关系图</h1> -->
      <div class="header-controls">
        <button class="btn-help" @click="showHelp = !showHelp" title="帮助信息">?</button>
      </div>
    </header>
    
    <div id="family-tree-canvas" class="family-tree-canvas">
      <FamilyTree />
    </div>

    <div v-if="showHelp" class="help-panel">
      <h3>使用说明</h3>
      <ul>
        <li>拖动人物卡片可以改变位置</li>
        <li>点击人物卡片可以查看详情</li>
        <li>双击人物卡片可以折叠/展开子树</li>
        <li>也可以使用卡片右下角的 +/- 按钮折叠/展开子树</li>
        <li>折叠后子女及其配偶将被隐藏</li>
        <li>使用左上角的按钮可以一键折叠或展开所有子树</li>
        <li>点击"重新布局"按钮可以自动重新计算卡片位置</li>
        <li>使用右上角的缩放控制可以放大缩小</li>
        <li>Ctrl+滚轮可以缩放视图</li>
        <li>各代之间有颜色区分的背景</li>
      </ul>
      <button class="btn-close" @click="showHelp = false">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import FamilyTree from './components/FamilyTree.vue';

const showHelp = ref(false);
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  font-family: 'Arial', 'Microsoft YaHei', sans-serif;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: #f8f9fa;
}

.app-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 25px;
  background-color: #fff;
  border-bottom: 1px solid #e5e5e5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  z-index: 10;
}

h1 {
  text-align: center;
  margin: 0;
  color: #333;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-controls {
  display: flex;
  gap: 10px;
}

.btn-help {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  color: #666;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-help:hover {
  background-color: #e9ecef;
}

.family-tree-canvas {
  flex: 1;
  position: relative;
  overflow: auto;
  background-color: #f8f9fa;
  background-image: 
    linear-gradient(rgba(200,200,200,0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(200,200,200,0.1) 1px, transparent 1px),
    linear-gradient(rgba(230, 245, 255, 0.4) 350px, transparent 350px),
    linear-gradient(rgba(230, 245, 255, 0.3) 650px, transparent 650px),
    linear-gradient(rgba(230, 245, 255, 0.4) 950px, transparent 950px),
    linear-gradient(rgba(230, 245, 255, 0.3) 1250px, transparent 1250px);
  background-size: 
    20px 20px,
    20px 20px,
    100% 1400px;
  border: 1px solid #e5e5e5;
}

.help-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background-color: white;
  width: 300px;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 3px 15px rgba(0,0,0,0.15);
  z-index: 1000;
}

.help-panel h3 {
  margin-top: 0;
  margin-bottom: 10px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
  color: #333;
}

.help-panel ul {
  margin: 0;
  padding-left: 20px;
}

.help-panel li {
  margin-bottom: 8px;
  color: #555;
}

.btn-close {
  margin-top: 15px;
  padding: 6px 12px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  float: right;
}

.btn-close:hover {
  background-color: #e9ecef;
}
</style>
