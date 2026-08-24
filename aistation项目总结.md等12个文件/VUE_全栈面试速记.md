# Vue / uni-app 全栈面试速记

## 1. 先记住 Vue 到底是什么

- Vue 是一个前端框架，本质是“数据驱动视图”。
- 你改的是数据，Vue 负责把变化同步到页面。
- 页面可以理解为：`状态 + 模板 + 交互`。

一句话回答：

> Vue 的核心是响应式和组件化。开发者维护状态，Vue 负责根据状态变化更新 DOM。

## 2. Vue2 和 Vue3 的核心区别

### 2.1 写法区别

Vue2 常见写法：

```js
export default {
  data() {
    return {
      count: 0,
    };
  },
  methods: {
    add() {
      this.count++;
    },
  },
  mounted() {
    console.log('mounted');
  },
};
```

Vue3 常见写法：

```ts
import { ref, onMounted } from 'vue';

export default {
  setup() {
    const count = ref(0);

    function add() {
      count.value++;
    }

    onMounted(() => {
      console.log('mounted');
    });

    return {
      count,
      add,
    };
  },
};
```

### 2.2 设计区别

- Vue2 主要是 `Options API`
- Vue3 主要是 `Composition API`
- Vue3 的逻辑复用更强，TypeScript 支持更好
- Vue3 响应式底层更强，复杂状态管理更自然

一句话回答：

> Vue2 更偏按选项组织代码，Vue3 更偏按功能组织代码，所以 Vue3 在复杂页面和可维护性上更有优势。

## 3. 什么是响应式

- 响应式就是：数据变了，页面自动更新。
- Vue 会追踪你用到的数据，当数据变化时，重新渲染依赖它的地方。

Vue3 常见响应式 API：

- `ref`：适合基本类型，也能包对象
- `reactive`：更适合对象
- `computed`：基于已有状态派生新状态
- `watch`：监听变化后执行副作用

例子：

```ts
import { ref, computed, watch } from 'vue';

const price = ref(100);
const count = ref(2);

const total = computed(() => price.value * count.value);

watch(count, (newValue) => {
  console.log('数量变了', newValue);
});
```

## 4. `ref` 和 `reactive` 区别

### `ref`

- 常用于数字、字符串、布尔值
- 访问时要写 `.value`

```ts
const count = ref(0);
count.value++;
```

### `reactive`

- 常用于对象、数组
- 不需要 `.value`

```ts
const form = reactive({
  name: '',
  age: 18,
});

form.name = 'slan';
```

面试回答：

> `ref` 更适合单值，`reactive` 更适合对象。Vue3 内部都会转成响应式代理，只是使用方式不同。

## 5. `computed` 和 `watch` 区别

### `computed`

- 用来“算一个值”
- 有缓存
- 依赖不变时不会重复计算

### `watch`

- 用来“监听变化后执行动作”
- 常用于请求接口、埋点、同步本地存储

例子：

```ts
const fullName = computed(() => `${firstName.value}${lastName.value}`);

watch(route, () => {
  loadData();
});
```

面试回答：

> `computed` 是派生状态，关注返回值；`watch` 是副作用，关注变化后做什么。

## 6. 生命周期是什么

生命周期就是组件从“创建 -> 挂载 -> 更新 -> 销毁”的过程。

### 6.1 Vue2 常见生命周期

- `beforeCreate`
- `created`
- `beforeMount`
- `mounted`
- `beforeUpdate`
- `updated`
- `beforeDestroy`
- `destroyed`

### 6.2 Vue3 常见生命周期

- `setup`
- `onBeforeMount`
- `onMounted`
- `onBeforeUpdate`
- `onUpdated`
- `onBeforeUnmount`
- `onUnmounted`

### 6.3 最常用的是哪些

- `onMounted`：页面首次渲染完成后，请求数据、初始化第三方库
- `onUnmounted`：清理定时器、取消监听、关闭连接

一句话回答：

> 生命周期就是组件在不同阶段触发的钩子函数，最常见的场景是 mounted 拉数据，unmounted 做清理。

## 7. uni-app 页面生命周期

uni-app 不只是 Vue 组件生命周期，还有页面生命周期：

- `onLoad`：页面加载时触发，常拿路由参数
- `onShow`：页面显示时触发
- `onHide`：页面隐藏时触发
- `onUnload`：页面销毁时触发
- `onPullDownRefresh`：下拉刷新

常见理解：

- `onLoad`：只进一次
- `onShow`：每次回到页面都会触发

面试回答：

> 在 uni-app 里要分清组件生命周期和页面生命周期，比如页面重新展示通常用 `onShow`，而不是只靠 `mounted`。

## 8. 组件通信怎么做

### 父传子

- `props`

### 子传父

- `emit`

### 跨层级

- `provide / inject`

### 全局共享

- Pinia / Vuex

例子：

```ts
const emit = defineEmits(['success']);

function submit() {
  emit('success');
}
```

## 9. `v-if` 和 `v-show` 区别

- `v-if`：真的创建/销毁 DOM
- `v-show`：只是 `display: none`

怎么选：

- 切换不频繁：`v-if`
- 切换很频繁：`v-show`

## 10. `key` 有什么用

- `key` 是虚拟 DOM diff 的标识
- 帮助 Vue 判断两个节点是不是同一个
- 列表渲染时必须稳定

错误示例：

```vue
<view v-for="(item, index) in list" :key="index"></view>
```

更好的是：

```vue
<view v-for="item in list" :key="item.id"></view>
```

## 11. 为什么不要乱改响应式对象

Vue 页面里通常有三层数据：

- 接口原始数据
- 页面状态
- 表单状态

如果全都混在一个对象里，后面就容易乱。

比如这类代码：

```ts
formData.value = await getDetail(id);
await formApi.setValues(formData.value);
```

虽然能跑，但如果后面又写：

```ts
await syncSchema(formData.value.ownerId, formData.value.moduleId);
await formApi.setValues(formData.value);
```

问题是：

- `formData.value` 既像“接口数据”
- 又像“当前页面状态”
- 又像“表单输入源”

角色混在一起。

## 12. 为什么先用 `entity` 再回填表单

现在更推荐这样写：

```ts
const entity = await getDetail(id);
formData.value = entity;
await formApi.setValues(entity);
```

如果还有依赖字段：

```ts
const entity = await getDetail(id);
formData.value = entity;
await syncSchema(entity.ownerId, entity.moduleId);
await formApi.setValues(entity);
```

### 这样做的技术原理

- `entity` 是这一轮接口返回的“稳定快照”
- 后续逻辑都基于这份快照运行
- 避免多次读取 `formData.value`
- 让“接口数据”和“页面状态”分开

### 好处

- 可读性更好
- 调试更方便
- 减少响应式对象混用
- 方便后面加标准化处理 `normalizeEntity`

面试回答：

> 先用 `entity` 承接接口返回值，本质上是把“本次初始化的数据快照”固定下来，避免把响应式状态同时当作接口源、页面状态和表单值来源使用。

## 13. 什么是标准化 / normalize

标准化就是把不同来源的数据整理成同一套前端结构。

比如后端可能有三种数据：

- 酒店：`hotelId`
- 景区：`scenicId`
- 餐饮：`restaurantId`

前端通用页如果直接写死，就会很乱。

所以会做：

- `normalizeOwnerPayload`
- `normalizeOwnerEntity`

作用是：

- 对外统一接口
- 对内隐藏差异

面试回答：

> normalize 的本质是做数据适配层，把不同后端结构统一成前端通用结构，降低页面复杂度。

## 14. 为什么会出现“兼容层”

项目重构时经常会遇到：

- 老页面还在
- 新页面已经上线
- 老菜单没全部迁完
- 新旧接口同时存在

这时就会出现兼容层，比如：

- 路由前缀识别业态
- guide 复用 scenic
- 不同 owner 接口统一映射

这不是最优终态，但常见于迁移阶段。

面试回答：

> 兼容层通常出现在重构中间态，用来保证旧入口和新入口同时可用。理想状态是迁移完成后再逐步删除兼容代码。

## 15. 路由是什么

前端路由就是“URL 和页面组件之间的映射关系”。

例如：

- `/food/feedback` -> 饭店反馈页
- `/base/owner/index` -> 通用主体管理页

Vue Router 常见点：

- `useRoute()`：拿当前路由信息
- `useRouter()`：做跳转

例子：

```ts
const route = useRoute();
const router = useRouter();

router.push('/food/feedback');
```

## 16. `nextTick` 是什么

- Vue 更新 DOM 不是每次同步立刻更新
- `nextTick` 表示“等 DOM 更新完再执行”

例子：

```ts
count.value++;
await nextTick();
console.log('现在 DOM 已更新');
```

## 17. Pinia 是什么

- Pinia 是 Vue3 官方推荐状态管理库
- 用来管理跨页面共享状态

常见共享内容：

- 用户信息
- token
- tenantId
- 当前主体信息

面试回答：

> Pinia 用于全局状态共享，适合放跨组件、跨页面都要使用的数据。

## 18. 前后端联调时要知道什么

### 常见流程

1. 页面加载
2. 调接口
3. 拿到数据
4. 标准化
5. 回填页面 / 表单
6. 用户修改后再提交

### 常见问题

- 字段名不一致
- 类型不一致
- 空值处理混乱
- 新旧接口并存
- 权限和业态判断写死

## 19. 面试里最常见的 Vue 题

### 题：Vue2 和 Vue3 区别

答：

> Vue2 主要基于 Options API，Vue3 更强调 Composition API。Vue3 在逻辑复用、类型支持、复杂页面组织上更强，响应式实现也更现代。

### 题：`ref` 和 `reactive` 区别

答：

> `ref` 更适合单值，`reactive` 更适合对象。`ref` 访问要 `.value`，`reactive` 不需要。

### 题：`computed` 和 `watch` 区别

答：

> `computed` 用来派生状态，有缓存；`watch` 用来处理副作用，比如请求接口、同步存储、埋点。

### 题：生命周期怎么理解

答：

> 生命周期就是组件从创建、挂载、更新到销毁的不同阶段。开发里常在 mounted 拉数据，在 unmounted 做清理。

### 题：为什么要先用 `entity` 再 `setValues`

答：

> 因为这样能把接口返回值固定成一份稳定快照，避免把 `formData.value` 同时当接口数据、页面状态和表单值来源，数据流更清晰。

## 20. 你现在最该补的重点

如果你要面全栈工程师，Vue 这块至少要会：

- Vue2 / Vue3 区别
- `ref / reactive / computed / watch`
- 组件生命周期
- uni-app 页面生命周期
- 组件通信
- 路由
- Pinia
- 表单回填和接口数据流
- 兼容层、标准化层、通用页面思路

## 21. 最后给你一个超短背诵版

你可以直接背：

> Vue 的核心是响应式和组件化。Vue2 主要是 Options API，Vue3 主要是 Composition API。`ref` 适合单值，`reactive` 适合对象，`computed` 用来派生状态，`watch` 用来做副作用。生命周期是组件从创建到销毁的不同阶段，常见的是 mounted 拉数据、unmounted 做清理。uni-app 还要区分 `onLoad`、`onShow` 这些页面生命周期。表单场景里先用 `entity` 接接口数据，再回填 `formData` 和表单，是为了固定一份稳定快照，避免响应式状态混用。复杂项目里经常会有 normalize 和兼容层，用来统一多种后端结构和新旧页面入口。 
