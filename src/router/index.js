import Vue from 'vue'
import VueRouter from 'vue-router'
import DesktopHome from '../views/DesktopHome.vue'
import MobileHome from '../views/MobileHome.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/desktop',
    name: 'Desktop',
    component: DesktopHome
  },
  {
    path: '/mobile',
    name: 'Mobile',
    component: MobileHome
  },
  {
    path: '*',
    redirect: () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      return isMobile ? '/mobile' : '/desktop';
    }
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

// 也可以在路由守卫中增强逻辑，确保用户手动切换路由时也能保持正确的终端显示（可选）
router.beforeEach((to, from, next) => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  // 如果访问根路径，根据设备跳转
  if (to.path === '/') {
    return next(isMobile ? '/mobile' : '/desktop');
  }
  
  // 如果用户手动在桌面端访问移动端页面，或者反之，可以根据需要决定是否强制跳转
  // 这里暂时允许手动访问，方便调试
  next();
})

export default router
