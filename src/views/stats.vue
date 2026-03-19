<template>
  <div class="stats-container">
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon">
          <div class="i-carbon-analytics text-28"></div>
        </div>
        <div class="header-text">
          <h2>数据统计看板</h2>
          <p>实时监控系统运营数据</p>
        </div>
      </div>
      <n-button @click="$router.push('/chat')">
        <template #icon><div class="i-carbon-chat"></div></template>
        返回对话
      </n-button>
    </div>

    <n-grid :x-gap="24" :y-gap="24" cols="1 s:1 m:2" responsive="screen">
      <!-- 分类统计饼图 -->
      <n-grid-item>
        <div class="stat-card">
          <div class="card-header">
            <div class="card-icon chart-icon">
              <div class="i-carbon-chart-pie text-20"></div>
            </div>
            <span class="card-title">热门提问分类</span>
          </div>
          <div v-if="loadingCategories" class="loading-state">
            <n-spin size="large" />
          </div>
          <v-chart v-else class="chart" :option="pieOption" autoresize />
        </div>
      </n-grid-item>

      <!-- 反馈统计/说明 -->
      <n-grid-item>
        <div class="stat-card info-card">
          <div class="card-header">
            <div class="card-icon info-icon">
              <div class="i-carbon-information text-20"></div>
            </div>
            <span class="card-title">系统运营概况</span>
          </div>
          <div class="stat-number">
            <div class="stat-value">
              <div class="i-carbon-thumbs-down stat-icon"></div>
              <span>{{ dislikedList.length }}</span>
            </div>
            <div class="stat-label">待优化回答数</div>
          </div>
          <div class="tips-section">
            <div class="tip-item">
              <div class="tip-icon">💡</div>
              <span>饼图展示用户最常提问的知识分类，帮助了解用户痛点</span>
            </div>
            <div class="tip-item">
              <div class="tip-icon">📊</div>
              <span>下方表格列出被用户"点踩"的回答，可据此优化知识库</span>
            </div>
          </div>
        </div>
      </n-grid-item>
    </n-grid>

    <!-- 差评反馈列表 -->
    <div class="feedback-section">
      <div class="section-header">
        <div class="section-title">
          <div class="title-icon">
            <div class="i-carbon-warning-alt text-20"></div>
          </div>
          <span>待优化回答列表</span>
        </div>
        <n-tag type="warning" round>{{ dislikedList.length }} 条待处理</n-tag>
      </div>
      <n-data-table
        :columns="columns"
        :data="dislikedList"
        :loading="loadingFeedbacks"
        :pagination="{ pageSize: 10 }"
        class="feedback-table"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue'
import { useMessage, NTag, NButton } from 'naive-ui'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent
} from 'echarts/components'
import VChart, { THEME_KEY } from 'vue-echarts'
import { getCategoryStats, getDislikedFeedbacks } from '@/api'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'

const router = useRouter()
const message = useMessage()

use([
  CanvasRenderer,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent
])

const categoryMap: Record<string, string> = {
  policy_postgraduate: '保研政策',
  policy_scholarship: '奖学金政策',
  policy_graduation: '毕业论文/设计',
  policy_major_split: '专业分流',
  policy_general: '通用政策',
  major_intro: '专业介绍',
  major_program: '培养方案',
  career: '就业方向',
  general: '通用问答'
}

const loadingCategories = ref(false)
const loadingFeedbacks = ref(false)
const categoryData = ref<{ name: string, value: number }[]>([])
const dislikedList = ref<any[]>([])

const pieOption = computed(() => {
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}次 ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: {
        color: '#333'
      }
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: {
        color: '#666'
      }
    },
    color: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'],
    series: [
      {
        name: '提问分类',
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['55%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 3
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold',
            color: '#333'
          },
          itemStyle: {
            shadowBlur: 20,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        labelLine: {
          show: false
        },
        data: categoryData.value.map(item => ({
          name: categoryMap[item.name] || item.name,
          value: item.value
        }))
      }
    ]
  }
})

const columns = [
  {
    title: '时间',
    key: 'timestamp',
    width: 160,
    render(row: any) {
      return dayjs(row.timestamp).format('YYYY-MM-DD HH:mm')
    }
  },
  {
    title: '用户',
    key: 'username',
    width: 100
  },
  {
    title: '分类',
    key: 'category',
    width: 120,
    render(row: any) {
      return h(NTag, { type: 'info', size: 'small', round: true }, { default: () => categoryMap[row.category] || row.category })
    }
  },
  {
    title: '用户提问',
    key: 'question',
    ellipsis: { tooltip: true }
  },
  {
    title: '点踩原因',
    key: 'reason',
    width: 120,
    render(row: any) {
      return h(NTag, { type: 'error', size: 'small', round: true }, { default: () => row.reason })
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    render(row: any) {
      return h(
        NButton,
        { 
          size: 'small', 
          type: 'primary', 
          ghost: true,
          round: true,
          onClick: () => {
            router.push({ path: '/chat/knowledge' })
          }
        },
        { default: () => '去优化知识库' }
      )
    }
  }
]

const loadData = async () => {
  loadingCategories.value = true
  loadingFeedbacks.value = true

  try {
    const [catRes, feedRes] = await Promise.all([
      getCategoryStats(),
      getDislikedFeedbacks()
    ])

    if (catRes.success) {
      categoryData.value = catRes.data
    }
    if (feedRes.success) {
      dislikedList.value = feedRes.data
    }
  } catch (error: any) {
    message.error('获取统计数据失败: ' + error.message)
  } finally {
    loadingCategories.value = false
    loadingFeedbacks.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.stats-container {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
  padding: 24px 28px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.page-header :deep(.n-button) {
  border-radius: 10px;
  height: 40px;
  padding: 0 20px;
  font-weight: 500;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);
}

.header-text h2 {
  margin: 0 0 4px 0;
  font-size: 22px;
  font-weight: 700;
  color: #333;
}

.header-text p {
  margin: 0;
  font-size: 14px;
  color: #888;
}

.stat-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  height: 400px;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.chart-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.info-icon {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.chart {
  flex: 1;
  width: 100%;
}

.loading-state {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.info-card {
  display: flex;
  flex-direction: column;
}

.stat-number {
  text-align: center;
  padding: 30px 0;
  background: linear-gradient(135deg, rgba(255, 77, 79, 0.08) 0%, rgba(255, 77, 79, 0.02) 100%);
  border-radius: 12px;
  margin-bottom: 20px;
}

.stat-value {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 8px;
}

.stat-value span {
  font-size: 48px;
  font-weight: 700;
  color: #ff4d4f;
}

.stat-icon {
  font-size: 32px;
  color: #ff4d4f;
}

.stat-label {
  font-size: 14px;
  color: #888;
}

.tips-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: #f8f9fc;
  border-radius: 10px;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.tip-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.feedback-section {
  margin-top: 24px;
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.title-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #fa8c16 0%, #faad14 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.feedback-table :deep(.n-data-table-th) {
  background: #f8f9fc;
  font-weight: 600;
  color: #555;
}

.feedback-table :deep(.n-data-table-td) {
  padding: 14px 12px;
}

.feedback-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: #f8f9fc;
}
</style>
