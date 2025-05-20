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

// Mock data for demonstration - in a real app, this would come from an API
export const fetchMockChildrenData = (person) => {
  const personId = person.id
  return [
    {
      id: personId * 10 + 1,
      name: `${person.name}的子女1`,
      title: "长子",
      generation: person.generation + 1,
      type: "child",
      position: { x: 0, y: 0 },
      children: [
        {
          id: personId * 10 + 11,
          name: `${person.name}的子女11`,
          title: "长子",
          generation: person.generation + 2,
          type: "child",
          position: { x: 0, y: 0 },
          children: [
            {
              id: personId * 10 + 111,
              name: `${person.name}的子女111`,
              title: "长子",
              generation: person.generation + 3,
              type: "child",
              position: { x: 0, y: 0 },
              children: [
                {
                  id: personId * 10 + 1111,
                  name: `${person.name}的子女1111`,
                  title: "长子",
                  generation: person.generation + 4,
                  type: "child",
                  position: { x: 0, y: 0 },
                  children: [
                    {
                      id: personId * 10 + 11111,
                      name: `${person.name}的子女11111`,
                      title: "长子",
                      generation: person.generation + 5,
                      type: "child",
                      position: { x: 0, y: 0 },
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: personId * 10 + 2,
      name: `${person.name}的子女2`,
      title: "次子",
      generation: person.generation + 1,
      type: "child",
      position: { x: 0, y: 0 },
      children: [],
      // hasChildrenToLoad: true,
      // collapsed: true // Explicitly initialize collapsed state for children with hasChildrenToLoad
    },
    {
      id: personId * 10 + 3,
      name: `${person.name}的子女3`,
      title: "三子",
      generation: person.generation + 1,
      type: "child",
      position: { x: 0, y: 0 },
      children: [],
    },
  ];
};