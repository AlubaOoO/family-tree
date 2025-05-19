<template>
  <div class="tree-controls">
    <div class="control-group">
      <button class="control-btn" @click="$emit('zoom-in')" title="放大">
        <span>+</span>
      </button>
      <button class="control-btn" @click="$emit('zoom-out')" title="缩小">
        <span>−</span>
      </button>
      <button class="control-btn" @click="$emit('reset-zoom')" title="重置缩放">
        <span>⟲</span>
      </button>
    </div>
    <div class="control-group">
      <button class="control-btn" @click="$emit('collapse-all')" title="折叠全部">
        <span>▼</span>
      </button>
      <button class="control-btn" @click="$emit('expand-all')" title="展开全部">
        <span>▶</span>
      </button>
      <button class="control-btn" @click="$emit('recalculate-layout')" title="重新计算布局">
        <span>⟳</span>
      </button>
    </div>
    <div class="control-group">
      <button class="control-btn fullscreen-btn" @click="$emit('toggle-fullscreen')" title="全屏展示">
        <span>{{ isFullScreen ? '❐' : '⛶' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isFullScreen: {
    type: Boolean,
    default: false
  }
});

defineEmits([
  'zoom-in', 
  'zoom-out', 
  'reset-zoom', 
  'collapse-all', 
  'expand-all', 
  'recalculate-layout',
  'toggle-fullscreen'
]);
</script>

<style scoped>
.tree-controls {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10000; /* Ensure it's above other elements */
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.control-btn {
  width: 40px;
  height: 40px;
  border: none;
  background-color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #333;
  transition: background-color 0.2s;
}

.control-btn:hover {
  background-color: #f0f0f0;
}

.control-btn:active {
  background-color: #e0e0e0;
}

.fullscreen-btn {
  font-size: 22px;
}
</style> 