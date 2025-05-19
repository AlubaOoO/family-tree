import { mockData } from './mockData';

// 创建位置对象的工厂函数
export const createPosition = () => ({ x: 0, y: 0 });

// Function to add position to each node in the family tree
const addPositionToData = (data) => {
  return data.map(item => {
    const newItem = {
      ...item,
      position: createPosition()
    };
    
    if (newItem.children && newItem.children.length > 0) {
      newItem.children = addPositionToData(newItem.children);
    }
    
    return newItem;
  });
};

// Family data with hierarchical structure using children arrays
export const familyData = addPositionToData(mockData);

// Helper function to find a person by ID (useful for traversing the tree)
export const findPersonById = (id, data = familyData) => {
  for (const person of data) {
    if (person.id === id) {
      return person;
    }
    
    if (person.children && person.children.length > 0) {
      const found = findPersonById(id, person.children);
      if (found) return found;
    }
  }
  
  return null;
};

// Helper function to get all spouses of a person
export const getSpouses = (person) => {
  if (!person || !person.children) return [];
  return person.children.filter(child => child.type === 'spouse');
};

// Helper function to get all children of a person
export const getChildren = (person) => {
  if (!person || !person.children) return [];
  return person.children.filter(child => child.type === 'child');
}; 