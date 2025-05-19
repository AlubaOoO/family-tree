# Vue Family Tree Visualization

A dynamic, interactive family tree visualization built with Vue 3, allowing for dragging, zooming, and exploring family relationships.

## Features

- **Interactive Canvas**: Drag and drop family members to rearrange the family tree
- **Zoom Controls**: Zoom in and out of the family tree for better navigation
- **Connection Lines**: Visualize family relationships with connection lines
- **Male/Female Styling**: Different styling for male and female family members
- **Generation Markers**: Display generation numbers in Chinese numerals
- **Person Details**: View detailed information when selecting a family member

## Technologies Used

- Vue 3 with Composition API
- jsPlumb for handling connections between family members
- Custom drag and drop implementation
- SVG-based avatars for family members

## Project Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

1. **Navigate**: Pan around the family tree by dragging the canvas
2. **Zoom**: Use the zoom controls or Ctrl+Mouse Wheel to zoom in and out
3. **Rearrange**: Drag individual family members to rearrange the tree
4. **View Details**: Click on a family member to see their details
5. **Reset View**: Use the "Reset" button to reset the zoom level

## Customization

### Adding Family Members

To add new family members, modify the `familyData` array in `FamilyTree.vue`:

```javascript
const familyData = reactive([
  // Add new family members here
  { 
    id: 24, 
    name: '新成员', 
    title: '职位', 
    relation: '【称号】', 
    position: { x: 100, y: 800 }, 
    generation: 17, 
    parent: 11 
  },
]);
```

### Styling

Customize the appearance by modifying the CSS variables in `assets/main.css`:

```css
:root {
  --primary-color: #3498db;
  --secondary-color: #e74c70;
  /* Add more custom variables as needed */
}
```

## License

MIT License
