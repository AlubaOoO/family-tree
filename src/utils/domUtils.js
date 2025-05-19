/**
 * 等待指定的DOM元素加载完成
 * @param {string} selector DOM选择器
 * @param {number} timeout 超时时间（毫秒）
 * @param {number} checkInterval 检查间隔（毫秒）
 * @returns {Promise<Element>} 返回找到的DOM元素
 */
export const waitForElement = (selector, timeout = 5000, checkInterval = 100) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      const element = document.querySelector(selector);
      
      if (element) {
        resolve(element);
        return;
      }
      
      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Element not found: ${selector} (timeout: ${timeout}ms)`));
        return;
      }
      
      setTimeout(checkElement, checkInterval);
    };
    
    checkElement();
  });
};

/**
 * 等待多个DOM元素加载完成
 * @param {Array<string>} selectors DOM选择器数组
 * @param {number} timeout 超时时间（毫秒）
 * @returns {Promise<Array<Element>>} 返回找到的DOM元素数组
 */
export const waitForElements = (selectors, timeout = 5000) => {
  return Promise.all(selectors.map(selector => waitForElement(selector, timeout)));
};

/**
 * 等待指定毫秒数
 * @param {number} ms 等待的毫秒数
 * @returns {Promise<void>}
 */
export const wait = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}; 