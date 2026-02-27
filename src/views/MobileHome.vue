<template>
  <div class="mobile-home">
    <header class="top-bar">
      <div class="logo-area">
        <img src="@/assets/logo.svg" alt="Logo" class="logo-icon" />
        <h1 class="title">长截图分割工具</h1>
      </div>
      <p class="sub-title">上传长截图并快速分割导出</p>
    </header>

    <main class="content">
      <div
        class="preview-container"
        :class="{ empty: !imageUrl, 'drag-over': isDragging }"
        @click="!imageUrl && triggerFileInput()"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchEnd"
      >
        <div v-if="imageUrl" class="scrollable-preview">
          <div class="image-wrapper" :style="{ transform: `scale(${scale})` }">
            <img
              :src="imageUrl"
              class="screenshot-img"
              :class="{ 'crosshair-cursor': isFreeCropMode }"
              alt="Long Screenshot"
              @load="onImageLoad"
              @click="handleImageTap"
            />
            <div
              v-for="(line, index) in cropLines"
              :key="index"
              class="crop-line-indicator"
              :style="{ top: `${line * 100}%` }"
              @touchstart.stop.prevent="startLineLongPress($event, index)"
              @touchmove.stop="cancelLineLongPress"
              @touchend.stop="cancelLineLongPress"
              @touchcancel.stop="cancelLineLongPress"
            >
              <span class="line-label">裁剪线 {{ index + 1 }}</span>
            </div>
          </div>
        </div>

        <div v-else class="upload-placeholder">
          <div class="icon-circle">
            <svg viewBox="0 0 24 24" width="42" height="42" stroke="currentColor" stroke-width="1.5" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
          </div>
          <h2>上传长截图</h2>
          <p>点击选择图片，或直接拖拽到此区域</p>
          <button class="select-btn">选择图片</button>
        </div>
      </div>

      <div v-if="imageUrl" class="zoom-controls">
        <button class="zoom-btn" @click="zoomOut">-</button>
        <span class="zoom-label">{{ Math.round(scale * 100) }}%</span>
        <button class="zoom-btn" @click="zoomIn">+</button>
        <button class="zoom-reset" @click="resetZoom">重置</button>
      </div>

      <div v-if="(isFreeCropMode || isProportionalCropMode) && cropSegments.length > 0" class="crop-preview-tray">
        <div class="tray-header">
          <h3>裁剪预览</h3>
          <span>{{ allCropSegments.length }} 张</span>
        </div>
        <div class="tray-list">
          <div v-for="(seg, index) in allCropSegments" :key="index" class="preview-item">
            <div class="preview-item-inner" :style="getPreviewStyle(seg)">
              <img :src="imageUrl" :style="getPreviewImgStyle(seg)" />
            </div>
            <div class="preview-label">片段 {{ index + 1 }}</div>
          </div>
        </div>
      </div>
    </main>

    <input
      ref="fileInput"
      type="file"
      style="display: none"
      accept="image/*"
      @change="handleFileChange"
    />

    <div v-if="imageUrl" class="bottom-toolbar">
      <button class="toolbar-btn" :class="{ active: isFreeCropMode }" @click="freeCrop">
        自由裁剪
      </button>
      <button class="toolbar-btn" :class="{ active: isProportionalCropMode }" @click="proportionalCrop">
        等比例
      </button>
      <button class="toolbar-btn" @click="triggerFileInput">
        更换图片
      </button>
      <button
        v-if="(isFreeCropMode || isProportionalCropMode) && cropLines.length > 0"
        class="toolbar-btn primary"
        @click="downloadCroppedImages"
      >
        保存到相册
      </button>
    </div>

    <div v-if="showProportionalDialog" class="modal-overlay">
      <div class="modal-content">
        <h3>等比例裁剪</h3>
        <p>请输入要等分成几张图片</p>
        <input
          v-model.number="proportionalCount"
          type="number"
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

    <div v-if="lineActionSheet.show" class="sheet-mask" @click="closeLineActionSheet">
      <div class="sheet-panel" @click.stop>
        <button class="sheet-btn danger" @click="deleteCropLine">删除此裁剪线</button>
        <button class="sheet-btn" @click="closeLineActionSheet">取消</button>
      </div>
    </div>

    <!-- 成功提示弹框 -->
    <div v-if="showSuccessModal" class="modal-overlay success-modal" @click="showSuccessModal = false">
      <div class="modal-content success-content" @click.stop>
        <div class="success-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h3>任务已完成</h3>
        <p>{{ successMessage }}</p>
        <button class="modal-btn primary" @click="showSuccessModal = false">知道了</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MobileHome',
  data() {
    return {
      imageUrl: null,
      selectedFile: null,
      scale: 1,
      imageInfo: { width: 0, height: 0 },
      isDragging: false,
      isFreeCropMode: false,
      isProportionalCropMode: false,
      showProportionalDialog: false,
      proportionalCount: 2,
      cropLines: [],
      touchState: {
        isPinching: false,
        startDistance: 0,
        startScale: 1
      },
      suppressTapUntil: 0,
      longPressTimer: null,
      lineActionSheet: {
        show: false,
        lineIndex: null
      },
      showSuccessModal: false,
      successMessage: ''
    };
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
      if (this.cropLines.length === 0) return [];

      const segments = [...this.cropSegments];
      const lastLine = this.cropLines[this.cropLines.length - 1];
      if (lastLine < 1) {
        segments.push({ start: lastLine, end: 1 });
      }
      return segments;
    }
  },
  beforeDestroy() {
    this.cancelLineLongPress();
    if (this.imageUrl) {
      URL.revokeObjectURL(this.imageUrl);
    }
  },
  methods: {
    triggerFileInput() {
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
      this.$refs.fileInput.click();
    },
    handleDragOver(event) {
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
      if (!file || !file.type.startsWith('image/')) {
        alert('请上传有效的图片文件！');
        return;
      }

      if (this.imageUrl) {
        URL.revokeObjectURL(this.imageUrl);
      }

      this.selectedFile = file;
      this.imageUrl = URL.createObjectURL(file);
      this.scale = 1;
      this.imageInfo = { width: 0, height: 0 };

      this.isFreeCropMode = false;
      this.isProportionalCropMode = false;
      this.showProportionalDialog = false;
      this.cropLines = [];
      this.closeLineActionSheet();
    },
    onImageLoad(event) {
      this.imageInfo = {
        width: event.target.naturalWidth,
        height: event.target.naturalHeight
      };
    },
    zoomIn() {
      this.scale = Math.min(this.scale + 0.1, 5);
    },
    zoomOut() {
      this.scale = Math.max(this.scale - 0.1, 0.2);
    },
    resetZoom() {
      this.scale = 1;
    },
    getTouchDistance(t1, t2) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.hypot(dx, dy);
    },
    handleTouchStart(event) {
      if (!this.imageUrl) return;

      if (event.touches.length === 2) {
        const [first, second] = event.touches;
        this.touchState.isPinching = true;
        this.touchState.startDistance = this.getTouchDistance(first, second);
        this.touchState.startScale = this.scale;
      }
    },
    handleTouchMove(event) {
      if (!this.imageUrl) return;

      if (this.touchState.isPinching && event.touches.length === 2) {
        event.preventDefault();
        const [first, second] = event.touches;
        const distance = this.getTouchDistance(first, second);
        const ratio = distance / this.touchState.startDistance;
        this.scale = Math.min(Math.max(this.touchState.startScale * ratio, 0.2), 5);
      }
    },
    handleTouchEnd(event) {
      if (!this.imageUrl) return;

      if (this.touchState.isPinching && event.touches.length < 2) {
        this.suppressTapUntil = Date.now() + 250;
        this.touchState.isPinching = false;
      }
    },
    handleImageTap(event) {
      if (!this.isFreeCropMode || this.touchState.isPinching) return;
      if (Date.now() < this.suppressTapUntil) return;

      const rect = event.target.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const relativeY = y / rect.height;

      if (relativeY <= 0 || relativeY >= 1) return;

      this.cropLines.push(relativeY);
      this.cropLines.sort((a, b) => a - b);
    },
    freeCrop() {
      this.isFreeCropMode = !this.isFreeCropMode;
      this.showProportionalDialog = false;

      if (this.isFreeCropMode) {
        this.isProportionalCropMode = false;
      } else {
        this.cropLines = [];
      }
    },
    proportionalCrop() {
      if (this.isProportionalCropMode) {
        this.isProportionalCropMode = false;
        this.cropLines = [];
        return;
      }

      this.isFreeCropMode = false;
      this.showProportionalDialog = true;
    },
    cancelProportionalCrop() {
      this.showProportionalDialog = false;
    },
    applyProportionalCrop() {
      const count = parseInt(this.proportionalCount, 10);
      if (isNaN(count) || count < 2) {
        alert('请输入大于等于 2 的有效数字');
        return;
      }

      this.showProportionalDialog = false;
      this.isProportionalCropMode = true;
      this.cropLines = [];

      const step = 1 / count;
      for (let i = 1; i < count; i++) {
        this.cropLines.push(i * step);
      }
    },
    getPreviewStyle(seg) {
      const previewWidth = 110;
      const segmentHeightRatio = seg.end - seg.start;
      const actualHeight = this.imageInfo.height * segmentHeightRatio;
      const actualWidth = this.imageInfo.width || 1;
      const previewHeight = Math.max((actualHeight / actualWidth) * previewWidth, 30);

      return {
        width: `${previewWidth}px`,
        height: `${previewHeight}px`,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '8px',
        backgroundColor: '#e5e7eb'
      };
    },
    getPreviewImgStyle(seg) {
      const previewWidth = 110;
      const width = this.imageInfo.width || 1;
      const height = this.imageInfo.height || 1;
      const previewScale = previewWidth / width;
      const offsetY = -(seg.start * height * previewScale);

      return {
        position: 'absolute',
        top: `${offsetY}px`,
        left: '0',
        width: `${previewWidth}px`,
        height: 'auto',
        maxWidth: 'none'
      };
    },
    startLineLongPress(event, index) {
      this.cancelLineLongPress();

      this.longPressTimer = setTimeout(() => {
        this.openLineActionSheet(index);
      }, 450);
    },
    cancelLineLongPress() {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    },
    openLineActionSheet(index) {
      this.lineActionSheet.show = true;
      this.lineActionSheet.lineIndex = index;
    },
    closeLineActionSheet() {
      this.lineActionSheet.show = false;
      this.lineActionSheet.lineIndex = null;
    },
    deleteCropLine() {
      if (this.lineActionSheet.lineIndex === null) return;
      this.cropLines.splice(this.lineActionSheet.lineIndex, 1);
      this.closeLineActionSheet();
    },
    async downloadCroppedImages() {
      if (!this.imageUrl || this.cropLines.length === 0) return;

      try {
        const files = await this.buildSegmentFiles();
        const saveResult = await this.trySaveToAlbum(files);

        if (saveResult === 'success') {
          this.successMessage = '图片已成功保存到系统相册';
          this.showSuccessModal = true;
          return;
        }

        if (saveResult === 'aborted') {
          return;
        }

        await this.fallbackDownload(files);
        this.successMessage = '图片已打包为 ZIP 文件并开始下载';
        this.showSuccessModal = true;
      } catch (error) {
        console.error('保存图片失败:', error);
        alert('处理图片失败，请重试');
      }
    },
    async buildSegmentFiles() {
      const img = await this.loadImage(this.imageUrl);
      const segments = this.allCropSegments;
      const files = [];

      for (let index = 0; index < segments.length; index++) {
        const seg = segments[index];
        const blob = await this.segmentToBlob(img, seg);
        const name = `屏幕截图_${index + 1}.png`;
        files.push(new File([blob], name, { type: 'image/png' }));
      }

      return files;
    },
    async trySaveToAlbum(files) {
      if (this.canUseWebShareWithFiles()) {
        try {
          await navigator.share({
            title: '保存图片',
            files: files
          });
          return 'success';
        } catch (error) {
          if (error && error.name === 'AbortError') {
            return 'aborted';
          }
          console.warn('Web Share 保存到相册失败:', error);
        }
      }

      return 'failed';
    },
    canUseWebShareWithFiles() {
      if (!navigator.share || !navigator.canShare) return false;
      try {
        return navigator.canShare({
          files: [new File(['x'], 'x.png', { type: 'image/png' })]
        });
      } catch (error) {
        return false;
      }
    },
    async fallbackDownload(files) {
      const zipBlob = await this.buildZipBlob(files);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '截图分割.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    // 纯 JS ZIP 构建（Stored，无压缩），兼容所有现代浏览器
    async buildZipBlob(files) {
      const makeCrcTable = () => {
        const t = [];
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
          t[i] = c;
        }
        return t;
      };
      const crcTable = makeCrcTable();
      const crc32 = (buf) => {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
        return (crc ^ 0xFFFFFFFF) >>> 0;
      };

      const enc = new TextEncoder();
      const parts = [];
      const centralDir = [];
      let offset = 0;

      for (const file of files) {
        const nameBytes = enc.encode(file.name);
        const data = new Uint8Array(await file.arrayBuffer());
        const crc = crc32(data);
        const size = data.length;

        // Local file header
        const lh = new DataView(new ArrayBuffer(30 + nameBytes.length));
        lh.setUint32(0, 0x04034b50, true);
        lh.setUint16(4, 20, true);   // version needed
        lh.setUint16(6, 0, true);    // flags
        lh.setUint16(8, 0, true);    // method: stored
        lh.setUint16(10, 0, true);   // mod time
        lh.setUint16(12, 0, true);   // mod date
        lh.setUint32(14, crc, true);
        lh.setUint32(18, size, true); // compressed
        lh.setUint32(22, size, true); // uncompressed
        lh.setUint16(26, nameBytes.length, true);
        lh.setUint16(28, 0, true);   // extra length
        new Uint8Array(lh.buffer).set(nameBytes, 30);
        parts.push(lh.buffer, data.buffer);

        // Central directory entry (built later)
        const cd = new DataView(new ArrayBuffer(46 + nameBytes.length));
        cd.setUint32(0, 0x02014b50, true);
        cd.setUint16(4, 20, true);   // version made by
        cd.setUint16(6, 20, true);   // version needed
        cd.setUint16(8, 0, true);    // flags
        cd.setUint16(10, 0, true);   // method
        cd.setUint16(12, 0, true);   // mod time
        cd.setUint16(14, 0, true);   // mod date
        cd.setUint32(16, crc, true);
        cd.setUint32(20, size, true);
        cd.setUint32(24, size, true);
        cd.setUint16(28, nameBytes.length, true);
        cd.setUint16(30, 0, true);   // extra
        cd.setUint16(32, 0, true);   // comment
        cd.setUint16(34, 0, true);   // disk start
        cd.setUint16(36, 0, true);   // internal attr
        cd.setUint32(38, 0, true);   // external attr
        cd.setUint32(42, offset, true); // local header offset
        new Uint8Array(cd.buffer).set(nameBytes, 46);
        centralDir.push(cd.buffer);

        offset += 30 + nameBytes.length + size;
      }

      // End of central directory
      const cdSize = centralDir.reduce((s, b) => s + b.byteLength, 0);
      const eocd = new DataView(new ArrayBuffer(22));
      eocd.setUint32(0, 0x06054b50, true);
      eocd.setUint16(4, 0, true);
      eocd.setUint16(6, 0, true);
      eocd.setUint16(8, files.length, true);
      eocd.setUint16(10, files.length, true);
      eocd.setUint32(12, cdSize, true);
      eocd.setUint32(16, offset, true);
      eocd.setUint16(20, 0, true);

      return new Blob([...parts, ...centralDir, eocd.buffer], { type: 'application/zip' });
    },
    loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    },
    segmentToBlob(img, seg) {
      return new Promise((resolve) => {
        const sourceY = seg.start * img.naturalHeight;
        const sourceHeight = (seg.end - seg.start) * img.naturalHeight;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.naturalWidth;
        canvas.height = sourceHeight;
        ctx.drawImage(
          img,
          0, sourceY, img.naturalWidth, sourceHeight,
          0, 0, canvas.width, canvas.height
        );

        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    }
  }
};
</script>

<style scoped>
.mobile-home {
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%);
  color: #0f172a;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(90px + env(safe-area-inset-bottom));
}

.top-bar {
  padding: 16px 16px 10px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.logo-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
}

.sub-title {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 0.86rem;
}

.content {
  flex: 1;
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-container {
  flex: 1;
  min-height: 52vh;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.preview-container.empty {
  border: 2px dashed rgba(59, 130, 246, 0.35);
  background: rgba(255, 255, 255, 0.65);
}

.preview-container.drag-over {
  border-color: #3b82f6;
  background: #ffffff;
}

.scrollable-preview {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
  -webkit-overflow-scrolling: touch;
}

.image-wrapper {
  position: relative;
  display: inline-block;
  transform-origin: top left;
}

.screenshot-img {
  width: 100%;
  display: block;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.crosshair-cursor {
  cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' style='fill:none;stroke:black;stroke-width:2'><line x1='12' y1='6' x2='12' y2='18'/><line x1='6' y1='12' x2='18' y2='12'/></svg>") 12 12, crosshair;
}

.crop-line-indicator {
  position: absolute;
  left: 0;
  width: 100%;
  height: 4px;
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
  z-index: 15;
}

.line-label {
  position: absolute;
  right: 8px;
  top: -23px;
  background: #ef4444;
  color: #ffffff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.upload-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 14px;
  text-align: center;
  color: #64748b;
}

.upload-placeholder h2 {
  margin: 0;
  font-size: 1.05rem;
  color: #0f172a;
}

.upload-placeholder p {
  margin-top: 8px;
  font-size: 0.84rem;
}

.icon-circle {
  width: 74px;
  height: 74px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.13), rgba(14, 165, 233, 0.16));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  color: #2563eb;
}

.select-btn {
  margin-top: 10px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 0.92rem;
  font-weight: 600;
  padding: 10px 20px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  padding: 8px 10px;
}

.zoom-btn,
.zoom-reset {
  border: 1px solid rgba(15, 23, 42, 0.16);
  background: #ffffff;
  color: #0f172a;
  border-radius: 10px;
  padding: 6px 12px;
  font-size: 0.9rem;
}

.zoom-label {
  min-width: 50px;
  text-align: center;
  color: #334155;
  font-size: 0.88rem;
  font-weight: 600;
}

.crop-preview-tray {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  padding: 10px;
}

.tray-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tray-header h3 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
}

.tray-header span {
  font-size: 0.78rem;
  color: #475569;
}

.tray-list {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
  -webkit-overflow-scrolling: touch;
}

.preview-item {
  min-width: 126px;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.preview-item-inner {
  border-radius: 8px;
  overflow: hidden;
}

.preview-label {
  font-size: 0.76rem;
  color: #475569;
}

.bottom-toolbar {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(10px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 16px;
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.14);
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  z-index: 50;
}

.toolbar-btn {
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #ffffff;
  color: #334155;
  border-radius: 10px;
  padding: 10px 8px;
  font-size: 0.87rem;
  font-weight: 600;
}

.toolbar-btn.active {
  border-color: #3b82f6;
  color: #2563eb;
  background: rgba(59, 130, 246, 0.08);
}

.toolbar-btn.primary {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.modal-overlay,
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 80;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  width: calc(100vw - 36px);
  max-width: 340px;
  background: #ffffff;
  border-radius: 14px;
  padding: 20px;
}

.modal-content h3 {
  margin: 0;
  font-size: 1.05rem;
}

.modal-content p {
  margin: 10px 0 14px;
  color: #64748b;
  font-size: 0.86rem;
}

.modal-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 10px;
  background: #f8fafc;
  padding: 10px 12px;
  font-size: 1rem;
  margin-bottom: 16px;
  text-align: center;
}

.modal-actions {
  display: flex;
  gap: 10px;
}

.modal-btn {
  flex: 1;
  border: none;
  border-radius: 10px;
  padding: 10px 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.modal-btn.secondary {
  background: #e2e8f0;
  color: #334155;
}

.modal-btn.primary {
  background: #2563eb;
  color: #ffffff;
}

.sheet-mask {
  align-items: flex-end;
}

.sheet-panel {
  width: 100%;
  background: #ffffff;
  border-radius: 16px 16px 0 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sheet-btn {
  border: none;
  border-radius: 10px;
  background: #f1f5f9;
  padding: 12px;
  color: #334155;
  font-size: 0.95rem;
  font-weight: 600;
}

.sheet-btn.danger {
  background: #fee2e2;
  color: #b91c1c;
}

/* 成功弹框专属样式 */
.success-modal {
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
}

.success-content {
  text-align: center;
  padding: 30px 24px;
  animation: modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.success-icon {
  width: 72px;
  height: 72px;
  background: #f0fdf4;
  color: #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.success-content h3 {
  color: #0f172a;
  font-size: 1.25rem;
  margin-bottom: 8px;
}

.success-content p {
  color: #64748b;
  margin-bottom: 24px;
  line-height: 1.5;
}

@keyframes modalScaleUp {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
