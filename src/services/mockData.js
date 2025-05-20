// Family data with hierarchical structure using children arrays
export const mockData = [
  // Generation 13 - Root ancestor
  {
    id: 1,
    name: '仇景元',
    title: '始祖',
    relation: '【四房】',
    generation: 13,
    collapsed: false,
    children: [
      // Spouses
      {
        id: 2,
        name: '陈氏',
        title: '配',
        relation: '',
        generation: 13,
        type: 'spouse'
      },
      {
        id: 3,
        name: '吴氏',
        title: '继室',
        relation: '',
        generation: 13,
        type: 'spouse'
      },
      // Children
      {
        id: 4,
        name: '仇格丰',
        title: '长子',
        relation: '【五公】',
        generation: 14,
        collapsed: false,
        type: 'child',
        children: [
          // Spouse
          {
            id: 5,
            name: '张氏',
            title: '配',
            relation: '',
            generation: 14,
            type: 'spouse'
          },
          // Children
          {
            id: 6,
            name: '仇浩文',
            title: '长子',
            relation: '【华兴】',
            generation: 15,
            collapsed: false,
            type: 'child',
            children: [
              {
                id: 11,
                name: '仇瑾良',
                title: '独子',
                relation: '',
                generation: 16,
                collapsed: false,
                type: 'child',
                children: [
                  {
                    id: 12,
                    name: '王彩蝶',
                    title: '配',
                    relation: '',
                    generation: 16,
                    type: 'spouse'
                  },
                  {
                    id: 21,
                    name: '敬春',
                    title: '长女',
                    relation: '',
                    generation: 17,
                    type: 'child',
                    children: [],
                    hasChildrenToLoad: true,
                  }
                ]
              }
            ]
          },
          {
            id: 7,
            name: '仇杰文',
            title: '次子',
            relation: '【士日】',
            generation: 15,
            collapsed: false,
            type: 'child',
            children: [
              {
                id: 8,
                name: '罗玉凤',
                title: '继室',
                relation: '【凤姐】',
                generation: 15,
                type: 'spouse'
              },
              {
                id: 13,
                name: '仇瑾波',
                title: '长子',
                relation: '【波仔】',
                generation: 16,
                collapsed: false,
                type: 'child',
                children: [
                  {
                    id: 14,
                    name: '郑红梅',
                    title: '配',
                    relation: '',
                    generation: 16,
                    type: 'spouse'
                  },
                  {
                    id: 22,
                    name: '仇环宇',
                    title: '长子',
                    relation: '【西马】',
                    generation: 17,
                    type: 'child',
                    // children: [
                    //   {
                    //     id: 221,
                    //     name: '仇环宇的子女1',
                    //     title: '长子',
                    //     relation: '【西马】',
                    //     generation: 17,
                    //     type: 'child',
                    //     children: [
                    //       {
                    //         id: 2211,
                    //         name: '仇环宇的子女的子女1',
                    //         title: '长子',
                    //         relation: '【西马】',
                    //         generation: 18,
                    //         type: 'child',
                    //         children: [],
                    //       },
                    //       {
                    //         id: 2212,
                    //         name: '仇环宇的子女的子女2',
                    //         title: '次子',
                    //         relation: '【西马】',
                    //         generation: 18,
                    //         type: 'child',
                    //         children: [],
                    //       }
                    //     ]
                    //   },
                    // ],
                    hasChildrenToLoad: true,
                  }
                ]
              },
              {
                id: 15,
                name: '仇瑾豪',
                title: '次子',
                relation: '【豪士】',
                generation: 16,
                collapsed: false,
                type: 'child',
                children: [
                  {
                    id: 16,
                    name: '肖氏',
                    title: '配',
                    relation: '',
                    generation: 16,
                    type: 'spouse'
                  },
                  {
                    id: 23,
                    name: '艳春',
                    title: '长女',
                    relation: '',
                    generation: 17,
                    type: 'child',
                    children: [
                      {
                        id: 24,
                        name: '艳春-1',
                        title: '长女',
                        relation: '',
                        generation: 18,
                        type: 'child',
                        children: [],
                      },
                      {
                        id: 25,
                        name: '艳春-2',
                        title: '次女',
                        relation: '',
                        generation: 18,
                        type: 'child',
                        children: [],
                      }
                    ],
                    // hasChildrenToLoad: true,
                  }
                ]
              }
            ]
          },
          {
            id: 9,
            name: '仇晓文',
            title: '三子',
            relation: '【亚胜】',
            generation: 15,
            collapsed: false,
            type: 'child',
            children: [
              {
                id: 10,
                name: '李木兰',
                title: '原配',
                relation: '【如花】',
                generation: 15,
                type: 'spouse'
              },
              {
                id: 17,
                name: '仇瑾秋',
                title: '长子',
                relation: '【阿虎】',
                generation: 16,
                collapsed: false,
                type: 'child',
                children: [
                  {
                    id: 18,
                    name: '高氏',
                    title: '配室',
                    relation: '',
                    generation: 16,
                    type: 'spouse'
                  }
                ]
              },
              {
                id: 19,
                name: '仇瑾良',
                title: '次子',
                relation: '',
                generation: 16,
                collapsed: false,
                type: 'child',
                children: [
                  {
                    id: 20,
                    name: '王彩蝶',
                    title: '继配',
                    relation: '',
                    generation: 16,
                    type: 'spouse'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];