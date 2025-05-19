// Constants for layout
const CARD_WIDTH = 200;
const CARD_HEIGHT = 220;
const HORIZONTAL_SPACING = 40;  // Space between siblings
const VERTICAL_SPACING = 360;   // Space between generations
const SPOUSE_SPACING = 220;     // Space between spouses
const GENERATION_LABEL_WIDTH = 60; // Width of generation label

class LayoutEngine {
  constructor(familyData, spouseRelationships) {
    this.familyData = familyData;
    this.spouseRelationships = spouseRelationships;
    this.generationLabels = []; // 存储世代标记的位置信息
    
    // 确保每个 person 对象都有 _hidden 属性
    this.familyData.forEach(person => {
      if (person._hidden === undefined) {
        person._hidden = false;
      }
    });
  }
  
  // Calculate positions for all family members
  calculatePositions() {
    // 重置所有位置为初始值，确保重新计算是从干净的状态开始
    this.familyData.forEach(person => {
      person.position.x = 0;
      person.position.y = 0;
    });
    
    // Get minimum generation to start from
    const minGen = Math.min(...this.familyData.map(p => p.generation));
    const maxGen = this.getMaxGeneration();
    
    // First, calculate the space needed for each person based on their descendants
    const spaceNeeded = {};
    
    // Process from bottom up (from youngest generation to oldest)
    for (let gen = maxGen; gen >= minGen; gen--) {
      const genPeople = this.getPeopleByGeneration(gen).filter(p => this.isMainPerson(p));
      
      genPeople.forEach(person => {
        // Start with space for this person and their spouses
        const spouseIds = this.getSpouseIds(person.id);
        let width = CARD_WIDTH + (spouseIds.length * SPOUSE_SPACING);
        
        // If this person has children, add up their space
        const children = this.getChildren(person.id);
        if (children.length > 0) {
          const childrenSpace = children.reduce((sum, child) => {
            return sum + (spaceNeeded[child.id] || CARD_WIDTH);
          }, 0);
          
          // Add spacing between children
          const childrenSpacing = (children.length - 1) * HORIZONTAL_SPACING;
          
          // Take the max of current width or children's total width
          width = Math.max(width, childrenSpace + childrenSpacing);
        }
        
        // Store the space needed for this person
        spaceNeeded[person.id] = width;
      });
    }
    
    // 重置世代标记数组
    this.generationLabels = [];
    
    // Now position all people from top to bottom
    for (let gen = minGen; gen <= maxGen; gen++) {
      const genPeople = this.getPeopleByGeneration(gen).filter(p => this.isMainPerson(p));
      
      // Skip if no main people in this generation
      if (genPeople.length === 0) continue;
      
      // Start X position for this generation (add space for generation label)
      let currentX = GENERATION_LABEL_WIDTH + 40;
      
      // Position main people in this generation
      genPeople.forEach((person, index) => {
        // Calculate Y position based on generation
        person.position.y = (gen - minGen) * VERTICAL_SPACING + 50;
        
        // Set X position left-aligned
        person.position.x = currentX;
        
        // Position spouse(s) to the right of the person
        const spouseIds = this.getSpouseIds(person.id);
        let lastSpousePosition = person.position.x;
        
        // Position each spouse beside the main person
        spouseIds.forEach((spouseId, spouseIndex) => {
          const spouse = this.familyData.find(p => p.id === spouseId);
          if (spouse) {
            spouse.position.y = person.position.y; // Same Y level
            spouse.position.x = lastSpousePosition + SPOUSE_SPACING; // To the right
            lastSpousePosition = spouse.position.x;
          }
        });
        
        // Move to the next position, using space needed + extra spacing
        // Use the calculated space needed, or default to CARD_WIDTH + spouses if no descendants
        const personSpace = spaceNeeded[person.id] || (CARD_WIDTH + (spouseIds.length * SPOUSE_SPACING));
        currentX += personSpace + HORIZONTAL_SPACING;
      });
      
      // Now center children under their parents
      genPeople.forEach(person => {
        const children = this.getChildren(person.id);
        if (children.length > 0) {
          // Find rightmost position of parent (including spouses)
          const spouseIds = this.getSpouseIds(person.id);
          let parentRightX = person.position.x + CARD_WIDTH;
          
          spouseIds.forEach(spouseId => {
            const spouse = this.familyData.find(p => p.id === spouseId);
            if (spouse) {
              const spouseRightX = spouse.position.x + CARD_WIDTH;
              if (spouseRightX > parentRightX) {
                parentRightX = spouseRightX;
              }
            }
          });
          
          // Calculate children's total width
          const leftmostChild = children.reduce((min, child) => 
            child.position.x < min.position.x ? child : min, children[0]);
          const rightmostChild = children.reduce((max, child) => {
            // Include spouse width for rightmost position
            const childSpouses = this.getSpouseIds(max.id);
            const spouseOffset = childSpouses.length * SPOUSE_SPACING;
            const maxRightX = max.position.x + CARD_WIDTH + spouseOffset;
            
            const childSpouses2 = this.getSpouseIds(child.id);
            const spouseOffset2 = childSpouses2.length * SPOUSE_SPACING;
            const childRightX = child.position.x + CARD_WIDTH + spouseOffset2;
            
            return childRightX > maxRightX ? child : max;
          }, children[0]);
          
          // Get right edge of rightmost child (including spouses)
          const rightmostSpouses = this.getSpouseIds(rightmostChild.id);
          let rightEdge = rightmostChild.position.x + CARD_WIDTH;
          
          if (rightmostSpouses.length > 0) {
            const lastSpouse = this.familyData.find(p => p.id === rightmostSpouses[rightmostSpouses.length - 1]);
            if (lastSpouse) {
              rightEdge = lastSpouse.position.x + CARD_WIDTH;
            }
          }
          
          // Calculate parent center vs children center
          const parentCenter = (person.position.x + parentRightX) / 2;
          const childrenCenter = (leftmostChild.position.x + rightEdge) / 2;
          
          // Calculate offset to center children under parent
          const offset = parentCenter - childrenCenter;
          
          // Apply offset to all children and their spouses
          children.forEach(child => {
            child.position.x += offset;
            
            // Move child's spouses as well
            const childSpouseIds = this.getSpouseIds(child.id);
            childSpouseIds.forEach(spouseId => {
              const spouse = this.familyData.find(p => p.id === spouseId);
              if (spouse) {
                spouse.position.x += offset;
              }
            });
          });
        }
      });
      
      // 计算这一代的标记位置和高度
      this.calculateGenerationLabel(gen, minGen);
    }
    
    // 确保所有坐标都是整数，避免可能的渲染问题
    this.familyData.forEach(person => {
      person.position.x = Math.round(person.position.x);
      person.position.y = Math.round(person.position.y);
    });
    
    // 返回布局尺寸
    return {
      maxX: Math.max(...this.familyData.map(p => p.position.x)) + CARD_WIDTH + 100,
      maxY: Math.max(...this.familyData.map(p => p.position.y)) + CARD_HEIGHT + 100
    };
  }
  
  // 计算世代标记的位置和高度
  calculateGenerationLabel(generation, minGeneration) {
    const genPeople = this.getPeopleByGeneration(generation).filter(p => !p._hidden);
    
    if (genPeople.length === 0) return;
    
    // 计算这一代的开始和结束Y位置
    const startY = genPeople[0].position.y;
    
    // 如果是最后一代，高度就是卡片高度
    // 否则，高度是到下一代的距离加上当前代的卡片高度
    let height;
    const nextGenPeople = this.getPeopleByGeneration(generation + 1).filter(p => !p._hidden);
    
    if (nextGenPeople.length === 0) {
      height = CARD_HEIGHT + 20; // 简单地用卡片高度加一点边距
    } else {
      // 修正高度计算：当前代的卡片高度 + 到下一代的距离
      height = CARD_HEIGHT + (nextGenPeople[0].position.y - (startY + CARD_HEIGHT));
    }
    
    // 添加世代标记
    this.generationLabels.push({
      generation: generation,
      position: {
        y: startY
      },
      height: CARD_HEIGHT + 140
    });
  }
  
  // 获取世代标记
  getGenerationLabels() {
    return this.generationLabels;
  }
  
  // Get max generation number
  getMaxGeneration() {
    let maxGen = 0;
    this.familyData.forEach(person => {
      if (person.generation > maxGen) {
        maxGen = person.generation;
      }
    });
    return maxGen;
  }
  
  // Get all people in a specific generation
  getPeopleByGeneration(gen) {
    return this.familyData.filter(person => person.generation === gen);
  }
  
  // Get all children of a specific person
  getChildren(parentId) {
    return this.familyData.filter(person => person.parent === parentId);
  }
  
  // Check if a person has children
  hasChildren(personId) {
    return this.familyData.some(person => person.parent === personId);
  }
  
  // Check if a person is a main person (not a spouse)
  isMainPerson(person) {
    // A main person usually has a parent or has children
    return person.parent !== undefined || this.hasChildren(person.id);
  }
  
  // Get spouse IDs for a given person
  getSpouseIds(personId) {
    const spouses = [];
    
    this.spouseRelationships.forEach(([husband, wife]) => {
      if (husband === personId) {
        spouses.push(wife);
      } else if (wife === personId) {
        spouses.push(husband);
      }
    });
    
    return spouses;
  }
  
  // Update visibility of nodes based on collapse state
  updateVisibility() {
    // First, mark all nodes as potentially visible
    this.familyData.forEach(person => {
      person._hidden = false;
    });
    
    // Then hide descendants of collapsed nodes
    this.familyData.forEach(person => {
      if (person.collapsed && this.hasChildren(person.id)) {
        this.hideDescendants(person.id);
      }
    });
  }
  
  // Recursively hide descendants of a collapsed node
  hideDescendants(parentId) {
    const children = this.familyData.filter(person => person.parent === parentId);
    
    children.forEach(child => {
      // Hide the child
      child._hidden = true;
      
      // Hide the child's spouse(s) if any
      const spouseIds = this.getSpouseIds(child.id);
      spouseIds.forEach(spouseId => {
        const spouse = this.familyData.find(p => p.id === spouseId);
        if (spouse) {
          spouse._hidden = true;
        }
      });
      
      // Recursively hide descendants
      if (this.hasChildren(child.id)) {
        this.hideDescendants(child.id);
      }
    });
  }
}

export default LayoutEngine; 