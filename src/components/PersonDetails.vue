<template>
  <div v-if="person" class="person-details">
    <h3>{{ person.name }}</h3>
    <p>{{ person.title }}</p>
    <p>{{ person.relation }}</p>
    <div v-if="hasChildren" class="detail-actions">
      <button @click="$emit('toggle-collapse')">
        {{ person.collapsed ? '展开' : '折叠' }}子树
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  person: {
    type: Object,
    required: true
  },
  hasChildren: {
    type: Boolean,
    default: false
  }
});

defineEmits(['toggle-collapse']);
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