<template>
  <div class="generation-label" :style="labelStyle">
    <div class="generation-text">第{{ chineseGeneration }}代</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  generation: {
    type: Number,
    required: true
  },
  position: {
    type: Object,
    required: true
  },
  height: {
    type: Number,
    required: true
  }
});

// 计算标签样式
const labelStyle = computed(() => ({
  left: props.position.x + 'px',
  top: props.position.y + 'px',
  height: props.height + 'px'
}));

// 生成中文世代数字
const chineseGeneration = computed(() => {
  // 将数字转换为中文
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const generation = props.generation;

  if (generation <= 10) {
    return chineseNumbers[generation];
  } else if (generation < 20) {
    return '十' + (generation > 10 ? chineseNumbers[generation - 10] : '');
  } else {
    const tens = Math.floor(generation / 10);
    const ones = generation % 10;
    return chineseNumbers[tens] + '十' + (ones > 0 ? chineseNumbers[ones] : '');
  }
});
</script>

<style scoped>
.generation-label {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  z-index: 1;
  background-color: #516b8e;
  display: flex;
  align-items: center;
  justify-content: center;
}


.generation-text {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  padding: 2px 8px;
  white-space: nowrap;
  margin-bottom: 4px;
  writing-mode: vertical-rl;
  text-orientation: upright;
}
</style> 