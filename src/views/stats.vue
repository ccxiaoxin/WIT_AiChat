<template>
  <div class="stats-container">
    <div class="header">
      <h2>数据统计看板</h2>
      <n-button @click="$router.push('/chat')">返回对话</n-button>
    </div>

    <n-grid :x-gap="20" :y-gap="20" cols="1 s:1 m:2" responsive="screen">
      <!-- 分类统计饼图 -->
      <n-grid-item>
        <n-card title="热门提问分类统计" :bordered="false" class="chart-card">
          <div v-if="loadingCategories" class="loading-state">
            <n-spin size="large" />
          </div>
          <v-chart v-else class="chart" :option="pieOption" autoresize />
        </n-card>
      </n-grid-item>

      <!-- 反馈统计/说明 -->
      <n-grid-item>
        <n-card title="系统运营概况" :bordered="false" class="chart-card">
          <n-statistic label="总计收到差评反馈" :value="dislikedList.length">
            <template #prefix>
              <div class="i-carbon-thumbs-down text-error"></div>
            </template>
          </n-statistic>
          <div class="mt-4 text-gray-500 text-14">
            <p>💡 提示：</p>
            <p>1. 饼图展示了用户最常提问的知识分类，帮助您了解用户痛点。</p>
            <p>2. 下方的表格列出了所有被用户“点踩”的回答，您可以根据这些反馈，去“知识库管理”中补充或修改对应的文档切片，从而不断提升系统的准确率。</p>
          </div>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 差评反馈列表 -->
    <n-card title="待优化回答列表 (用户点踩)" :bordered="false" class="mt-5">
      <n-data-table
        :columns="columns"
        :data="dislikedList"
        :loading="loadingFeedbacks"
        :pagination="{ pageSize: 10 }"
      />
    </n-card>
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

// 注册 ECharts 组件
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

// 状态
const loadingCategories = ref(false)
const loadingFeedbacks = ref(false)
const categoryData = ref<{ name: string, value: number }[]>([])
const dislikedList = ref<any[]>([])

// 饼图配置
const pieOption = computed(() => {
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}次 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '提问分类',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
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

// 表格列定义
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
      return h(NTag, { type: 'info', size: 'small' }, { default: () => categoryMap[row.category] || row.category })
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
      return h(NTag, { type: 'error', size: 'small' }, { default: () => row.reason })
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render(row: any) {
      return h(
        NButton,
        { 
          size: 'small', 
          type: 'primary', 
          ghost: true,
          onClick: () => {
            // 跳转到知识库管理页面，并可以通过 query 传递分类，方便管理员直接去改
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
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-card {
  height: 400px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.chart {
  height: 320px;
  width: 100%;
}

.loading-state {
  height: 320px;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>