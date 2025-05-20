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
      
      <div v-if="isLoadingChildren" class="connecting-overlay">
        <div class="loading-message">加载子树数据...</div>
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
          @toggle-collapse="toggleCollapse(person)"
          @load-children="loadChildrenData"
        />
      </div>
    </div>

    <PersonDetails
      v-if="selectedPerson && !isFullScreen"
      :person="selectedPerson"
      :has-children="hasChildren(selectedPerson.id)"
      @toggle-collapse="toggleCollapse(selectedPerson)"
      @load-children="loadChildrenData"
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
const familyData = reactive(processPersonData(rawFamilyData));

// 递归处理人物数据，添加位置和状态属性
function processPersonData(peopleArray) {
  if (!peopleArray || !Array.isArray(peopleArray)) return [];
  
  return peopleArray.map(person => {
    // 处理当前人物
    const processedPerson = {
      ...person,
      position: { ...(person.position || { x: 0, y: 0 }) },
      _hidden: false,
      // 使用mockData中的hasChildrenToLoad或默认为false
      hasChildrenToLoad: person.hasChildrenToLoad || false,
      // 如果没有子女数据或者hasChildrenToLoad为true，则默认折叠
      collapsed: !person.children || person.children.length === 0 || person.hasChildrenToLoad === true
    };
    
    // 递归处理子女
    if (processedPerson.children && processedPerson.children.length > 0) {
      processedPerson.children = processPersonData(processedPerson.children);
    } else {
      processedPerson.children = [];
    }
    
    return processedPerson;
  });
}

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

// Loading state for children data
const isLoadingChildren = ref(false);

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

// Check if a person has children or has children to load
const hasChildren = (personId) => {
  const person = findPersonById(personId, familyData);
  if (!person) return false;
  
  // Check if person has actual children data
  const hasActualChildren = person.children && 
                           person.children.some(child => child.type === 'child');
  
  // Check if person is marked as having children to load
  const hasChildrenMarkedToLoad = person.hasChildrenToLoad === true;
  
  return hasActualChildren || hasChildrenMarkedToLoad;
};

// Function to toggle collapse state of a subtree
const toggleCollapse = (person) => {
  if (!hasChildren(person.id)) return;
  
  // If person has children data, toggle collapse state
  if (person.children && person.children.some(child => child.type === 'child')) {
    person.collapsed = !person.collapsed;
    updateVisibility();
    nextTick(() => {
      updateConnections();
    });
  } else if (person.hasChildrenToLoad) {
    // If person has children to load but not loaded yet, load them
    loadChildrenData(person.id);
  }
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
  if (!layoutEngine) {
    console.warn('[recalculateLayout] Layout engine not initialized');
    return;
  }
  
  console.log('[recalculateLayout] Starting layout recalculation');
  
  // 记录重新计算前的一些关键节点位置
  if (selectedPerson.value) {
    console.log('[recalculateLayout] Selected person position before recalculation:', {
      id: selectedPerson.value.id,
      name: selectedPerson.value.name,
      position: { ...selectedPerson.value.position }
    });
    
    // 如果选中的人有子女，也记录它们的位置
    if (selectedPerson.value.children && selectedPerson.value.children.length > 0) {
      console.log('[recalculateLayout] Selected person\'s children before recalculation:', 
        selectedPerson.value.children.map(child => ({
          id: child.id,
          name: child.name,
          position: { ...child.position }
        }))
      );
    }
  }
  
  console.log('[recalculateLayout] Calling layoutEngine.calculatePositions()');
  const dimensions = layoutEngine.calculatePositions();
  
  // 记录重新计算后的一些关键节点位置
  if (selectedPerson.value) {
    console.log('[recalculateLayout] Selected person position after recalculation:', {
      id: selectedPerson.value.id,
      name: selectedPerson.value.name,
      position: { ...selectedPerson.value.position }
    });
    
    // 如果选中的人有子女，也记录它们的位置
    if (selectedPerson.value.children && selectedPerson.value.children.length > 0) {
      console.log('[recalculateLayout] Selected person\'s children after recalculation:', 
        selectedPerson.value.children.map(child => ({
          id: child.id,
          name: child.name,
          position: { ...child.position }
        }))
      );
    }
  }
  
  console.log('[recalculateLayout] Updating visibility');
  updateVisibility();
  
  console.log('[recalculateLayout] Updating generation labels');
  updateGenerationLabels();
  
  nextTick(() => {
    console.log('[recalculateLayout] Updating canvas dimensions:', dimensions);
    updateCanvasDimensions(dimensions);
    
    console.log('[recalculateLayout] Updating connections');
    updateConnections();
    
    // Auto-fit content after recalculating layout
    console.log('[recalculateLayout] Auto-fitting content');
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

// Function to load children data for a person
const loadChildrenData = async (personId) => {
  const person = findPersonById(personId, familyData);
  if (!person) {
    console.error(`[loadChildrenData] Person with ID ${personId} not found`);
    return;
  }
  
  console.log(`[loadChildrenData] Loading children for person:`, {
    id: person.id,
    name: person.name,
    position: { ...person.position },
    currentChildrenCount: person.children ? person.children.length : 0,
    hasChildrenToLoad: person.hasChildrenToLoad
  });
  
  // Set loading state
  isLoadingChildren.value = true;
  
  try {
    // Simulate API call to fetch children data
    console.log(`[loadChildrenData] Waiting for API response...`);
    await wait(1000);
    
    // Mock data for demonstration - in a real app, this would come from an API
    const mockChildrenData = [
      {
        id: `${personId}-child-1`,
        name: `${person.name}的子女1`,
        title: '长子',
        generation: person.generation + 1,
        type: 'child',
        position: { x: 0, y: 0 },
        children: []
      },
      {
        id: `${personId}-child-2`,
        name: `${person.name}的子女2`,
        title: '次子',
        generation: person.generation + 1,
        type: 'child',
        position: { x: 0, y: 0 },
        children: []
      },
      {
        id: `${personId}-child-3`,
        name: `${person.name}的子女3`,
        title: '三子',
        generation: person.generation + 1,
        type: 'child',
        position: { x: 0, y: 0 },
        children: []
      }
    ];
    
    console.log(`[loadChildrenData] Mock children data created:`, mockChildrenData);
    
    // Initialize children array if it doesn't exist
    if (!person.children) {
      person.children = [];
      console.log(`[loadChildrenData] Initialized empty children array for person ${person.id}`);
    }
    
    // Log the parent's position before adding children
    console.log(`[loadChildrenData] Parent position before adding children:`, { 
      x: person.position.x, 
      y: person.position.y 
    });
    
    // Add the new children to the person's children array
    person.children.push(...mockChildrenData);
    console.log(`[loadChildrenData] Added ${mockChildrenData.length} children to person ${person.id}`);
    console.log(`[loadChildrenData] New children array:`, person.children);
    
    // Mark as expanded
    person.collapsed = false;
    console.log(`[loadChildrenData] Set collapsed to false for person ${person.id}`);
    
    // Remove the hasChildrenToLoad flag since we've loaded the children
    person.hasChildrenToLoad = false;
    console.log(`[loadChildrenData] Set hasChildrenToLoad to false for person ${person.id}`);
    
    // 关键修复：重新初始化LayoutEngine以更新内部数据
    console.log(`[loadChildrenData] Reinitializing LayoutEngine to update internal data`);
    layoutEngine = new LayoutEngine(familyData);
    
    // Log before recalculating layout
    console.log(`[loadChildrenData] Before recalculating layout - parent and children:`, {
      parent: {
        id: person.id,
        position: { ...person.position }
      },
      children: person.children.map(child => ({
        id: child.id,
        position: { ...child.position }
      }))
    });
    
    // Recalculate layout to position new nodes
    console.log(`[loadChildrenData] Calling recalculateLayout()`);
    recalculateLayout();
    
    // Log after recalculating layout (will execute before the actual recalculation due to async nature)
    setTimeout(() => {
      console.log(`[loadChildrenData] After recalculateLayout - parent and children positions:`, {
        parent: {
          id: person.id,
          position: { ...person.position }
        },
        children: person.children.map(child => ({
          id: child.id,
          position: { ...child.position }
        }))
      });
      
      // Check if layout engine positioned the children
      if (layoutEngine) {
        console.log(`[loadChildrenData] LayoutEngine state:`, {
          initialized: !!layoutEngine,
          familyDataCount: layoutEngine.familyData.length
        });
      }
    }, 100);
    
  } catch (error) {
    console.error('[loadChildrenData] Error loading children data:', error);
  } finally {
    // Clear loading state
    isLoadingChildren.value = false;
    console.log(`[loadChildrenData] Loading state cleared`);
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