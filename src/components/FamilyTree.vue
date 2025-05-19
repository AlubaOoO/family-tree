<template>
  <div class="family-tree-container" :class="{ 'fullscreen-mode': isFullScreen }">
    <TreeControls
      :is-full-screen="isFullScreen"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @reset-zoom="resetZoom"
      @collapse-all="collapseAll"
      @expand-all="expandAll"
      @toggle-fullscreen="toggleFullScreen"
      @recalculate-layout="recalculateLayout"
    />
    
    <div 
      ref="treeCanvas" 
      class="tree-canvas"
      :style="{ transform: `scale(${zoom})`, transformOrigin: '0 0', left: canvasPosition.x + 'px', top: canvasPosition.y + 'px' }"
      @wheel.prevent="handleWheel"
      @mousedown="startCanvasDrag"
    >
      <div v-if="!isInitialized" class="loading-overlay">
        <div class="loading-message">加载家谱树...</div>
      </div>
      
      <div v-if="isConnectingNodes" class="connecting-overlay">
        <div class="loading-message">建立家族连接...</div>
      </div>
      
      <GenerationLabel 
        v-for="label in generationLabels" 
        :key="'gen-' + label.generation"
        :generation="label.generation"
        :position="label.position"
        :height="label.height"
      />
      
      <div
        v-for="person in displayFamilyData" 
        :key="person.id"
        :id="'person-' + person.id"
        class="person-node"
        :class="{ 
          'selected': selectedPerson?.id === person.id,
          'hidden': person._hidden,
          'has-children': hasChildren(person.id),
          'collapsed': person.collapsed && hasChildren(person.id)
        }"
        :style="{
          left: person.position.x + 'px',
          top: person.position.y + 'px'
        }"
        @click="selectPerson(person)"
        @dblclick="handleDoubleClick(person)"
      >
        <PersonCard 
          :person="person"
          :has-children="hasChildren(person.id)"
          :is-collapsed="person.collapsed"
          @drag-start="startDrag" 
          @drag-end="endDrag"
          @toggle-collapse="toggleCollapse(person)"
        />
      </div>
    </div>

    <PersonDetails
      v-if="selectedPerson && !isFullScreen"
      :person="selectedPerson"
      :has-children="hasChildren(selectedPerson.id)"
      @toggle-collapse="toggleCollapse(selectedPerson)"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, onUnmounted, computed } from 'vue';
import PersonCard from './PersonCard.vue';
import TreeControls from './TreeControls.vue';
import PersonDetails from './PersonDetails.vue';
import GenerationLabel from './GenerationLabel.vue';
import LayoutEngine from '../services/LayoutEngine';
import ConnectionManager from '../services/ConnectionManager';
import { familyData as rawFamilyData, getChildren, findPersonById } from '../services/FamilyData';
import { wait } from '../utils/domUtils';

// 将导入的数据转换为响应式数据
const familyData = reactive(rawFamilyData.map(person => ({
  ...person,
  position: { ...person.position },
  _hidden: false,
  children: person.children ? person.children.map(child => ({
    ...child,
    position: { ...child.position },
    _hidden: false,
    children: child.children ? child.children.map(grandchild => ({
      ...grandchild,
      position: { ...grandchild.position },
      _hidden: false,
      children: grandchild.children ? grandchild.children.map(ggchild => ({
        ...ggchild,
        position: { ...ggchild.position },
        _hidden: false,
        children: ggchild.children ? [...ggchild.children] : []
      })) : []
    })) : []
  })) : []
})));

// Reference to the canvas
const treeCanvas = ref(null);

// Current zoom level
const zoom = ref(1);

// Canvas dragging state
const isDraggingCanvas = ref(false);
const canvasPosition = reactive({ x: 0, y: 0 });
const dragStart = reactive({ x: 0, y: 0 });

// Full-screen state
const isFullScreen = ref(false);

// Currently selected person
const selectedPerson = ref(null);

// 加载状态
const isInitialized = ref(false);
const isConnectingNodes = ref(false);

// 世代标记数据
const generationLabels = ref([]);

// Services
let layoutEngine = null;
let connectionManager = null;

// 获取世代标记数据
const updateGenerationLabels = () => {
  if (layoutEngine) {
    generationLabels.value = layoutEngine.getGenerationLabels();
  }
};

// Toggle full-screen mode
const toggleFullScreen = () => {
  isFullScreen.value = !isFullScreen.value;
  
  // Give DOM time to update, then adapt to screen size
  nextTick(() => {
    const treeCanvasElement = treeCanvas.value;
    if (treeCanvasElement) {
      const dimensions = {
        maxX: parseFloat(treeCanvasElement.style.width),
        maxY: parseFloat(treeCanvasElement.style.height)
      };
      autoFitContent(dimensions);
    }
  });
};

// Check if a person has children
const hasChildren = (personId) => {
  const person = findPersonById(personId, familyData);
  return person && getChildren(person).length > 0;
};

// Function to toggle collapse state of a subtree
const toggleCollapse = (person) => {
  if (!hasChildren(person.id)) return;
  
  person.collapsed = !person.collapsed;
  updateVisibility();
  nextTick(() => {
    updateConnections();
  });
};

// Update visibility based on collapse state
const updateVisibility = () => {
  if (!layoutEngine) return;
  
  layoutEngine.updateVisibility();
  nextTick(() => {
    if (connectionManager) {
      connectionManager.reset();
    }
  });
};

// Public method to recalculate layout
const recalculateLayout = () => {
  if (!layoutEngine) return;
  
  const dimensions = layoutEngine.calculatePositions();
  updateVisibility();
  updateGenerationLabels();
  nextTick(() => {
    updateCanvasDimensions(dimensions);
    updateConnections();
    
    // Auto-fit content after recalculating layout
    autoFitContent(dimensions);
  });
};

// Update canvas dimensions
const updateCanvasDimensions = (dimensions) => {
  const treeCanvasElement = treeCanvas.value;
  if (treeCanvasElement) {
    treeCanvasElement.style.height = `${dimensions.maxY}px`;
    treeCanvasElement.style.width = `${dimensions.maxX}px`;
  }
};

// Update connections after changes
const updateConnections = () => {
  if (connectionManager) {
    connectionManager.updateConnections();
  }
};

// Zoom controls
const zoomIn = () => {
  zoom.value = Math.min(zoom.value + 0.1, 2.0);
  updateConnections();
};

const zoomOut = () => {
  zoom.value = Math.max(zoom.value - 0.1, 0.5);
  updateConnections();
};

const resetZoom = () => {
  const treeCanvasElement = treeCanvas.value;
  if (treeCanvasElement) {
    const dimensions = {
      maxX: parseFloat(treeCanvasElement.style.width),
      maxY: parseFloat(treeCanvasElement.style.height)
    };
    autoFitContent(dimensions);
  } else {
    zoom.value = 1;
    updateConnections();
  }
};

const handleWheel = (event) => {
  // Support zooming with mousewheel regardless of ctrl key when in fullscreen
  if (isFullScreen.value || event.ctrlKey) {
    if (event.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  }
};

// Handle person selection
const selectPerson = (person) => {
  selectedPerson.value = person;
};

// Double click to toggle collapse
const handleDoubleClick = (person) => {
  toggleCollapse(person);
};

// Drag handlers
const startDrag = (personId, event) => {
  // Implemented in PersonCard component
};

const endDrag = (personId, event) => {
  // Update connections after dragging
  updateConnections();
};

// Collapse all subtrees
const collapseAll = () => {
  familyData.forEach(person => {
    if (hasChildren(person.id)) {
      person.collapsed = true;
    }
  });
  updateVisibility();
};

// Expand all subtrees
const expandAll = () => {
  familyData.forEach(person => {
    if (hasChildren(person.id)) {
      person.collapsed = false;
    }
  });
  updateVisibility();
};

// Handle canvas drag start
const startCanvasDrag = (event) => {
  if (event.target === treeCanvas.value) {
    isDraggingCanvas.value = true;
    dragStart.x = event.clientX - canvasPosition.x;
    dragStart.y = event.clientY - canvasPosition.y;
    treeCanvas.value.style.cursor = 'grabbing';
  }
};

// Handle canvas dragging
const dragCanvas = (event) => {
  if (isDraggingCanvas.value) {
    canvasPosition.x = event.clientX - dragStart.x;
    canvasPosition.y = event.clientY - dragStart.y;
    treeCanvas.value.style.left = canvasPosition.x + 'px';
    treeCanvas.value.style.top = canvasPosition.y + 'px';
  }
};

// Handle canvas drag end
const endCanvasDrag = () => {
  isDraggingCanvas.value = false;
  if (treeCanvas.value) {
    treeCanvas.value.style.cursor = 'grab';
  }
};

// 自动缩放画布以显示全部内容
const autoFitContent = (dimensions) => {
  if (!treeCanvas.value) return;
  
  // 获取容器尺寸
  const containerWidth = treeCanvas.value.parentElement.clientWidth;
  const containerHeight = treeCanvas.value.parentElement.clientHeight;
  
  // 计算水平和垂直方向的缩放比例
  const horizontalScale = (containerWidth - 80) / dimensions.maxX;
  const verticalScale = (containerHeight - 80) / dimensions.maxY;
  
  // 选择较小的缩放比例，确保完全显示树
  const newScale = Math.min(horizontalScale, verticalScale, 1.0);
  
  // 更新缩放级别，不超过1.0
  zoom.value = Math.max(0.5, Math.min(newScale, 1.0));
  
  // 计算居中位置
  const centerX = (containerWidth - dimensions.maxX * zoom.value) / 2;
  const centerY = (containerHeight - dimensions.maxY * zoom.value) / 2;
  
  // 更新画布位置
  canvasPosition.x = Math.max(0, centerX);
  canvasPosition.y = Math.max(0, centerY);
  
  console.log(`Auto-fit: scale=${zoom.value}, position=(${canvasPosition.x}, ${canvasPosition.y})`);
  
  // 更新连接
  updateConnections();
};

// 初始化家谱树布局和连接
const initializeTreeLayout = async () => {
  try {
    // 确保以下操作顺序执行并在每一步等待DOM更新
    
    // 1. 初始化布局引擎
    layoutEngine = new LayoutEngine(familyData);
    
    // 2. 计算初始位置
    const dimensions = layoutEngine.calculatePositions();
    
    // 3. 更新节点可见性
    layoutEngine.updateVisibility();
    
    // 4. 获取世代标记
    updateGenerationLabels();
    
    // 5. 等待DOM更新
    await nextTick();
    
    // 6. 更新画布尺寸
    updateCanvasDimensions(dimensions);
    
    // 7. 等待DOM更新并标记初始化完成
    await nextTick();
    
    // 8. 标记初始化完成，显示节点
    isInitialized.value = true;
    
    // 9. 等待DOM更新，确保节点已渲染
    await nextTick();
    await wait(100); // 额外等待一点时间确保DOM完全渲染
    
    // 10. 标记正在建立连接
    isConnectingNodes.value = true;
    
    // 11. 初始化连接管理器
    connectionManager = new ConnectionManager(treeCanvas.value, familyData, layoutEngine);
    connectionManager.initialize();
    
    // 12. 等待DOM更新
    await nextTick();
    
    // 13. 构建连接
    await connectionManager.initializeConnections();
    
    if (treeCanvas.value) {
      treeCanvas.value.style.cursor = 'grab';
    }
    
    // 14. 连接完成
    isConnectingNodes.value = false;
    
    // 15. 自动缩放画布以显示全部内容
    await nextTick();
    autoFitContent(dimensions);
  } catch (error) {
    console.error('Failed to initialize family tree:', error);
    isInitialized.value = true;
    isConnectingNodes.value = false;
  }
};

// 显示节点的计算属性 (仅在初始化后显示)
const displayFamilyData = computed(() => {
  if (!isInitialized.value) return [];
  
  // 扁平化家族树，将所有人（包括配偶和子女）都放在一个数组中
  const flattenedData = [];
  
  // 递归函数，用于将家族树扁平化
  const flattenFamilyTree = (people) => {
    if (!people || !people.length) return;
    
    for (const person of people) {
      // 添加当前人物到扁平化数组
      flattenedData.push(person);
      
      // 如果有子女，递归添加
      if (person.children && person.children.length > 0) {
        flattenFamilyTree(person.children);
      }
    }
  };
  
  // 从根节点开始扁平化
  flattenFamilyTree(familyData);
  
  return flattenedData;
});

// Handle screen resize events to maintain proper fit
const handleResize = () => {
  if (isFullScreen.value && treeCanvas.value) {
    const dimensions = {
      maxX: parseFloat(treeCanvas.value.style.width),
      maxY: parseFloat(treeCanvas.value.style.height)
    };
    autoFitContent(dimensions);
  }
};

// Initialize when component is mounted
onMounted(async () => {
  // 设置画布事件监听
  window.addEventListener('mousemove', dragCanvas);
  window.addEventListener('mouseup', endCanvasDrag);
  window.addEventListener('resize', handleResize);
  
  // 等待下一个渲染周期确保DOM已准备好
  await nextTick();
  
  // 初始化树布局
  await initializeTreeLayout();
});

// Clean up event listeners when component is unmounted
onUnmounted(() => {
  window.removeEventListener('mousemove', dragCanvas);
  window.removeEventListener('mouseup', endCanvasDrag);
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.family-tree-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.fullscreen-mode {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background-color: #f8f9fa;
}

.fullscreen-button {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10000;
  padding: 8px 16px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: all 0.2s ease;
}

.fullscreen-button:hover {
  background-color: #f0f0f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.fullscreen-mode .fullscreen-button {
  position: fixed;
  top: 20px;
  right: 20px;
}

.tree-canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: #f8f9fa;
  transition: transform 0.1s;
  top: 0;
  left: 0;
  cursor: grab;
}

.loading-overlay, .connecting-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(248, 249, 250, 0.8);
  z-index: 10;
}

.connecting-overlay {
  background-color: rgba(248, 249, 250, 0.5);
}

.loading-message {
  padding: 20px 40px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  font-size: 18px;
  color: #333;
}

.person-node {
  position: absolute;
  cursor: pointer;
  z-index: 1;
  transition: opacity 0.5s, transform 0.3s;
}

.person-node.hidden {
  opacity: 0;
  pointer-events: none;
  transform: scale(0.8);
}

.person-node.has-children::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 30px;
  background-color: #aaa;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0.5;
  transition: opacity 0.3s;
}

.person-node.collapsed::after,
.person-node.hidden::after {
  opacity: 0;
}

.selected {
  z-index: 2;
}

/* Labels for connections */
:deep(.spouse-label) {
  background-color: rgba(255, 255, 255, 0.8);
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 11px;
  color: #e74c7c;
  border: 1px solid #e74c7c;
}

:deep(.child-label) {
  background-color: rgba(255, 255, 255, 0.8);
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 11px;
  color: #555;
  border: 1px solid #555;
  transform: translateY(-50%);
}
</style> 