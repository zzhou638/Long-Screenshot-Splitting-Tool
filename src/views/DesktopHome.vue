<template>
  <div class="desktop-home">
    <!-- 顶部导航栏 -->
    <nav class="glass-nav">
      <div class="logo">
        <img src="@/assets/logo.svg" alt="Logo" class="logo-icon" />
        <span class="gradient-text">长截图分割工具</span>
      </div>
    </nav>

    <!-- 主展示区 -->
    <main class="main-content">
      <div 
        class="preview-container" 
        :class="{ 'empty': !imageUrl, 'drag-over': isDragging }"
        @click="!imageUrl && triggerFileInput()"
        @wheel.ctrl.prevent="handleWheel"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <div v-if="imageUrl" class="scrollable-preview">
          <div class="image-wrapper" :style="{ transform: `scale(${scale})` }">
            <img 
              :src="imageUrl" 
              class="screenshot-img" 
              :class="{ 'crosshair-cursor': isFreeCropMode }"
              alt="Long Screenshot" 
              @load="onImageLoad"
              @click="handleImageClick"
            />
            <!-- 裁剪线 -->
            <div 
              v-for="(line, index) in cropLines" 
              :key="index"
              class="crop-line-indicator"
              :style="{ top: line * 100 + '%' }"
              @contextmenu.prevent.stop="openContextMenu($event, index)"
            >
              <span class="line-label" @contextmenu.prevent.stop="openContextMenu($event, index)">剪裁线 {{ index + 1 }}</span>
            </div>
          </div>
        </div>
        
        <div v-else class="upload-placeholder">
          <div class="icon-circle">
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
          </div>
          <h2>上传您的长截图</h2>
          <p>点击此处或拖拽文件到这里开始处理</p>
          <button class="select-btn">选择文件</button>
        </div>
      </div>
    </main>

    <!-- 隐藏的文件输入 -->
    <input 
      type="file" 
      ref="fileInput" 
      style="display: none" 
      accept="image/*" 
      @change="handleFileChange"
    />

    <!-- 裁剪预览区 -->
    <div v-if="(isFreeCropMode || isProportionalCropMode) && cropSegments.length > 0" class="crop-previews-sidebar">
      <h3 class="sidebar-title">裁剪预览 ({{ allCropSegments.length }}张)</h3>
      <div class="preview-list">
        <div 
          v-for="(seg, index) in allCropSegments" 
          :key="index" 
          class="preview-item"
        >
          <div class="preview-item-inner" :style="getPreviewStyle(seg)">
            <img :src="imageUrl" :style="getPreviewImgStyle(seg)" />
          </div>
          <div class="preview-label">片段 {{ index + 1 }}</div>
        </div>
      </div>
    </div>

    <!-- 右下角工具栏 -->
    <div v-if="imageUrl" class="bottom-toolbar">
      <button class="toolbar-btn" :class="{ 'active': isFreeCropMode }" @click="freeCrop">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 3v15h15M3 6h18" />
        </svg>
        自由裁剪
      </button>
      <button class="toolbar-btn" :class="{ 'active': isProportionalCropMode }" @click="proportionalCrop">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 3l18 18" />
        </svg>
        等比例裁剪
      </button>
      <button class="toolbar-btn" @click="triggerFileInput">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 3l4 4-4 4M21 7H3" />
          <path d="M7 21l-4-4 4-4M3 17h18" />
        </svg>
        更换图片
      </button>
      <button v-if="(isFreeCropMode || isProportionalCropMode) && cropLines.length > 0" class="toolbar-btn primary" @click="downloadCroppedImages">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        下载图片
      </button>
    </div>

    <!-- 等比例裁剪输入弹窗 -->
    <div v-if="showProportionalDialog" class="modal-overlay">
      <div class="modal-content">
        <h3>等比例裁剪</h3>
        <p>请输入需要将图片等分为多少张：</p>
        <input 
          type="number" 
          v-model.number="proportionalCount" 
          min="2" 
          max="50" 
          class="modal-input"
          @keyup.enter="applyProportionalCrop"
        />
        <div class="modal-actions">
          <button class="modal-btn secondary" @click="cancelProportionalCrop">取消</button>
          <button class="modal-btn primary" @click="applyProportionalCrop">确认</button>
        </div>
      </div>
    </div>

    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="blob purple"></div>
      <div class="blob blue"></div>
    </div>

    <!-- 自定义右键菜单 -->
    <div 
      v-if="contextMenu.show" 
      class="custom-context-menu" 
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click.stop
    >
      <div class="context-menu-item delete" @click="deleteCropLine">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1='10' y1='11' x2='10' y2='17'></line>
          <line x1='14' y1='11' x2='14' y2='17'></line>
        </svg>
        <span>删除此裁剪栏</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DesktopHome',
  data() {
    return {
      imageUrl: null,
      selectedFile: null,
      scale: 1,
      isFreeCropMode: false,
      isProportionalCropMode: false,
      showProportionalDialog: false,
      proportionalCount: 2,
      cropLines: [],
      imageInfo: { width: 0, height: 0 },
      isDragging: false, // 拖拽状态
      contextMenu: {
        show: false,
        x: 0,
        y: 0,
        lineIndex: null
      },
    }
  },
  mounted() {
    window.addEventListener('click', this.closeContextMenu);
  },
  unmounted() {
    window.removeEventListener('click', this.closeContextMenu);
  },
  computed: {
    cropSegments() {
      if (this.cropLines.length === 0) return [];
      const segments = [];
      let startY = 0;
      for (const lineY of this.cropLines) {
        segments.push({ start: startY, end: lineY });
        startY = lineY;
      }
      return segments;
    },
    allCropSegments() {
      // 包含最后一段（最后一条裁剪线到图片底部）的完整片段列表，用于下载
      if (this.cropLines.length === 0) return [];
      const segments = [...this.cropSegments];
      const lastLineY = this.cropLines[this.cropLines.length - 1];
      if (lastLineY < 1) {
        segments.push({ start: lastLineY, end: 1 });
      }
      return segments;
    }
  },
  methods: {
    handleWheel(event) {
      if (!this.imageUrl) return;

      const delta = event.deltaY;
      // 降低缩放灵敏度
      // 使用更小的步长，或者基于当前比例进行百分比缩放会更平滑
      const zoomFactor = 0.02; // 将步长从 0.1 降低到 0.02
      
      if (delta < 0) {
        // 放大
        this.scale = Math.min(this.scale + zoomFactor, 5);
      } else {
        // 缩小
        this.scale = Math.max(this.scale - zoomFactor, 0.1);
      }
    },
    triggerFileInput() {
      // 每次点击前清空 input 的 value，确保选择同一张图片也能触发 change 事件
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
      this.$refs.fileInput.click();
    },
    handleDragOver(event) {
      // 只有当拖拽的是文件时才响应
      if (event.dataTransfer.types.includes('Files')) {
        this.isDragging = true;
      }
    },
    handleDragLeave() {
      this.isDragging = false;
    },
    handleDrop(event) {
      this.isDragging = false;
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        this.processFile(files[0]);
      }
    },
    handleFileChange(event) {
      const file = event.target.files[0];
      if (file) {
        this.processFile(file);
      }
    },
    processFile(file) {
      if (file && file.type.startsWith('image/')) {
        // 如果之前有图片，释放旧的 URL 避免内存泄漏
        if (this.imageUrl) {
          URL.revokeObjectURL(this.imageUrl);
        }
        
        this.selectedFile = file;
        this.imageUrl = URL.createObjectURL(file);
        this.scale = 1; // 上传新图片时重置缩放
        
        // 清空所有裁剪状态和预览
        this.isFreeCropMode = false;
        this.isProportionalCropMode = false;
        this.cropLines = [];
        this.showProportionalDialog = false;
      } else {
        alert('请上传有效的图片文件！');
      }
    },
    onImageLoad(event) {
      this.imageInfo = {
        width: event.target.naturalWidth,
        height: event.target.naturalHeight
      };
    },
    handleImageClick(event) {
      if (!this.isFreeCropMode) return;
      
      // 获取点击位置相对于图片的比例 (0 到 1)
      const rect = event.target.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const relativeY = y / rect.height;
      
      // 添加裁剪线并排序
      this.cropLines.push(relativeY);
      this.cropLines.sort((a, b) => a - b);
    },
    getPreviewStyle(seg) {
      // 预览框的固定宽度，高度根据比例计算
      const previewWidth = 200; 
      const segmentHeightRatio = seg.end - seg.start;
      const actualHeight = this.imageInfo.height * segmentHeightRatio;
      const actualWidth = this.imageInfo.width;
      
      const previewHeight = (actualHeight / actualWidth) * previewWidth;
      
      return {
        width: `${previewWidth}px`,
        height: `${previewHeight}px`,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '8px',
        backgroundColor: '#1a1a1a'
      };
    },
    getPreviewImgStyle(seg) {
      // 计算图片在预览框中的偏移和缩放
      const previewWidth = 200;
      const scale = previewWidth / this.imageInfo.width;
      const offsetY = -(seg.start * this.imageInfo.height * scale);
      
      return {
        position: 'absolute',
        top: `${offsetY}px`,
        left: '0',
        width: `${previewWidth}px`,
        height: 'auto',
        maxWidth: 'none'
      };
    },
    freeCrop() {
      this.isFreeCropMode = !this.isFreeCropMode;
      if (this.isFreeCropMode) {
        this.isProportionalCropMode = false; // 互斥
      } else {
        this.cropLines = []; // 退出时清空裁剪线
      }
    },
    proportionalCrop() {
      if (this.isProportionalCropMode) {
        // 如果已经是等比例模式，点击则退出
        this.isProportionalCropMode = false;
        this.cropLines = [];
      } else {
        // 开启等比例模式，弹出输入框
        this.isFreeCropMode = false; // 互斥
        this.showProportionalDialog = true;
      }
    },
    cancelProportionalCrop() {
      this.showProportionalDialog = false;
    },
    applyProportionalCrop() {
      const count = parseInt(this.proportionalCount);
      if (isNaN(count) || count < 2) {
        alert('请输入大于等于2的有效数字');
        return;
      }
      
      this.showProportionalDialog = false;
      this.isProportionalCropMode = true;
      this.cropLines = [];
      
      // 自动生成等比例的裁剪线
      // 如果要切成 n 张，需要 n-1 条线
      const step = 1 / count;
      for (let i = 1; i < count; i++) {
        this.cropLines.push(i * step);
      }
    },
    async downloadCroppedImages() {
      if (!this.imageUrl || this.cropLines.length === 0) return;

      // 检查浏览器是否支持 File System Access API
      // 注意：showDirectoryPicker 只能在 HTTPS 或 localhost 环境下使用
      if (!('showDirectoryPicker' in window)) {
        console.warn('浏览器不支持 showDirectoryPicker，将使用默认下载方式。');
        await this.fallbackDownload();
        return;
      }

      try {
        // 弹出文件夹选择框
        const directoryHandle = await window.showDirectoryPicker({
          mode: 'readwrite'
        });

        const img = new Image();
        img.src = this.imageUrl;
        
        await new Promise(resolve => {
          img.onload = resolve;
        });

        const segments = this.allCropSegments;
        
        // 遍历并保存每个片段
        for (let index = 0; index < segments.length; index++) {
          const seg = segments[index];
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const sourceY = seg.start * img.naturalHeight;
          const sourceHeight = (seg.end - seg.start) * img.naturalHeight;
          
          canvas.width = img.naturalWidth;
          canvas.height = sourceHeight;
          
          ctx.drawImage(
            img,
            0, sourceY, img.naturalWidth, sourceHeight,
            0, 0, canvas.width, canvas.height
          );
          
          // 将 canvas 转换为 blob
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          
          // 在选定的文件夹中创建文件
          const fileName = `屏幕截图_${index + 1}.png`;
          const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
          
          // 写入数据
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        }
        
        alert('所有裁剪图片已成功保存到指定文件夹！');
        
      } catch (error) {
        // 用户取消选择或发生错误
        if (error.name !== 'AbortError') {
          console.error('保存文件失败:', error);
          alert('保存文件时发生错误，请重试。');
        }
      }
    },
    async fallbackDownload() {
      // 降级方案：使用传统的 <a> 标签下载
      const img = new Image();
      img.src = this.imageUrl;
      
      await new Promise(resolve => {
        img.onload = resolve;
      });

      const segments = this.allCropSegments;
      
      // 使用 async/await 确保按顺序触发下载，避免浏览器拦截多个并发下载
      for (let index = 0; index < segments.length; index++) {
        const seg = segments[index];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const sourceY = seg.start * img.naturalHeight;
        const sourceHeight = (seg.end - seg.start) * img.naturalHeight;
        
        canvas.width = img.naturalWidth;
        canvas.height = sourceHeight;
        
        ctx.drawImage(
          img,
          0, sourceY, img.naturalWidth, sourceHeight,
          0, 0, canvas.width, canvas.height
        );
        
        await new Promise(resolve => {
          canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `屏幕截图_${index + 1}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // 稍微延迟一下，防止浏览器拦截过快的连续下载
            setTimeout(resolve, 300);
          }, 'image/png');
        });
      }
    },
    openContextMenu(event, index) {
      this.contextMenu.show = true;
      this.contextMenu.x = event.clientX;
      this.contextMenu.y = event.clientY;
      this.contextMenu.lineIndex = index;
    },
    closeContextMenu() {
      this.contextMenu.show = false;
    },
    deleteCropLine() {
      if (this.contextMenu.lineIndex !== null) {
        this.cropLines.splice(this.contextMenu.lineIndex, 1);
        this.contextMenu.show = false;
        this.contextMenu.lineIndex = null;
      }
    }
  }
}
</script>

<style scoped>
.desktop-home {
  position: relative;
  min-height: 100vh;
  background-color: #f8fafc; /* 浅色背景 */
  color: #1e293b; /* 深色文字 */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* 现代化毛玻璃导航栏 */
.glass-nav {
  height: 70px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 40px;
  background: rgba(255, 255, 255, 0.8); /* 浅色半透明 */
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05); /* 浅色边框 */
  z-index: 100;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 800;
  font-size: 1.5rem;
}

.logo-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.gradient-text {
  background: linear-gradient(135deg, #a855f7, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tag {
  font-size: 0.7rem;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

/* 主展示区域：改靠左显示 */
.main-content {
  flex: 1;
  display: flex;
  justify-content: flex-start; /* 靠左显示 */
  align-items: center;
  padding: 20px 60px; /* 增加左侧内边距 */
  z-index: 10;
}

.preview-container {
  width: 40vw;
  height: 85vh;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 24px;
  position: relative;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
}

.preview-container.empty {
  border: 2px dashed rgba(0, 0, 0, 0.1);
  cursor: pointer;
  background: transparent;
}

.preview-container.empty:hover,
.preview-container.drag-over {
  background: #ffffff;
  border-color: #3b82f6;
  transform: translateY(-4px);
}

.preview-container.drag-over {
  box-shadow: 0 0 30px rgba(59, 130, 246, 0.1);
}

/* 针对长截图的滚动优化 */
.scrollable-preview {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.1) transparent;
}

.scrollable-preview::-webkit-scrollbar {
  width: 6px;
}

.scrollable-preview::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.screenshot-img {
  width: 100%;
  max-width: 1200px;
  display: block;
  margin: 0 auto;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  transform-origin: top left; /* 确保缩放从左上角开始 */
  transition: transform 0.1s ease-out; /* 平滑过渡 */
}

.crosshair-cursor {
  cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' style='fill:none;stroke:black;stroke-width:2'><line x1='12' y1='6' x2='12' y2='18'/><line x1='6' y1='12' x2='18' y2='12'/></svg>") 12 12, crosshair;
}

.image-wrapper {
  position: relative;
  display: inline-block;
  transform-origin: top left;
  transition: transform 0.1s ease-out;
}

.image-wrapper .screenshot-img {
  transform: none; /* 移除 img 上的 transform，交给 wrapper 处理 */
  transition: none;
}

.crop-line-indicator {
  position: absolute;
  left: 0;
  width: 100%;
  height: 4px;
  background-color: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
  z-index: 20;
  pointer-events: auto;
  cursor: pointer;
}

/* 自定义右键菜单样式 */
.custom-context-menu {
  position: fixed;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  min-width: 140px;
  z-index: 5000;
  overflow: hidden;
  padding: 4px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 0.85rem;
  color: #1e293b;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.context-menu-item:hover {
  background: #f1f5f9;
}

.context-menu-item.delete {
  color: #ef4444;
}

.context-menu-item.delete:hover {
  background: #fef2f2;
}

.line-label {
  position: absolute;
  right: 10px;
  top: -24px;
  background: #ef4444;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
}

/* 裁剪预览侧边栏 */
.crop-previews-sidebar {
  position: fixed;
  left: calc(40vw + 100px); /* 放置在左侧预览框的右边 */
  right: 40px;
  top: 100px;
  bottom: 120px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  z-index: 90;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.sidebar-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1e293b;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding-bottom: 10px;
}

.preview-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: row; /* 改为横向排列 */
  flex-wrap: wrap; /* 允许换行 */
  align-content: flex-start; /* 多行时靠上对齐 */
  gap: 20px;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.1) transparent;
}

.preview-list::-webkit-scrollbar {
  width: 4px;
}

.preview-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.preview-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  /* 限制单个预览项的最大宽度，防止过大 */
  max-width: 220px; 
  /* 添加卡片样式 */
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.preview-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border-color: rgba(59, 130, 246, 0.2);
}

.preview-item-inner {
  /* 确保内部图片容器有圆角，与卡片风格统一 */
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.preview-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #64748b;
  background: #f1f5f9;
  padding: 4px 12px;
  border-radius: 12px;
}

/* 上传占位符样式 */
.upload-placeholder {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  text-align: center;
  color: #64748b;
}

.icon-circle {
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(59, 130, 246, 0.05));
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 24px;
  color: #3b82f6;
}

.select-btn {
  margin-top: 20px;
  padding: 12px 32px;
  background: #3b82f6;
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.select-btn:hover {
  background: #2563eb;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* 装饰性背景球 */
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.blob {
  position: absolute;
  width: 500px;
  height: 500px;
  filter: blur(80px);
  opacity: 0.1; /* 降低透明度 */
  border-radius: 50%;
}

.purple {
  background: #a855f7;
  top: -100px;
  right: -100px;
}

.blue {
  background: #3b82f6;
  bottom: -100px;
  left: -100px;
}

/* 右下角工具栏样式 */
.bottom-toolbar {
  position: fixed;
  bottom: 40px;
  right: 40px;
  display: flex;
  gap: 12px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  padding: 10px 16px;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  color: #475569;
  padding: 8px 16px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #f8fafc;
  border-color: #3b82f6;
  color: #3b82f6;
  transform: translateY(-2px);
}

.toolbar-btn:active {
  transform: translateY(0);
}

.toolbar-btn.active {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
  color: #3b82f6;
}

.toolbar-btn.primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.toolbar-btn.primary:hover {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 16px;
  padding: 30px;
  width: 320px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #1e293b;
}

.modal-content p {
  color: #64748b;
  font-size: 0.9rem;
  margin-bottom: 20px;
}

.modal-input {
  width: 100%;
  padding: 10px 16px;
  background: #f1f5f9;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  color: #1e293b;
  font-size: 1rem;
  margin-bottom: 24px;
  box-sizing: border-box;
  text-align: center;
}

.modal-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.modal-btn {
  padding: 8px 24px;
  border-radius: 8px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-btn.primary {
  background: #3b82f6;
  color: white;
}

.modal-btn.primary:hover {
  background: #2563eb;
}

.modal-btn.secondary {
  background: #f1f5f9;
  color: #475569;
}

.modal-btn.secondary:hover {
  background: #e2e8f0;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
