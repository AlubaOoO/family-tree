<template>
  <div v-if="person" class="person-details">
    <h3>{{ person.name }}</h3>
    <p>{{ person.title }}</p>
    <p>{{ person.relation }}</p>
    <div v-if="hasChildren" class="detail-actions">
      <button @click="handleButtonClick">
        {{ getButtonText }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  person: {
    type: Object,
    required: true
  },
  hasChildren: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['toggle-collapse', 'load-children']);

// Check if person has actual children data
const hasChildrenData = computed(() => {
  return props.person.children && 
         props.person.children.some(child => child.type === 'child');
});

// Get appropriate button text
const getButtonText = computed(() => {
  if (hasChildrenData.value) {
    return props.person.collapsed ? '展开子树' : '折叠子树';
  } else if (props.hasChildren) {
    return '加载子树数据';
  }
  return '';
});

// Handle button click
const handleButtonClick = () => {
  if (hasChildrenData.value) {
    // If we have children data, just toggle collapse state
    emit('toggle-collapse');
  } else if (props.hasChildren) {
    // If hasChildren is true but no children data, emit load event
    emit('load-children', props.person.id);
  }
};
</script>

<style scoped>
.person-details {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background-color: white;
  border-radius: 5px;
  padding: 15px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-width: 250px;
}

.detail-actions {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #eee;
}

.detail-actions button {
  padding: 5px 12px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.detail-actions button:hover {
  background-color: #e9ecef;
}
</style> 