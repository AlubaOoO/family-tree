// Constants for layout
const CARD_WIDTH = 200;
const CARD_HEIGHT = 220;
const HORIZONTAL_SPACING = 40;  // Space between siblings
const VERTICAL_SPACING = 360;   // Space between generations
const SPOUSE_SPACING = 220;     // Space between spouses
const GENERATION_LABEL_WIDTH = 60; // Width of generation label

import { getSpouses, getChildren, findPersonById } from './FamilyData';

class LayoutEngine {
  constructor(familyData) {
    // 扁平化家族树，将所有人（包括配偶和子女）都放在一个数组中
    this.familyData = this.flattenFamilyTree(familyData);
    this.generationLabels = []; // 存储世代标记的位置信息
    
    // 确保每个 person 对象都有 _hidden 属性
    this.familyData.forEach(person => {
      if (person._hidden === undefined) {
        person._hidden = false;
      }
    });
  }
  
  // 扁平化家族树的辅助方法
  flattenFamilyTree(data) {
    console.log('[LayoutEngine] Flattening family tree');
    const flattened = [];
    
    const flatten = (people) => {
      if (!people || !people.length) return;
      
      for (const person of people) {
        flattened.push(person);
        
        if (person.children && person.children.length > 0) {
          console.log(`[LayoutEngine] Flattening ${person.children.length} children of person ${person.id} (${person.name})`);
          flatten(person.children);
        }
      }
    };
    
    flatten(data);
    console.log(`[LayoutEngine] Flattened tree contains ${flattened.length} people`);
    return flattened;
  }
  
  // Calculate positions for all family members
  calculatePositions() {
    console.log('[LayoutEngine] Starting calculatePositions');
    
    // 重置所有位置为初始值，确保重新计算是从干净的状态开始
    this.familyData.forEach(person => {
      person.position.x = 0;
      person.position.y = 0;
    });
    
    // Get minimum and maximum generation to determine our range
    const minGen = Math.min(...this.familyData.map(p => p.generation));
    const maxGen = this.getMaxGeneration();
    console.log(`[LayoutEngine] Generation range: ${minGen} to ${maxGen}`);
    
    // Step 1: Calculate the space needed for each person (from bottom up)
    const personWidths = this.calculatePersonWidths(minGen, maxGen);
    
    // Reset generation labels array
    this.generationLabels = [];
    
    // Step 2: Position all people from top to bottom
    this.positionAllPeople(minGen, maxGen, personWidths);
    
    // Step 3: Ensure the first child is directly below the parent
    this.alignFirstChildrenWithParents(minGen, maxGen);
    
    // Ensure all coordinates are integers
    this.roundAllCoordinates();
    
    // Return layout dimensions
    const maxX = Math.max(...this.familyData.map(p => p.position.x)) + CARD_WIDTH + 100;
    const maxY = Math.max(...this.familyData.map(p => p.position.y)) + CARD_HEIGHT + 100;
    
    console.log(`[LayoutEngine] Layout dimensions: ${maxX}x${maxY}`);
    
    return {
      maxX: maxX,
      maxY: maxY
    };
  }
  
  // Step 1: Calculate the width needed for each person based on their descendants
  calculatePersonWidths(minGen, maxGen) {
    const personWidths = {};
    
    // Process from bottom up (from youngest to oldest generation)
    for (let gen = maxGen; gen >= minGen; gen--) {
      const genPeople = this.getPeopleByGeneration(gen).filter(p => this.isMainPerson(p));
      console.log(`[LayoutEngine] Processing generation ${gen}, found ${genPeople.length} main people`);
      
      genPeople.forEach(person => {
        // Start with space for this person and their spouses
        const spouseIds = this.getSpouseIds(person.id);
        let width = CARD_WIDTH + (spouseIds.length * SPOUSE_SPACING);
        
        // If this person has children, add up their space
        const children = this.getChildren(person.id);
        if (children.length > 0) {
          console.log(`[LayoutEngine] Person ${person.id} (${person.name}) has ${children.length} children`);
          
          // Sum the width of all children plus spacing between them
          const childrenSpace = children.reduce((sum, child) => {
            return sum + (personWidths[child.id] || CARD_WIDTH);
          }, 0);
          
          // Add spacing between children
          const childrenSpacing = (children.length - 1) * HORIZONTAL_SPACING;
          
          // Take the max of current width or children's total width
          width = Math.max(width, childrenSpace + childrenSpacing);
        }
        
        // Store the space needed for this person
        personWidths[person.id] = width;
        console.log(`[LayoutEngine] Space needed for person ${person.id} (${person.name}): ${width}px`);
      });
    }
    
    return personWidths;
  }
  
  // Step 2: Position all people from top to bottom
  positionAllPeople(minGen, maxGen, personWidths) {
    for (let gen = minGen; gen <= maxGen; gen++) {
      const genPeople = this.getPeopleByGeneration(gen).filter(p => this.isMainPerson(p));
      
      // Skip if no main people in this generation
      if (genPeople.length === 0) continue;
      
      console.log(`[LayoutEngine] Positioning generation ${gen}, ${genPeople.length} main people`);
      
      // Start X position for this generation (add space for generation label)
      let currentX = GENERATION_LABEL_WIDTH + 40;
      
      // Position main people in this generation
      genPeople.forEach((person, index) => {
        // Calculate Y position based on generation
        person.position.y = (gen - minGen) * VERTICAL_SPACING + 50;
        
        // Set X position
        person.position.x = currentX;
        
        console.log(`[LayoutEngine] Positioned person ${person.id} (${person.name}) at (${person.position.x}, ${person.position.y})`);
        
        // Position spouses next to the main person
        this.positionSpouses(person);
        
        // Move to the next position, using the calculated space needed
        const personSpace = personWidths[person.id] || 
          (CARD_WIDTH + (this.getSpouseIds(person.id).length * SPOUSE_SPACING));
        currentX += personSpace + HORIZONTAL_SPACING;
      });
      
      // Center children under their parents
      this.centerChildrenUnderParents(genPeople);
      
      // Calculate generation label for this generation
      this.calculateGenerationLabel(gen, minGen);
    }
  }
  
  // Position spouses next to the main person
  positionSpouses(person) {
    const spouseIds = this.getSpouseIds(person.id);
    let lastSpousePosition = person.position.x;
    
    // Position each spouse beside the main person
    spouseIds.forEach((spouseId, spouseIndex) => {
      const spouse = this.familyData.find(p => p.id === spouseId);
      if (spouse) {
        spouse.position.y = person.position.y; // Same Y level
        spouse.position.x = lastSpousePosition + SPOUSE_SPACING; // To the right
        lastSpousePosition = spouse.position.x;
        
        console.log(`[LayoutEngine] Positioned spouse ${spouse.id} (${spouse.name}) at (${spouse.position.x}, ${spouse.position.y})`);
      }
    });
  }
  
  // Center children under their parents
  centerChildrenUnderParents(genPeople) {
    genPeople.forEach(person => {
      const children = this.getChildren(person.id);
      if (children.length === 0) return;
      
      console.log(`[LayoutEngine] Centering ${children.length} children under person ${person.id} (${person.name})`);
      
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
        const childSpouses = this.getSpouseIds(child.id);
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
      
      console.log(`[LayoutEngine] Centering calculation:`, {
        parentLeftX: person.position.x,
        parentRightX: parentRightX,
        parentCenter: parentCenter,
        leftmostChildX: leftmostChild.position.x,
        rightEdge: rightEdge,
        childrenCenter: childrenCenter,
        offset: offset
      });
      
      // Apply offset to all children and their spouses
      children.forEach(child => {
        const oldX = child.position.x;
        child.position.x += offset;
        
        console.log(`[LayoutEngine] Moved child ${child.id} (${child.name}) from X=${oldX} to X=${child.position.x}`);
        
        // Move child's spouses as well
        const childSpouseIds = this.getSpouseIds(child.id);
        childSpouseIds.forEach(spouseId => {
          const spouse = this.familyData.find(p => p.id === spouseId);
          if (spouse) {
            const oldSpouseX = spouse.position.x;
            spouse.position.x += offset;
            console.log(`[LayoutEngine] Moved spouse ${spouse.id} (${spouse.name}) from X=${oldSpouseX} to X=${spouse.position.x}`);
          }
        });
      });
    });
  }
  
  // Step 3: Ensure the first child is directly below the parent by adjusting siblings
  alignFirstChildrenWithParents(minGen, maxGen) {
    // Traverse from top to bottom
    for (let gen = minGen; gen < maxGen; gen++) {
      const genPeople = this.getPeopleByGeneration(gen).filter(p => this.isMainPerson(p));
      
      genPeople.forEach(parent => {
        const children = this.getChildren(parent.id);
        if (children.length === 0) return;
        
        // Get first child
        const firstChild = children[0];
        
        // Calculate the parent's center position
        const parentCenter = parent.position.x + (CARD_WIDTH / 2);
        
        // Calculate the first child's center position
        const firstChildCenter = firstChild.position.x + (CARD_WIDTH / 2);
        
        // Calculate the offset needed to align the first child with parent
        const offset = parentCenter - firstChildCenter;
        
        if (Math.abs(offset) > 1) { // Only adjust if the offset is significant
          console.log(`[LayoutEngine] Aligning children of ${parent.id} (${parent.name}): offset=${offset}`);
          
          // Apply offset to all children of this parent and their spouses
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
    }
  }
  
  // Ensure all coordinates are integers
  roundAllCoordinates() {
    this.familyData.forEach(person => {
      person.position.x = Math.round(person.position.x);
      person.position.y = Math.round(person.position.y);
    });
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
  
  // Get children for a given parent ID
  getChildren(parentId) {
    const parent = findPersonById(parentId, this.familyData);
    if (!parent) return [];
    
    return getChildren(parent);
  }
  
  // Check if a person has children
  hasChildren(personId) {
    const person = findPersonById(personId, this.familyData);
    return person && getChildren(person).length > 0;
  }
  
  // Check if a person is a main person (not a spouse)
  isMainPerson(person) {
    // 在新结构中，主要人物是type为'child'或未定义type的人物
    return !person.type || person.type === 'child';
  }
  
  // Get spouse IDs for a given person
  getSpouseIds(personId) {
    const person = findPersonById(personId, this.familyData);
    if (!person) return [];
    
    return getSpouses(person).map(spouse => spouse.id);
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
    const children = this.getChildren(parentId);
    
    children.forEach(child => {
      // Hide the child
      child._hidden = true;
      
      // Hide the child's spouse(s) if any
      const spouses = getSpouses(child);
      spouses.forEach(spouse => {
        spouse._hidden = true;
      });
      
      // Recursively hide descendants
      if (this.hasChildren(child.id)) {
        this.hideDescendants(child.id);
      }
    });
  }
}

export default LayoutEngine; 