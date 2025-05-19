import { jsPlumb } from 'jsplumb';
import { wait } from '../utils/domUtils';

// Constants for layouts
const CARD_WIDTH = 170;
const CARD_HEIGHT = 220;
const VERTICAL_SPACING = 360;

class ConnectionManager {
  constructor(treeCanvas, familyData, spouseRelationships, layoutEngine) {
    this.treeCanvas = treeCanvas;
    this.familyData = familyData;
    this.spouseRelationships = spouseRelationships;
    this.layoutEngine = layoutEngine;
    this.jsPlumbInstance = null;
    
    // 用于跟踪创建的临时连接点元素
    this.temporaryElements = [];
    
    // 初始化尝试次数
    this.initAttempts = 0;
    this.maxInitAttempts = 5;
  }

  // Initialize JSPlumb instance
  initialize() {
    // 如果已经初始化，则先重置
    if (this.jsPlumbInstance) {
      this.jsPlumbInstance.reset();
      this.cleanupTemporaryElements();
    }
    
    // 创建新的JSPlumb实例
    this.jsPlumbInstance = jsPlumb.getInstance({
      DragOptions: { cursor: 'pointer', zIndex: 2000 },
      PaintStyle: { stroke: '#6c757d', strokeWidth: 2.5 },
      EndpointStyle: { radius: 6, fill: '#6c757d' },
      HoverPaintStyle: { stroke: '#007bff', strokeWidth: 3 },
      Container: this.treeCanvas
    });
  }

  // 清除临时创建的连接点元素
  cleanupTemporaryElements() {
    this.temporaryElements.forEach(elementId => {
      const element = document.getElementById(elementId);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.temporaryElements = [];
  }

  // Refresh all connections
  updateConnections() {
    if (this.jsPlumbInstance) {
      this.jsPlumbInstance.repaintEverything();
    }
  }

  // Reset and reinitialize connections
  reset() {
    // 重置尝试次数
    this.initAttempts = 0;
    
    if (this.jsPlumbInstance) {
      this.jsPlumbInstance.reset();
      this.cleanupTemporaryElements();
      this.initializeConnections();
    }
  }

  // 等待一段时间后重试初始化连接
  async retryInitConnections() {
    if (this.initAttempts < this.maxInitAttempts) {
      this.initAttempts++;
      console.log(`Retrying connection initialization (attempt ${this.initAttempts}/${this.maxInitAttempts})...`);
      
      // 增加渐进式的等待时间
      await wait(100 * this.initAttempts);
      this.initializeConnections();
    } else {
      console.warn('Max connection initialization attempts reached. Some connections may be missing.');
    }
  }

  // Initialize all connections
  initializeConnections() {
    // 清理现有连接和临时元素
    if (this.jsPlumbInstance) {
      this.jsPlumbInstance.deleteEveryConnection();
      this.cleanupTemporaryElements();
    } else {
      this.initialize();
    }

    // 确保所有节点元素都存在
    const visiblePersons = this.familyData.filter(person => !person._hidden);
    const allNodesExist = visiblePersons.every(person => {
      const el = document.getElementById('person-' + person.id);
      return el !== null;
    });
    
    if (!allNodesExist) {
      console.warn('Not all person nodes exist in DOM yet. Retrying...');
      this.retryInitConnections();
      return;
    }

    // 创建父子连接
    this.createAllFamilyConnections();
    
    // 创建夫妻连接
    this.connectSpouses();
    
    // 重绘所有连接
    setTimeout(() => {
      if (this.jsPlumbInstance) {
        this.jsPlumbInstance.repaintEverything();
      }
    }, 50);
  }

  // 创建所有家庭连接
  createAllFamilyConnections() {
    // 按父亲ID分组子女
    const childrenByParent = {};
    
    // 收集所有可见的父子关系
    this.familyData.forEach(person => {
      if (person.parent && !person._hidden) {
        const parent = this.familyData.find(p => p.id === person.parent);
        if (parent && !parent._hidden) {
          if (!childrenByParent[parent.id]) {
            childrenByParent[parent.id] = [];
          }
          childrenByParent[parent.id].push(person);
        }
      }
    });
    
    // 为每个父亲创建与子女的连接
    Object.keys(childrenByParent).forEach(parentId => {
      const children = childrenByParent[parentId];
      if (children && children.length > 0) {
        this.createParentChildConnections(parseInt(parentId), children);
      }
    });
  }

  // Connect a parent to their children
  createParentChildConnections(parentId, children) {
    const parent = this.familyData.find(p => p.id === parentId);
    
    if (!parent || children.length === 0) return;
    
    // 检查父节点元素是否存在
    const parentElement = document.getElementById('person-' + parent.id);
    if (!parentElement) {
      console.warn(`Parent element not found for ID: ${parent.id}`);
      return;
    }
    
    // Calculate parent connection point (bottom center)
    const parentBottom = parent.position.y + CARD_HEIGHT;
    const parentCenter = parent.position.x + (CARD_WIDTH / 2);
    
    // If there's only one child, connect directly
    if (children.length === 1) {
      this.createSingleChildConnection(parent, children[0], parentCenter);
    } else {
      this.createMultipleChildrenConnections(parent, children, parentBottom, parentCenter);
    }
  }
  
  // 创建单个子女的连接
  createSingleChildConnection(parent, child, parentCenter) {
    // 确保子女位于父母正下方以便垂直连线
    child.position.x = parent.position.x;
    
    // 移动子女的配偶
    const childSpouseIds = this.layoutEngine.getSpouseIds(child.id);
    let lastSpousePosition = child.position.x;
    
    childSpouseIds.forEach(spouseId => {
      const spouse = this.familyData.find(p => p.id === spouseId);
      if (spouse) {
        lastSpousePosition += 220; // SPOUSE_SPACING
        spouse.position.x = lastSpousePosition;
      }
    });
    
    // 检查元素是否存在
    const childElement = document.getElementById('person-' + child.id);
    
    if (!childElement) {
      console.warn(`Child element not found for ID: ${child.id}`);
      return;
    }
    
    // 创建父子连接
    this.jsPlumbInstance.connect({
      source: 'person-' + parent.id,
      target: 'person-' + child.id,
      anchor: ['Bottom', 'Top'],
      connector: ['Straight', { stub: 10 }],
      paintStyle: { stroke: '#555', strokeWidth: 3 },
      deleteEndpointsOnDetach: false,
      endpoint: 'Blank',
      overlays: [
        ['Label', { 
          label: '子女', 
          location: 0.5, 
          cssClass: 'child-label',
          id: 'relation-label'
        }]
      ]
    });
  }
  
  // 创建多个子女的连接（含水平连接线）
  createMultipleChildrenConnections(parent, children, parentBottom, parentCenter) {
    // 按x坐标排序子女
    children.sort((a, b) => a.position.x - b.position.x);
    
    children.forEach(child => {
      // 确保子女元素存在
      if (!document.getElementById('person-' + child.id)) {
        console.warn(`Child element not found for ID: ${child.id}`);
        return;
      }
    });
    
    // 找出最左边和最右边的子女位置
    const leftmostChild = children[0];
    const rightmostChild = children[children.length - 1];
    
    const leftX = leftmostChild.position.x + (CARD_WIDTH / 2);
    const rightX = rightmostChild.position.x + (CARD_WIDTH / 2);
    
    // 计算水平连接线的Y坐标
    const midY = parentBottom + (VERTICAL_SPACING / 3);
    
    // 创建水平连接线
    this.createHorizontalConnectionLine(parent, children, leftX, rightX, midY);
  }

  // Create a horizontal connection line between siblings
  async createHorizontalConnectionLine(parent, children, leftX, rightX, midY) {
    // 检查父节点元素是否存在
    const parentElement = document.getElementById('person-' + parent.id);
    if (!parentElement) return;
    
    // 创建从父节点到中点的垂直线
    const parentCenterX = parent.position.x + (CARD_WIDTH / 2);
    console.log('parent.position.x', parent.position.x);
    console.log('CARD_WIDTH', CARD_WIDTH);
    console.log('parentCenterX', parentCenterX);
    console.log('leftX', leftX);
    const tempDivId = 'temp-' + parent.id;
    const tempDiv = document.createElement('div');
    tempDiv.id = tempDivId;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = parentCenterX + 'px';
    tempDiv.style.top = midY + 'px';
    tempDiv.style.width = '2px';
    tempDiv.style.height = '2px';
    tempDiv.style.opacity = '0';
    this.treeCanvas.appendChild(tempDiv);
    this.temporaryElements.push(tempDivId);
    
    // 等待一点时间确保DOM更新
    await wait(10);
    
    // 收集所有子女的中心X坐标
    const childCentersX = [];
    for (const child of children) {
      if (document.getElementById('person-' + child.id)) {
        childCentersX.push(child.position.x + (CARD_WIDTH / 2));
      }
    }
    
    if (childCentersX.length === 0) return;
    
    // 找出最左边和最右边的子女中心X坐标
    const leftmostX = Math.min(...childCentersX);
    const rightmostX = Math.max(...childCentersX);
    
    // 水平线上方20px的Y坐标（所有子女卡片顶部上方20px处）
    const horizLineY = children[0].position.y - 20;
    
    // 创建水平线的左右端点
    const leftHorizPointId = 'horiz-left-' + parent.id;
    const rightHorizPointId = 'horiz-right-' + parent.id;
    
    // 左端点
    const leftHorizPoint = document.createElement('div');
    leftHorizPoint.id = leftHorizPointId;
    leftHorizPoint.style.position = 'absolute';
    leftHorizPoint.style.left = leftmostX + 'px';
    leftHorizPoint.style.top = horizLineY + 'px';
    leftHorizPoint.style.width = '2px';
    leftHorizPoint.style.height = '2px';
    leftHorizPoint.style.opacity = '0';
    this.treeCanvas.appendChild(leftHorizPoint);
    this.temporaryElements.push(leftHorizPointId);
    
    // 右端点
    const rightHorizPoint = document.createElement('div');
    rightHorizPoint.id = rightHorizPointId;
    rightHorizPoint.style.position = 'absolute';
    rightHorizPoint.style.left = rightmostX + 'px';
    rightHorizPoint.style.top = horizLineY + 'px';
    rightHorizPoint.style.width = '2px';
    rightHorizPoint.style.height = '2px';
    rightHorizPoint.style.opacity = '0';
    this.treeCanvas.appendChild(rightHorizPoint);
    this.temporaryElements.push(rightHorizPointId);
    
    // 创建父节点到水平线的垂直连接点
    const parentVertPointId = 'parent-vert-' + parent.id;
    const parentVertPoint = document.createElement('div');
    parentVertPoint.id = parentVertPointId;
    parentVertPoint.style.position = 'absolute';
    parentVertPoint.style.left = parentCenterX + 'px';
    parentVertPoint.style.top = horizLineY + 'px'; // 与水平线同高
    parentVertPoint.style.width = '2px';
    parentVertPoint.style.height = '2px';
    parentVertPoint.style.opacity = '0';
    this.treeCanvas.appendChild(parentVertPoint);
    this.temporaryElements.push(parentVertPointId);
    
    // 垂直连接父节点到水平线
    try {
      // 父节点到垂直连接点
      this.jsPlumbInstance.connect({
        source: 'person-' + parent.id,
        target: parentVertPointId,
        anchors: ['BottomCenter', 'TopCenter'],
        connector: ['Straight', { stub: 0 }],
        paintStyle: { stroke: '#555', strokeWidth: 3 },
        endpoint: 'Blank',
      });
    } catch (error) {
      console.error(`Error connecting parent to vertical point:`, error);
    }
    
    // 水平连接：左端点到右端点
    try {
      this.jsPlumbInstance.connect({
        source: leftHorizPointId,
        target: rightHorizPointId,
        anchors: ['Center', 'Center'],
        connector: ['Straight', { stub: 0 }],
        paintStyle: { stroke: '#555', strokeWidth: 3 },
        endpoint: 'Blank',
        overlays: [
          ['Label', { 
            label: '子女', 
            location: 0.5, 
            cssClass: 'child-label',
            id: 'relation-label'
          }]
        ]
      });
      console.log("Created horizontal connection from", leftHorizPointId, "to", rightHorizPointId);
    } catch (error) {
      console.error(`Error connecting horizontal line:`, error);
    }
    
    // 若父节点连接点不在水平线上，则需要额外连接
    if (parentCenterX < leftmostX || parentCenterX > rightmostX) {
      try {
        // 确定连接到哪个点（左边还是右边）
        const targetPointId = (Math.abs(parentCenterX - leftmostX) < Math.abs(parentCenterX - rightmostX)) 
          ? leftHorizPointId : rightHorizPointId;
        
        this.jsPlumbInstance.connect({
          source: parentVertPointId,
          target: targetPointId,
          anchors: ['Center', 'Center'],
          connector: ['Straight', { stub: 0 }],
          paintStyle: { stroke: '#555', strokeWidth: 3 },
          endpoint: 'Blank',
        });
        console.log("Connected parent vertical point to", targetPointId);
      } catch (error) {
        console.error(`Error connecting parent vertical point to horizontal line:`, error);
      }
    }
    
    // 为每个子女创建到水平线的垂直连接
    for (const child of children) {
      // 检查子女元素是否存在
      const childElement = document.getElementById('person-' + child.id);
      if (!childElement) continue;
      
      const childCenterX = child.position.x + (CARD_WIDTH / 2);
      
      // 创建子女上的垂直连接点
      const childVertPointId = 'child-vert-' + child.id;
      const childVertPoint = document.createElement('div');
      childVertPoint.id = childVertPointId;
      childVertPoint.style.position = 'absolute';
      childVertPoint.style.left = childCenterX + -1 + 'px';
      childVertPoint.style.top = horizLineY + 'px'; // 与水平线同高
      childVertPoint.style.width = '2px';
      childVertPoint.style.height = '2px';
      childVertPoint.style.opacity = '0';
      this.treeCanvas.appendChild(childVertPoint);
      this.temporaryElements.push(childVertPointId);
      
      // 垂直连接子女到水平线
      try {
        this.jsPlumbInstance.connect({
          source: childVertPointId,
          target: 'person-' + child.id,
          anchors: ['BottomCenter', 'TopCenter'],
          connector: ['Straight', { stub: 0 }],
          paintStyle: { stroke: '#555', strokeWidth: 3 },
          endpoint: 'Blank',
        });
      } catch (error) {
        console.error(`Error connecting child to vertical point:`, error);
      }
    }
  }

  // Connect spouses
  async connectSpouses() {
    const connectionPromises = [];
    
    this.spouseRelationships.forEach(([husband, wife]) => {
      const husbandPerson = this.familyData.find(p => p.id === husband);
      const wifePerson = this.familyData.find(p => p.id === wife);
      
      if (husbandPerson && wifePerson && !husbandPerson._hidden && !wifePerson._hidden) {
        // 检查两个配偶元素是否都存在
        const husbandElement = document.getElementById('person-' + husband);
        const wifeElement = document.getElementById('person-' + wife);
        
        if (husbandElement && wifeElement) {
          const promise = new Promise((resolve) => {
            setTimeout(() => {
              try {
                this.jsPlumbInstance.connect({
                  source: 'person-' + husband,
                  target: 'person-' + wife,
                  anchor: [['Right'], ['Left']],
                  connector: ['Straight', { gap: 15 }],
                  overlays: [
                    ['Label', { label: '配偶', location: 0.5, cssClass: 'spouse-label' }]
                  ],
                  paintStyle: { stroke: '#e74c7c', strokeWidth: 2, dashstyle: '3 2' },
                  endpoint: 'Blank'
                });
              } catch (error) {
                console.error(`Error connecting spouse ${husband} to ${wife}:`, error);
              }
              resolve();
            }, 50);
          });
          
          connectionPromises.push(promise);
        }
      }
    });
    
    await Promise.all(connectionPromises);
  }
}

export default ConnectionManager; 