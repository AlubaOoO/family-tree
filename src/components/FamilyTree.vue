<template>
  <div
    class="family-tree-container"
    :class="{ 'fullscreen-mode': isFullScreen }"
  >
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
      :style="{
        transform: `scale(${zoom})`,
        transformOrigin: '0 0',
        left: canvasPosition.x + 'px',
        top: canvasPosition.y + 'px',
      }"
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
          selected: selectedPerson?.id === person.id,
          hidden: person._hidden,
          'has-children': hasChildren(person.id),
          collapsed: person.collapsed && hasChildren(person.id),
        }"
        :style="{
          left: person.position.x + 'px',
          top: person.position.y + 'px',
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
import { ref, reactive, onMounted, nextTick, onUnmounted, computed } from "vue";
import PersonCard from "./PersonCard.vue";
import TreeControls from "./TreeControls.vue";
import PersonDetails from "./PersonDetails.vue";
import GenerationLabel from "./GenerationLabel.vue";
import LayoutEngine from "../services/LayoutEngine";
import ConnectionManager from "../services/ConnectionManager";
import {
  familyData as rawFamilyData,
  getChildren,
  findPersonById,
} from "../services/FamilyData";
import { wait } from "../utils/domUtils";
import { fetchMockChildrenData } from "../services/FamilyData";



// 将导入的数据转换为响应式数据
const familyData = reactive(processPersonData(rawFamilyData));

// 递归处理人物数据，添加位置和状态属性
function processPersonData(peopleArray) {
  if (!peopleArray || !Array.isArray(peopleArray)) return [];

  return peopleArray.map((person) => {
    // 处理当前人物
    const processedPerson = {
      ...person,
      position: { ...(person.position || { x: 0, y: 0 }) },
      _hidden: false,
      // 使用mockData中的hasChildrenToLoad或默认为false
      hasChildrenToLoad: person.hasChildrenToLoad || false,
      // 如果没有子女数据或者hasChildrenToLoad为true，则默认折叠
      collapsed:
        !person.children ||
        person.children.length === 0 ||
        person.hasChildrenToLoad === true,
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
        maxY: parseFloat(treeCanvasElement.style.height),
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
  const hasActualChildren =
    person.children && person.children.some((child) => child.type === "child");

  // Check if person is marked as having children to load
  const hasChildrenMarkedToLoad = person.hasChildrenToLoad === true;

  return hasActualChildren || hasChildrenMarkedToLoad;
};

// Function to toggle collapse state of a subtree
const toggleCollapse = (person) => {
  if (!hasChildren(person.id)) return;

  // 临时选中这个人，以便在更新布局时保持视图位置
  const previousSelectedPerson = selectedPerson.value;
  selectedPerson.value = person;

  // If person has children data, toggle collapse state
  if (
    person.children &&
    person.children.some((child) => child.type === "child")
  ) {
    person.collapsed = !person.collapsed;

    // 更新可见性同时保持视图位置
    updateVisibility();

    // 使用 nextTick 确保 DOM 更新后再更新连接
    nextTick(() => {
      // 在更新连接前彻底清理
      cleanupJsPlumbElements();
      updateConnections();

      // 如果之前有选中的人物且不是当前操作的人物，恢复选中状态
      if (previousSelectedPerson !== person) {
        selectedPerson.value = previousSelectedPerson;
      }
    });
  } else if (person.hasChildrenToLoad) {
    // If person has children to load but not loaded yet, load them
    loadChildrenData(person.id);

    // loadChildrenData 函数会处理视图位置保持，这里不需要额外处理
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
const recalculateLayout = (preserveView = false) => {
  if (!layoutEngine) {
    console.warn("[recalculateLayout] Layout engine not initialized");
    return;
  }

  console.log("[recalculateLayout] Starting layout recalculation");

  // 保存当前视图状态，如果需要保留
  let currentZoom, currentPosition, focusNodePosition;

  if (preserveView && selectedPerson.value) {
    currentZoom = zoom.value;
    currentPosition = {
      x: canvasPosition.x,
      y: canvasPosition.y,
    };

    // 如果有选定的人物，保存其当前位置
    focusNodePosition = {
      x: selectedPerson.value.position.x,
      y: selectedPerson.value.position.y,
    };

    console.log(
      "[recalculateLayout] Saved current view state for preservation",
      {
        zoom: currentZoom,
        position: currentPosition,
        focusNodePosition,
      }
    );
  }

  // 记录重新计算前的一些关键节点位置
  if (selectedPerson.value) {
    console.log(
      "[recalculateLayout] Selected person position before recalculation:",
      {
        id: selectedPerson.value.id,
        name: selectedPerson.value.name,
        position: { ...selectedPerson.value.position },
      }
    );

    // 如果选中的人有子女，也记录它们的位置
    if (
      selectedPerson.value.children &&
      selectedPerson.value.children.length > 0
    ) {
      console.log(
        "[recalculateLayout] Selected person's children before recalculation:",
        selectedPerson.value.children.map((child) => ({
          id: child.id,
          name: child.name,
          position: { ...child.position },
        }))
      );
    }
  }

  console.log("[recalculateLayout] Calling layoutEngine.calculatePositions()");
  const dimensions = layoutEngine.calculatePositions();

  // 记录重新计算后的一些关键节点位置
  if (selectedPerson.value) {
    console.log(
      "[recalculateLayout] Selected person position after recalculation:",
      {
        id: selectedPerson.value.id,
        name: selectedPerson.value.name,
        position: { ...selectedPerson.value.position },
      }
    );

    // 如果选中的人有子女，也记录它们的位置
    if (
      selectedPerson.value.children &&
      selectedPerson.value.children.length > 0
    ) {
      console.log(
        "[recalculateLayout] Selected person's children after recalculation:",
        selectedPerson.value.children.map((child) => ({
          id: child.id,
          name: child.name,
          position: { ...child.position },
        }))
      );
    }
  }

  console.log("[recalculateLayout] Updating visibility");
  updateVisibility();

  console.log("[recalculateLayout] Updating generation labels");
  updateGenerationLabels();

  nextTick(() => {
    console.log("[recalculateLayout] Updating canvas dimensions:", dimensions);
    updateCanvasDimensions(dimensions);

    console.log("[recalculateLayout] Updating connections");
    // 彻底清理旧的连接线和相关元素
    if (connectionManager) {
      // 清除jsPlumb相关的DOM元素
      const jsPlumbElements = document.querySelectorAll('.jtk-endpoint, .jtk-connector, .jtk-overlay, .jtk-bezier');
      jsPlumbElements.forEach(element => {
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
    }
    updateConnections();

    // 如果需要保留视图位置
    if (preserveView && selectedPerson.value && focusNodePosition) {
      // 计算节点在重新布局后的新位置
      const newFocusNodePosition = {
        x: selectedPerson.value.position.x,
        y: selectedPerson.value.position.y,
      };

      // 计算偏移量，以保持节点在视野中的相对位置
      const offsetX =
        (newFocusNodePosition.x - focusNodePosition.x) * currentZoom;
      const offsetY =
        (newFocusNodePosition.y - focusNodePosition.y) * currentZoom;

      // 应用偏移量，调整视图位置
      canvasPosition.x = currentPosition.x - offsetX;
      canvasPosition.y = currentPosition.y - offsetY;

      // 恢复缩放级别
      zoom.value = currentZoom;

      console.log("[recalculateLayout] Restored view with position:", {
        originalPosition: currentPosition,
        newPosition: { x: canvasPosition.x, y: canvasPosition.y },
        offset: { x: offsetX, y: offsetY },
      });
    } else {
      // Auto-fit content after recalculating layout (only if not preserving view)
      console.log("[recalculateLayout] Auto-fitting content");
      autoFitContent(dimensions);
    }
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
    // 先全局清理所有残留的连接线
    cleanupJsPlumbElements();
    
    // 直接使用现有的连接管理器重置和更新连接
    // 而不是每次都创建新的连接管理器实例
    connectionManager.reset();
  }
};

// Zoom controls
const zoomIn = (event) => {
  // 如果提供了事件对象（通过鼠标操作），使用鼠标位置为中心点缩放
  if (event && event.clientX !== undefined) {
    const newZoom = Math.min(zoom.value + 0.1, 2.0);
    zoomAtMouse(event, newZoom);
  } else {
    // 没有事件对象（通过按钮操作），使用中心点缩放
    zoom.value = Math.min(zoom.value + 0.1, 2.0);
    updateConnections();
  }
};

const zoomOut = (event) => {
  // 如果提供了事件对象（通过鼠标操作），使用鼠标位置为中心点缩放
  if (event && event.clientX !== undefined) {
    const newZoom = Math.max(zoom.value - 0.1, 0.3);
    zoomAtMouse(event, newZoom);
  } else {
    // 没有事件对象（通过按钮操作），使用中心点缩放
    zoom.value = Math.max(zoom.value - 0.1, 0.3);
    updateConnections();
  }
};

// 以鼠标位置为中心点进行缩放
const zoomAtMouse = (event, newZoom) => {
  if (!treeCanvas.value) return;

  // 获取鼠标相对于视口的坐标
  const mouseX = event.clientX;
  const mouseY = event.clientY;

  // 获取容器的边界矩形
  const containerRect = treeCanvas.value.parentElement.getBoundingClientRect();

  // 计算鼠标相对于容器的坐标
  const mouseXRelative = mouseX - containerRect.left;
  const mouseYRelative = mouseY - containerRect.top;

  // 计算鼠标在画布上的实际位置（考虑到当前缩放和位置）
  const mouseOnCanvasX = (mouseXRelative - canvasPosition.x) / zoom.value;
  const mouseOnCanvasY = (mouseYRelative - canvasPosition.y) / zoom.value;

  // 记录旧的缩放值
  const oldZoom = zoom.value;

  // 更新缩放值
  zoom.value = newZoom;

  // 更新画布位置，以保持鼠标位置下的点不变
  canvasPosition.x = mouseXRelative - mouseOnCanvasX * newZoom;
  canvasPosition.y = mouseYRelative - mouseOnCanvasY * newZoom;

  // 更新连接
  updateConnections();

  console.log(`Zoomed at mouse position: (${mouseX}, ${mouseY}), new zoom: ${newZoom}, position: (${canvasPosition.x}, ${canvasPosition.y})`);
};

const resetZoom = () => {
  if (layoutEngine && treeCanvas.value) { // Check if layoutEngine is initialized
    const dimensions = layoutEngine.calculatePositions(); // Get dimensions from layoutEngine
    autoFitContent(dimensions);
  } else if (treeCanvas.value) { // Fallback if layoutEngine is not available
    const treeCanvasElement = treeCanvas.value;
    const dimensions = {
      maxX: parseFloat(treeCanvasElement.style.width),
      maxY: parseFloat(treeCanvasElement.style.height),
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
    event.preventDefault();
    
    if (event.deltaY < 0) {
      zoomIn(event);
    } else {
      zoomOut(event);
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
  // 保存当前视图状态
  const currentZoom = zoom.value;
  const currentPosition = {
    x: canvasPosition.x,
    y: canvasPosition.y,
  };

  // 获取一个参考节点（如果有选中的节点就用选中的，否则用第一个节点）
  const referenceNode = selectedPerson.value || familyData[0];
  const referencePosition = referenceNode
    ? { ...referenceNode.position }
    : null;

  console.log("[collapseAll] Saved view state before collapsing all:", {
    zoom: currentZoom,
    position: currentPosition,
    referenceNode: referenceNode?.id,
    referencePosition,
  });

  // 折叠所有子树
  familyData.forEach((person) => {
    if (hasChildren(person.id)) {
      person.collapsed = true;
    }
  });

  // 更新可见性
  updateVisibility();

  // 等待 DOM 更新后恢复视图位置
  nextTick(() => {
    if (referenceNode && referencePosition) {
      // 计算参考节点在更新后的新位置
      const newReferencePosition = { ...referenceNode.position };

      // 计算位置偏移量
      const offsetX =
        (newReferencePosition.x - referencePosition.x) * currentZoom;
      const offsetY =
        (newReferencePosition.y - referencePosition.y) * currentZoom;

      // 应用偏移量，调整视图位置
      canvasPosition.x = currentPosition.x - offsetX;
      canvasPosition.y = currentPosition.y - offsetY;

      // 恢复缩放级别
      zoom.value = currentZoom;

      console.log("[collapseAll] Restored view state with offset:", {
        originalPosition: currentPosition,
        newPosition: { x: canvasPosition.x, y: canvasPosition.y },
        offset: { x: offsetX, y: offsetY },
      });
    }

    updateConnections();
  });
};

// Expand all subtrees
const expandAll = () => {
  // 保存当前视图状态
  const currentZoom = zoom.value;
  const currentPosition = {
    x: canvasPosition.x,
    y: canvasPosition.y,
  };

  // 获取一个参考节点（如果有选中的节点就用选中的，否则用第一个节点）
  const referenceNode = selectedPerson.value || familyData[0];
  const referencePosition = referenceNode
    ? { ...referenceNode.position }
    : null;

  console.log("[expandAll] Saved view state before expanding all:", {
    zoom: currentZoom,
    position: currentPosition,
    referenceNode: referenceNode?.id,
    referencePosition,
  });

  // 展开所有子树
  familyData.forEach((person) => {
    if (hasChildren(person.id)) {
      person.collapsed = false;
    }
  });

  // 更新可见性
  updateVisibility();

  // 等待 DOM 更新后恢复视图位置
  nextTick(() => {
    if (referenceNode && referencePosition) {
      // 计算参考节点在更新后的新位置
      const newReferencePosition = { ...referenceNode.position };

      // 计算位置偏移量
      const offsetX =
        (newReferencePosition.x - referencePosition.x) * currentZoom;
      const offsetY =
        (newReferencePosition.y - referencePosition.y) * currentZoom;

      // 应用偏移量，调整视图位置
      canvasPosition.x = currentPosition.x - offsetX;
      canvasPosition.y = currentPosition.y - offsetY;

      // 恢复缩放级别
      zoom.value = currentZoom;

      console.log("[expandAll] Restored view state with offset:", {
        originalPosition: currentPosition,
        newPosition: { x: canvasPosition.x, y: canvasPosition.y },
        offset: { x: offsetX, y: offsetY },
      });
    }

    updateConnections();
  });
};

// Handle canvas drag start
const startCanvasDrag = (event) => {
  if (event.target === treeCanvas.value) {
    isDraggingCanvas.value = true;
    dragStart.x = event.clientX - canvasPosition.x;
    dragStart.y = event.clientY - canvasPosition.y;
    treeCanvas.value.style.cursor = "grabbing";
  }
};

// Handle canvas dragging
const dragCanvas = (event) => {
  if (isDraggingCanvas.value) {
    canvasPosition.x = event.clientX - dragStart.x;
    canvasPosition.y = event.clientY - dragStart.y;
    treeCanvas.value.style.left = canvasPosition.x + "px";
    treeCanvas.value.style.top = canvasPosition.y + "px";
  }
};

// Handle canvas drag end
const endCanvasDrag = () => {
  isDraggingCanvas.value = false;
  if (treeCanvas.value) {
    treeCanvas.value.style.cursor = "grab";
  }
};

// 自动缩放画布以显示全部内容
const autoFitContent = (dimensions) => {
  if (!treeCanvas.value) return;

  // 获取容器尺寸
  const containerWidth = treeCanvas.value.parentElement.clientWidth;
  const containerHeight = treeCanvas.value.parentElement.clientHeight;

  // 计算水平和垂直方向的缩放比例 - 增加边距到100px确保边缘卡片完全可见
  const horizontalScale = (containerWidth - 100) / dimensions.maxX;
  const verticalScale = (containerHeight - 100) / dimensions.maxY;

  // 选择较小的缩放比例，确保完全显示树
  const newScale = Math.min(horizontalScale, verticalScale, 1.0);

  // 更新缩放级别，不超过1.0，且不低于0.3以避免过小
  zoom.value = Math.max(0.3, Math.min(newScale, 1.0));

  // 计算居中位置 - 这里我们不强制非负值，允许负值以确保完全显示整个树
  const centerX = (containerWidth - dimensions.maxX * zoom.value) / 2;
  const centerY = (containerHeight - dimensions.maxY * zoom.value) / 2;

  // 更新画布位置 - 移除Math.max(0, ...)以允许负值定位
  canvasPosition.x = centerX;
  canvasPosition.y = centerY;

  console.log(
    `Auto-fit: scale=${zoom.value}, position=(${canvasPosition.x}, ${canvasPosition.y}), dimensions=(${dimensions.maxX}, ${dimensions.maxY})`
  );

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
    connectionManager = new ConnectionManager(
      treeCanvas.value,
      familyData,
      layoutEngine
    );
    connectionManager.initialize();

    // 12. 等待DOM更新
    await nextTick();

    // 13. 构建连接
    await connectionManager.initializeConnections();

    if (treeCanvas.value) {
      treeCanvas.value.style.cursor = "grab";
    }

    // 14. 连接完成
    isConnectingNodes.value = false;

    // 15. 自动缩放画布以显示全部内容
    await nextTick();
    autoFitContent(dimensions);
  } catch (error) {
    console.error("Failed to initialize family tree:", error);
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
      maxY: parseFloat(treeCanvas.value.style.height),
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
    hasChildrenToLoad: person.hasChildrenToLoad,
  });

  // Set loading state
  isLoadingChildren.value = true;

  try {
    // Simulate API call to fetch children data
    console.log(`[loadChildrenData] Waiting for API response...`);
    await wait(1000);

    const mockChildrenData = fetchMockChildrenData(person)
    // Process the mock children data to ensure proper initialization of all properties
    const processedChildrenData = mockChildrenData.map((child) => ({
      ...child,
      // Ensure collapsed is set correctly based on hasChildrenToLoad
      collapsed:
        child.hasChildrenToLoad === true ||
        !child.children ||
        child.children.length === 0,
    }));

    console.log(
      `[loadChildrenData] Mock children data created:`,
      processedChildrenData
    );

    // Initialize children array if it doesn't exist
    if (!person.children) {
      person.children = [];
      console.log(
        `[loadChildrenData] Initialized empty children array for person ${person.id}`
      );
    }

    // Log the parent's position before adding children
    console.log(`[loadChildrenData] Parent position before adding children:`, {
      x: person.position.x,
      y: person.position.y,
    });

    // Add the new children to the person's children array
    person.children.push(...processedChildrenData);
    console.log(
      `[loadChildrenData] Added ${processedChildrenData.length} children to person ${person.id}`
    );
    console.log(`[loadChildrenData] New children array:`, person.children);

    // Mark as expanded
    person.collapsed = false;
    console.log(
      `[loadChildrenData] Set collapsed to false for person ${person.id}`
    );

    // Remove the hasChildrenToLoad flag since we've loaded the children
    person.hasChildrenToLoad = false;
    console.log(
      `[loadChildrenData] Set hasChildrenToLoad to false for person ${person.id}`
    );

    // 关键修复：重新初始化LayoutEngine以更新内部数据
    console.log(
      `[loadChildrenData] Reinitializing LayoutEngine to update internal data`
    );
    layoutEngine = new LayoutEngine(familyData);
    
    // 同时重新初始化ConnectionManager以处理新的层级连接
    if (connectionManager) {
      console.log(
        `[loadChildrenData] Reinitializing ConnectionManager to handle new connections`
      );
      
      // 完全清除旧的连接管理器
      connectionManager.jsPlumbInstance.deleteEveryEndpoint();
      connectionManager.jsPlumbInstance.deleteEveryConnection();
      connectionManager.jsPlumbInstance.reset();
      connectionManager.cleanupTemporaryElements();
      
      // 清理所有jsPlumb相关的DOM元素
      const jsPlumbElements = document.querySelectorAll('.jtk-endpoint, .jtk-connector, .jtk-overlay, .jtk-bezier');
      jsPlumbElements.forEach(element => {
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
      
      // 创建全新的连接管理器
      connectionManager = new ConnectionManager(
        treeCanvas.value,
        familyData,
        layoutEngine
      );
      connectionManager.initialize();
    }

    // 临时选中这个人，以便在重新计算布局时保持视图位置
    const previousSelectedPerson = selectedPerson.value;
    selectedPerson.value = person;

    // Log before recalculating layout
    console.log(
      `[loadChildrenData] Before recalculating layout - parent and children:`,
      {
        parent: {
          id: person.id,
          position: { ...person.position },
        },
        children: person.children.map((child) => ({
          id: child.id,
          position: { ...child.position },
        })),
      }
    );

    // 使用更新后的recalculateLayout函数，传入preserveView=true参数
    console.log(
      `[loadChildrenData] Calling recalculateLayout with preserveView=true`
    );
    recalculateLayout(true);

    // 如果之前有选中的人物，恢复选中状态
    if (previousSelectedPerson !== person) {
      nextTick(() => {
        selectedPerson.value = previousSelectedPerson;
      });
    }

    // Log after recalculating layout (will execute before the actual recalculation due to async nature)
    setTimeout(() => {
      console.log(
        `[loadChildrenData] After recalculateLayout - parent and children positions:`,
        {
          parent: {
            id: person.id,
            position: { ...person.position },
          },
          children: person.children.map((child) => ({
            id: child.id,
            position: { ...child.position },
          })),
        }
      );

      // 结束加载状态
      isLoadingChildren.value = false;
    }, 500);
  } catch (error) {
    console.error(`[loadChildrenData] Error loading children:`, error);
    isLoadingChildren.value = false;
  }
};

// Initialize when component is mounted
onMounted(async () => {
  // 设置画布事件监听
  window.addEventListener("mousemove", dragCanvas);
  window.addEventListener("mouseup", endCanvasDrag);
  window.addEventListener("resize", handleResize);

  // 等待下一个渲染周期确保DOM已准备好
  await nextTick();

  // 初始化树布局
  await initializeTreeLayout();
});

// Clean up event listeners when component is unmounted
onUnmounted(() => {
  window.removeEventListener("mousemove", dragCanvas);
  window.removeEventListener("mouseup", endCanvasDrag);
  window.removeEventListener("resize", handleResize);
});

// 全局清理函数，用于清除所有jsPlumb相关的DOM元素
const cleanupJsPlumbElements = () => {
  // 清除所有jsPlumb相关的DOM元素
  const jsPlumbElements = document.querySelectorAll('.jtk-endpoint, .jtk-connector, .jtk-overlay, .jtk-bezier');
  jsPlumbElements.forEach(element => {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });

  // 清除可能遗留的连接线元素（以特定前缀开头的元素）
  const prefixes = ['horiz-line-', 'parent-vert-', 'child-vert-'];
  prefixes.forEach(prefix => {
    const elements = document.querySelectorAll(`[id^="${prefix}"]`);
    elements.forEach(element => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  });
  
  // 清理具有背景色的div（可能是水平连接线）
  const horizontalLines = document.querySelectorAll('div[style*="background-color"]');
  horizontalLines.forEach(element => {
    // 只移除那些看起来像是连接线的元素（高度为2px的元素）
    if (element.style.height === '2px' && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });
};
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

.loading-overlay,
.connecting-overlay {
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
  content: "";
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
