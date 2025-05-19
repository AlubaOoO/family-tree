<template>
  <div 
    class="person-card"
    :class="{ 
      'male': isMale, 
      'female': !isMale,
      'has-children': hasChildren,
      'collapsed': isCollapsed
    }"
    @mousedown="startDrag"
    @mouseup="endDrag"
  >
    <div class="person-image">
      <div class="avatar">
        <img :src="getAvatarImage()" alt="Avatar">
      </div>
      <div class="title">{{ person.title }}</div>
    </div>
    <div class="person-name">{{ person.name }}</div>
    <div class="person-relation" v-if="person.relation">{{ person.relation }}</div>
    <div class="generation">第{{ toChineseNumber(person.generation) }}世</div>
    
    <button 
      v-if="hasChildren" 
      class="toggle-btn"
      @click.stop="$emit('toggle-collapse')"
      :title="isCollapsed ? '展开子树' : '折叠子树'"
    >
      <span class="toggle-icon">{{ isCollapsed ? '+' : '−' }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDraggable } from '@vueuse/core';

const props = defineProps({
  person: {
    type: Object,
    required: true
  },
  hasChildren: {
    type: Boolean,
    default: false
  },
  isCollapsed: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['drag-start', 'drag-end', 'toggle-collapse']);

// Determine if the person is male or female
const isMale = computed(() => {
  return !props.person.title?.includes('配') && 
         !props.person.title?.includes('室') && 
         !props.person.name?.includes('氏');
});

// Function to get avatar image based on gender
const getAvatarImage = () => {
  if (isMale.value) {
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzMzOThkYiIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTEuMzUgMC0yLjY1LS4yNS0zLjg1LS43bC44NS0xLjVjLjk1LjMgMS45NS41IDMgLjUgNS41MiAwIDEwLTQuNDggMTAtMTBTMTcuNTIgNSAxMiA1IDIgOS40OCAyIDE1YzAgLjY4LjA4IDEuMzQuMjUgMmgtLjI1djFjMCAxLjEuOSAyIDIgMmgxdjJoMTR2LTJoMWMxLjEgMCAyLS45IDItMnYtMWgtLjI1Yy4xNy0uNjYuMjUtMS4zMi4yNS0yIDAtMS42My0uNDMtMy4xNy0xLjE4LTQuNWwxLjUtLjg1QzIyLjc1IDkuMzUgMjMgMTAuNjUgMjMgMTIgMjMgMTcuNTIgMTguNTIgMjIgMTMgMjJ6Ii8+PC9zdmc+';
  } else {
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2U3NGM3MCIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTEuMzUgMC0yLjY1LS4yNS0zLjg1LS43bC44NS0xLjVjLjk1LjMgMS45NS41IDMgLjUgNS41MiAwIDEwLTQuNDggMTAtMTBTMTcuNTIgNSAxMiA1IDIgOS40OCAyIDE1YzAgLjY4LjA4IDEuMzQuMjUgMmgtLjI1djFjMCAxLjEuOSAyIDIgMmgxdjJoMTR2LTJoMWMxLjEgMCAyLS45IDItMnYtMWgtLjI1Yy4xNy0uNjYuMjUtMS4zMi4yNS0yIDAtMS42My0uNDMtMy4xNy0xLjE4LTQuNWwxLjUtLjg1QzIyLjc1IDkuMzUgMjMgMTAuNjUgMjMgMTIgMjMgMTcuNTIgMTguNTIgMjIgMTMgMjJ6Ii8+PC9zdmc+';
  }
};

// Convert numbers to Chinese numerals
const toChineseNumber = (num) => {
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (num <= 10) {
    return chineseNumbers[num];
  } else if (num < 20) {
    return '十' + (num > 10 ? chineseNumbers[num - 10] : '');
  } else {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return chineseNumbers[tens] + '十' + (ones > 0 ? chineseNumbers[ones] : '');
  }
};

// Drag functionality
let isDragging = false;
let startX = 0;
let startY = 0;

const startDrag = (event) => {
  isDragging = true;
  startX = event.clientX;
  startY = event.clientY;
  emit('drag-start', props.person.id, event);
  
  // Add event listeners to track dragging
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', handleDragEnd);
};

const handleDrag = (event) => {
  if (!isDragging) return;
  
  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  
  // Update the person's position
  props.person.position.x += dx;
  props.person.position.y += dy;
  
  // Update start positions for next move
  startX = event.clientX;
  startY = event.clientY;
};

const handleDragEnd = (event) => {
  isDragging = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', handleDragEnd);
  emit('drag-end', props.person.id, event);
};

const endDrag = (event) => {
  if (isDragging) {
    handleDragEnd(event);
  }
};
</script>

<style scoped>
.person-card {
  width: 160px;
  background-color: #ffffff;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  padding: 18px;
  text-align: center;
  transition: all 0.3s;
  user-select: none;
  margin: 5px;
  position: relative;
}

.person-card:hover {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  transform: translateY(-5px);
}

.person-card.has-children::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 8px;
  background-color: transparent;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #f0f0f0;
  opacity: 0.7;
  transition: opacity 0.3s;
}

.person-card.collapsed::after {
  opacity: 0;
}

.person-card.male {
  border-top: 6px solid #3498db;
  background: linear-gradient(to bottom, rgba(52, 152, 219, 0.05), white 20%);
}

.person-card.female {
  border-top: 6px solid #e74c70;
  background: linear-gradient(to bottom, rgba(231, 76, 112, 0.05), white 20%);
}

.person-image {
  margin-bottom: 15px;
  position: relative;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto 12px;
  background-color: #f0f0f0;
  border: 3px solid #eee;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.title {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #fff;
  border-radius: 12px;
  padding: 3px 12px;
  font-size: 13px;
  border: 1px solid #ddd;
  box-shadow: 0 1px 5px rgba(0,0,0,0.1);
  z-index: 2;
}

.person-name {
  font-weight: bold;
  font-size: 20px;
  margin-bottom: 8px;
}

.person-relation {
  color: #444;
  font-size: 15px;
  margin-bottom: 8px;
  font-weight: 500;
}

.generation {
  font-size: 13px;
  color: #666;
  border-top: 1px dashed #ddd;
  padding-top: 8px;
  margin-top: 8px;
}

.toggle-btn {
  position: absolute;
  right: -10px;
  bottom: -10px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background-color: #fff;
  border: 2px solid #ddd;
  color: #555;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 3;
  padding: 0;
  transition: all 0.2s, transform 0.3s;
}

.toggle-btn:hover {
  background-color: #f0f0f0;
  transform: scale(1.15);
}

.toggle-icon {
  font-size: 18px;
  line-height: 1;
  position: relative;
  top: 1px;
}

.male .toggle-btn {
  border-color: #3498db;
  color: #3498db;
}

.female .toggle-btn {
  border-color: #e74c70;
  color: #e74c70;
}

.collapsed .toggle-btn {
  background-color: #f8f9fa;
  transform: rotate(90deg);
}

.collapsed.male .toggle-btn {
  background-color: rgba(52, 152, 219, 0.1);
}

.collapsed.female .toggle-btn {
  background-color: rgba(231, 76, 112, 0.1);
}

.collapsed .toggle-btn:hover {
  transform: rotate(90deg) scale(1.15);
}
</style> 