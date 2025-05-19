import { jsPlumb } from 'jsplumb';
import { wait } from '../utils/domUtils';
import { getSpouses, getChildren, findPersonById } from './FamilyData';

// Constants for layouts
const CARD_WIDTH = 170;
const CARD_HEIGHT = 220;
const VERTICAL_SPACING = 360;

class ConnectionManager {
  constructor(treeCanvas, familyData, layoutEngine) {
    this.treeCanvas = treeCanvas;
    // 扁平化家族树，将所有人（包括配偶和子女）都放在一个数组中
    this.familyData = this.flattenFamilyTree(familyData);
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
      if (!person._hidden) {
        const children = getChildren(person);
        if (children && children.length > 0) {
          const visibleChildren = children.filter(child => !child._hidden);
          if (visibleChildren.length > 0) {
            childrenByParent[person.id] = visibleChildren;
          }
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
    const parent = findPersonById(parentId, this.familyData);
    
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
    try {
      this.jsPlumbInstance.connect({
        source: 'person-' + parent.id,
        target: 'person-' + child.id,
        anchors: ['BottomCenter', 'TopCenter'],
        connector: ['Straight', { stub: 20 }],
        endpoint: 'Blank',
        overlays: [
          ['Label', { label: '子女', location: 0.5, cssClass: 'child-label' }]
        ]
      });
    } catch (error) {
      console.error(`Error connecting parent ${parent.id} to child ${child.id}:`, error);
    }
  }
  
  // 创建多个子女的连接
  createMultipleChildrenConnections(parent, children, parentBottom, parentCenter) {
    // 找出最左和最右的子女
    const leftmostChild = children.reduce((min, child) => 
      child.position.x < min.position.x ? child : min, children[0]);
    const rightmostChild = children.reduce((max, child) => 
      child.position.x > max.position.x ? child : max, children[0]);
    
    // 计算水平连接线的位置
    const leftX = leftmostChild.position.x + (CARD_WIDTH / 2);
    const rightX = rightmostChild.position.x + (CARD_WIDTH / 2);
    const midY = parentBottom + 60;  // 水平线在父节点下方60px处
    
    // 创建水平连接线
    this.createHorizontalConnectionLine(parent, children, leftX, rightX, midY);
  }
  
  // 创建水平连接线及其与父节点和子节点的连接
  async createHorizontalConnectionLine(parent, children, leftX, rightX, horizLineY) {
    // 创建垂直连接点 (从父节点到水平线)
    const parentVertPointId = 'parent-vert-' + parent.id;
    const parentVertPoint = document.createElement('div');
    parentVertPoint.id = parentVertPointId;
    parentVertPoint.style.position = 'absolute';
    parentVertPoint.style.left = (parent.position.x + (CARD_WIDTH / 2) - 1) + 'px';
    parentVertPoint.style.top = horizLineY + 'px';
    parentVertPoint.style.width = '2px';
    parentVertPoint.style.height = '2px';
    parentVertPoint.style.opacity = '0';
    this.treeCanvas.appendChild(parentVertPoint);
    this.temporaryElements.push(parentVertPointId);
    
    // 创建水平连接线
    const horizLineId = 'horiz-line-' + parent.id;
    const horizLine = document.createElement('div');
    horizLine.id = horizLineId;
    horizLine.style.position = 'absolute';
    horizLine.style.left = leftX + 'px';
    horizLine.style.top = horizLineY + 'px';
    horizLine.style.width = (rightX - leftX) + 'px';
    horizLine.style.height = '2px';
    horizLine.style.backgroundColor = '#6c757d';
    this.treeCanvas.appendChild(horizLine);
    this.temporaryElements.push(horizLineId);
    
    // 垂直连接父节点到水平线
    try {
      this.jsPlumbInstance.connect({
        source: 'person-' + parent.id,
        target: parentVertPointId,
        anchors: ['BottomCenter', 'TopCenter'],
        connector: ['Straight', { stub: 0 }],
        paintStyle: { stroke: '#6c757d', strokeWidth: 3 },
        endpoint: 'Blank',
      });
    } catch (error) {
      console.error(`Error connecting parent to vertical point:`, error);
    }
    
    // 为每个子女创建垂直连接
    for (const child of children) {
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
    
    // 遍历所有人，查找他们的配偶
    this.familyData.forEach(person => {
      if (person._hidden) return;
      
      const spouses = getSpouses(person);
      spouses.forEach(spouse => {
        if (spouse._hidden) return;
        
        // 检查两个配偶元素是否都存在
        const personElement = document.getElementById('person-' + person.id);
        const spouseElement = document.getElementById('person-' + spouse.id);
        
        if (personElement && spouseElement) {
          const promise = new Promise((resolve) => {
            setTimeout(() => {
              try {
                this.jsPlumbInstance.connect({
                  source: 'person-' + person.id,
                  target: 'person-' + spouse.id,
                  anchor: [['Right'], ['Left']],
                  connector: ['Straight', { gap: 15 }],
                  overlays: [
                    ['Label', { label: '配偶', location: 0.5, cssClass: 'spouse-label' }]
                  ],
                  paintStyle: { stroke: '#e74c7c', strokeWidth: 2, dashstyle: '3 2' },
                  endpoint: 'Blank'
                });
              } catch (error) {
                console.error(`Error connecting spouse ${person.id} to ${spouse.id}:`, error);
              }
              resolve();
            }, 50);
          });
          
          connectionPromises.push(promise);
        }
      });
    });
    
    await Promise.all(connectionPromises);
  }

  // 扁平化家族树的辅助方法
  flattenFamilyTree(data) {
    const flattened = [];
    
    const flatten = (people) => {
      if (!people || !people.length) return;
      
      for (const person of people) {
        flattened.push(person);
        
        if (person.children && person.children.length > 0) {
          flatten(person.children);
        }
      }
    };
    
    flatten(data);
    return flattened;
  }
}

export default ConnectionManager; 