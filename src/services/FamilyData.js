// 创建位置对象的工厂函数
const createPosition = () => ({ x: 0, y: 0 });

// Family data with initial positions (will be recalculated)
export const familyData = [
  // Generation 13
  { id: 1, name: '仇景元', title: '始祖', relation: '【四房】', position: createPosition(), generation: 13, collapsed: false },
  { id: 2, name: '陈氏', title: '配', relation: '', position: createPosition(), generation: 13 },
  { id: 3, name: '吴氏', title: '继室', relation: '', position: createPosition(), generation: 13 },
  
  // Generation 14
  { id: 4, name: '仇格丰', title: '长子', relation: '【五公】', position: createPosition(), generation: 14, parent: 1, collapsed: false },
  { id: 5, name: '张氏', title: '配', relation: '', position: createPosition(), generation: 14 },
  
  // Generation 15 - First branch
  { id: 6, name: '仇浩文', title: '长子', relation: '【华兴】', position: createPosition(), generation: 15, parent: 4, collapsed: false },
  
  // Generation 15 - Second branch
  { id: 7, name: '仇杰文', title: '次子', relation: '【士日】', position: createPosition(), generation: 15, parent: 4, collapsed: false },
  { id: 8, name: '罗玉凤', title: '继室', relation: '【凤姐】', position: createPosition(), generation: 15 },
  
  // Generation 15 - Third branch
  { id: 9, name: '仇晓文', title: '三子', relation: '【亚胜】', position: createPosition(), generation: 15, parent: 4, collapsed: false },
  { id: 10, name: '李木兰', title: '原配', relation: '【如花】', position: createPosition(), generation: 15 },
  
  // Generation 16 - First branch
  { id: 11, name: '仇瑾良', title: '独子', relation: '', position: createPosition(), generation: 16, parent: 6, collapsed: false },
  { id: 12, name: '王彩蝶', title: '配', relation: '', position: createPosition(), generation: 16 },
  
  // Generation 16 - Second branch (1)
  { id: 13, name: '仇瑾波', title: '长子', relation: '【波仔】', position: createPosition(), generation: 16, parent: 7, collapsed: false },
  { id: 14, name: '郑红梅', title: '配', relation: '', position: createPosition(), generation: 16 },
  
  // Generation 16 - Second branch (2)
  { id: 15, name: '仇瑾豪', title: '次子', relation: '【豪士】', position: createPosition(), generation: 16, parent: 7, collapsed: false },
  { id: 16, name: '肖氏', title: '配', relation: '', position: createPosition(), generation: 16 },
  
  // Generation 16 - Third branch
  { id: 17, name: '仇瑾秋', title: '长子', relation: '【阿虎】', position: createPosition(), generation: 16, parent: 9, collapsed: false },
  { id: 18, name: '高氏', title: '配室', relation: '', position: createPosition(), generation: 16 },
  { id: 19, name: '仇瑾良', title: '次子', relation: '', position: createPosition(), generation: 16, parent: 9, collapsed: false },
  { id: 20, name: '王彩蝶', title: '继配', relation: '', position: createPosition(), generation: 16 },
  
  // Generation 17
  { id: 21, name: '敬春', title: '长女', relation: '', position: createPosition(), generation: 17, parent: 11 },
  { id: 22, name: '仇环宇', title: '长子', relation: '【西马】', position: createPosition(), generation: 17, parent: 13 },
  { id: 23, name: '艳春', title: '长女', relation: '', position: createPosition(), generation: 17, parent: 15 }
];

// Spouse relationships
export const spouseRelationships = [
  [1, 2], [1, 3], [4, 5], [7, 8], [9, 10], [11, 12], 
  [13, 14], [15, 16], [17, 18], [19, 20]
]; 