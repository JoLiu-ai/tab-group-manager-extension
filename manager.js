// 管理页面主逻辑
let currentWindowId = null;
let selectedGroupId = null;
let selectedTabIds = new Set();
let categories = [];
let groups = [];
let tabs = [];
let expandedCategories = new Set();
let closedGroups = []; // 已关闭的标签组历史
let isHistoryView = false; // 是否显示历史视图

// DOM 元素
const tagGroupsList = document.getElementById('tagGroupsList');
const tabsListContainer = document.getElementById('tabsListContainer');
const selectedGroupHeader = document.getElementById('selectedGroupHeader');
const selectedGroupTitle = document.getElementById('selectedGroupTitle');
const selectedGroupTabCount = document.getElementById('selectedGroupTabCount');
const selectedGroupTime = document.getElementById('selectedGroupTime');
const selectionCounter = document.getElementById('selectionCounter');
const searchInput = document.getElementById('searchInput');
const emptyState = document.getElementById('emptyState');

// 统计元素
const categoryCount = document.getElementById('categoryCount');
const groupCount = document.getElementById('groupCount');
const tabCount = document.getElementById('tabCount');
const currentGroupCount = document.getElementById('currentGroupCount');
const currentTabCount = document.getElementById('currentTabCount');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await init();
  setupEventListeners();
});

// 初始化
async function init() {
  try {
    // 获取当前窗口
    const window = await chrome.windows.getCurrent();
    currentWindowId = window.id;

    // 加载数据
    await loadData();
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

// 加载所有数据
async function loadData() {
  try {
    if (isHistoryView) {
      // 加载历史数据
      await loadHistoryData();
    } else {
      // 加载当前数据
      // 加载标签组
      groups = await chrome.tabGroups.query({ windowId: currentWindowId });
      
      // 加载标签页
      tabs = await chrome.tabs.query({ windowId: currentWindowId });
    }
    
    // 加载分类（从存储中）
    const result = await chrome.storage.local.get(['categories']);
    categories = result.categories || [];
    
    // 更新统计
    updateStats();
    
    // 渲染界面
    renderTagGroups();
  } catch (error) {
    console.error('加载数据失败:', error);
  }
}

// 加载历史数据
async function loadHistoryData() {
  try {
    // 加载已关闭的标签组历史
    const result = await chrome.storage.local.get(['closedGroupHistory', 'groupHistory']);
    closedGroups = result.closedGroupHistory || [];
    
    // 将历史数据转换为与当前标签组相同的格式
    groups = closedGroups.map(closedGroup => ({
      id: closedGroup.id,
      title: closedGroup.title,
      color: closedGroup.color,
      collapsed: closedGroup.collapsed,
      windowId: closedGroup.windowId,
      isClosed: true,
      closedAt: closedGroup.closedAt,
      tabs: closedGroup.tabs || []
    }));
    
    // 加载历史标签页信息
    tabs = [];
    for (const group of groups) {
      if (group.tabs && Array.isArray(group.tabs)) {
        for (const tab of group.tabs) {
          if (tab.url && tab.title) {
            tabs.push({
              id: tab.id,
              url: tab.url,
              title: tab.title,
              favIconUrl: tab.favIconUrl,
              groupId: group.id
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('加载历史数据失败:', error);
  }
}

// 更新统计信息
function updateStats() {
  // 计算分类数量（如果有分类功能）
  const categoryNum = categories.length || (isHistoryView ? 0 : 1); // 历史视图可能没有分类
  categoryCount.textContent = categoryNum;
  
  // 标签组数量
  groupCount.textContent = groups.length;
  
  // 标签页数量（去重）
  const uniqueTabs = new Set();
  tabs.forEach(tab => {
    if (tab.url) uniqueTabs.add(tab.url);
  });
  tabCount.textContent = isHistoryView ? uniqueTabs.size : tabs.length;
  
  // 当前分类统计（暂时使用全部）
  currentGroupCount.textContent = groups.length;
  currentTabCount.textContent = isHistoryView ? uniqueTabs.size : tabs.length;
}

// 渲染标签组列表
async function renderTagGroups() {
  tagGroupsList.innerHTML = '';
  
  if (groups.length === 0) {
    tagGroupsList.innerHTML = '<div class="empty-state"><p>还没有标签组</p></div>';
    return;
  }
  
  // 收集所有已分类的标签组ID
  const categorizedGroupIds = new Set();
  if (categories.length > 0) {
    categories.forEach(category => {
      if (category.groups && Array.isArray(category.groups)) {
        category.groups.forEach(groupId => {
          categorizedGroupIds.add(groupId);
        });
      }
    });
  }
  
  // 如果有分类，按分类分组
  if (categories.length > 0) {
    categories.forEach(category => {
      const categoryItem = createCategoryItem(category);
      tagGroupsList.appendChild(categoryItem);
    });
    
    // 未分类的标签组（显示所有不在任何分类中的标签组）
    const uncategorizedGroups = groups.filter(g => !categorizedGroupIds.has(g.id));
    if (uncategorizedGroups.length > 0) {
      uncategorizedGroups.forEach(group => {
        const groupItem = createTagGroupItem(group);
        tagGroupsList.appendChild(groupItem);
      });
    }
  } else {
    // 没有分类，直接显示所有标签组
    groups.forEach(group => {
      const groupItem = createTagGroupItem(group);
      tagGroupsList.appendChild(groupItem);
    });
  }
  
  // 确保所有标签组都被显示（安全检查）
  const displayedGroupIds = new Set();
  tagGroupsList.querySelectorAll('.tag-group-item').forEach(item => {
    const groupId = parseInt(item.dataset.groupId);
    if (groupId && !isNaN(groupId)) {
      displayedGroupIds.add(groupId);
    }
  });
  
  // 如果有没有显示的标签组，直接添加到列表末尾（未分类区域）
  const missingGroups = groups.filter(group => !displayedGroupIds.has(group.id));
  if (missingGroups.length > 0) {
    console.log(`发现 ${missingGroups.length} 个未显示的标签组，已添加到列表末尾`);
    missingGroups.forEach(group => {
      const groupItem = createTagGroupItem(group);
      tagGroupsList.appendChild(groupItem);
    });
  }
}

// 创建分类项
function createCategoryItem(category) {
  const categoryDiv = document.createElement('div');
  categoryDiv.className = 'category-item';
  
  const header = document.createElement('div');
  header.className = 'category-header';
  header.dataset.categoryId = category.id;
  
  const toggle = document.createElement('div');
  toggle.className = `category-toggle ${expandedCategories.has(category.id) ? '' : 'collapsed'}`;
  toggle.textContent = '▼';
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCategory(category.id);
  });
  
  const name = document.createElement('div');
  name.className = 'category-name';
  name.textContent = category.name || '未命名分类';
  
  header.appendChild(toggle);
  header.appendChild(name);
  
  const children = document.createElement('div');
  children.className = `category-children ${expandedCategories.has(category.id) ? 'expanded' : ''}`;
  
  // 添加该分类下的标签组
  if (category.groups && category.groups.length > 0) {
    category.groups.forEach(groupId => {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        const groupItem = createTagGroupItem(group);
        children.appendChild(groupItem);
      }
    });
  }
  
  categoryDiv.appendChild(header);
  categoryDiv.appendChild(children);
  
  return categoryDiv;
}

// 切换分类展开/折叠
function toggleCategory(categoryId) {
  if (expandedCategories.has(categoryId)) {
    expandedCategories.delete(categoryId);
  } else {
    expandedCategories.add(categoryId);
  }
  // 直接更新DOM，避免重新渲染整个列表
  const categoryItems = tagGroupsList.querySelectorAll('.category-item');
  categoryItems.forEach(item => {
    const header = item.querySelector('.category-header');
    if (header && header.dataset.categoryId) {
      const catId = parseInt(header.dataset.categoryId);
      if (catId === categoryId) {
        const toggle = header.querySelector('.category-toggle');
        const children = item.querySelector('.category-children');
        if (toggle && children) {
          if (expandedCategories.has(categoryId)) {
            toggle.classList.remove('collapsed');
            children.classList.add('expanded');
          } else {
            toggle.classList.add('collapsed');
            children.classList.remove('expanded');
          }
        }
      }
    }
  });
}

// 创建标签组项
function createTagGroupItem(group) {
  const item = document.createElement('div');
  item.className = `tag-group-item ${selectedGroupId === group.id ? 'selected' : ''}`;
  item.dataset.groupId = group.id;
  
  // 如果是历史记录，添加特殊样式
  if (group.isClosed) {
    item.classList.add('history-group');
  }
  
  const icon = document.createElement('div');
  icon.className = 'group-icon';
  icon.textContent = getGroupIcon(group);
  
  const name = document.createElement('div');
  name.className = 'group-name';
  let nameText = group.title || '未命名标签组';
  if (group.isClosed) {
    nameText += ' [已关闭]';
  }
  name.textContent = nameText;
  
  const editBtn = document.createElement('button');
  editBtn.className = 'group-edit-btn';
  editBtn.textContent = '✎';
  editBtn.title = '编辑';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // TODO: 实现编辑功能
  });
  
  item.appendChild(icon);
  item.appendChild(name);
  item.appendChild(editBtn);
  
  // 点击选择标签组
  item.addEventListener('click', (e) => {
    if (e.target !== editBtn) {
      selectGroup(group);
    }
  });
  
  return item;
}

// 获取标签组图标
function getGroupIcon(group) {
  // 可以根据标签组的颜色或其他属性返回不同的图标
  const iconMap = {
    'grey': '📁',
    'blue': '💎',
    'red': '⭐',
    'yellow': '🔧',
    'green': '📚',
    'pink': '🎬',
    'purple': '📖',
    'cyan': '🌐'
  };
  return iconMap[group.color] || '📁';
}

// 选择标签组
async function selectGroup(group) {
  selectedGroupId = group.id;
  selectedTabIds.clear();
  
  // 更新选中状态
  document.querySelectorAll('.tag-group-item').forEach(item => {
    item.classList.remove('selected');
    // 检查是否是当前选中的组
    const groupId = item.dataset.groupId;
    if (groupId && parseInt(groupId) === group.id) {
      item.classList.add('selected');
    }
  });
  
  // 显示选中组的头部信息
  selectedGroupHeader.style.display = 'block';
  selectedGroupTitle.textContent = group.title || '未命名标签组';
  
  // 获取该组的标签页
  let groupTabs = [];
  if (isHistoryView) {
    // 历史视图：从保存的数据中获取标签页
    groupTabs = group.tabs || [];
  } else {
    // 当前视图：从 Chrome API 获取
    try {
      groupTabs = await chrome.tabs.query({ groupId: group.id, windowId: currentWindowId });
    } catch (error) {
      console.error('获取标签页失败:', error);
      groupTabs = [];
    }
  }
  
  selectedGroupTabCount.textContent = `${groupTabs.length}个标签页`;
  
  // 更新时间
  let timeText = '';
  if (isHistoryView && group.closedAt) {
    const closedDate = new Date(group.closedAt);
    timeText = '关闭于: ' + closedDate.toLocaleDateString('zh-CN') + ' ' + closedDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else {
    const now = new Date();
    timeText = now.toLocaleDateString('zh-CN') + ' ' + now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  selectedGroupTime.textContent = timeText;
  
  // 渲染标签页列表
  renderTabsList(groupTabs);
  
  // 更新选择计数器
  updateSelectionCounter();
}

// 渲染标签页列表
function renderTabsList(groupTabs) {
  tabsListContainer.innerHTML = '';
  
  if (groupTabs.length === 0) {
    emptyState.style.display = 'block';
    emptyState.textContent = isHistoryView ? '该标签组没有保存的标签页信息' : '该群组中没有标签页';
    return;
  }
  
  emptyState.style.display = 'none';
  
  groupTabs.forEach(tab => {
    const tabItem = createTabItem(tab);
    tabsListContainer.appendChild(tabItem);
  });
}

// 创建标签页项
function createTabItem(tab) {
  const item = document.createElement('div');
  item.className = 'tab-item';
  
  // 历史标签页可能没有 id，使用 url 作为标识
  const tabIdentifier = tab.id || tab.url;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tab-checkbox';
  checkbox.checked = selectedTabIds.has(tabIdentifier);
  checkbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      selectedTabIds.add(tabIdentifier);
    } else {
      selectedTabIds.delete(tabIdentifier);
    }
    updateSelectionCounter();
    item.classList.toggle('selected', e.target.checked);
  });
  
  const dragHandle = document.createElement('div');
  dragHandle.className = 'tab-drag-handle';
  dragHandle.textContent = '☰';
  dragHandle.title = '拖拽排序';
  
  // 历史视图中不显示拖拽手柄
  if (isHistoryView) {
    dragHandle.style.display = 'none';
  }
  
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23999"/></svg>';
  favicon.onerror = () => {
    favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23999"/></svg>';
  };
  
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || tab.url || '无标题';
  title.title = tab.url || '';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close-btn';
  closeBtn.textContent = '×';
  closeBtn.title = isHistoryView ? '查看历史' : '移除';
  
  if (!isHistoryView) {
    closeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('确定要从标签组中移除这个标签页吗？')) {
        await chrome.tabs.ungroup(tab.id);
        await loadData();
        if (selectedGroupId) {
          const group = await chrome.tabGroups.get(selectedGroupId);
          if (group) {
            await selectGroup(group);
          }
        }
      }
    });
  } else {
    // 历史视图：点击可以打开链接
    closeBtn.style.display = 'none'; // 历史视图中不显示关闭按钮
  }
  
  item.appendChild(checkbox);
  item.appendChild(dragHandle);
  item.appendChild(favicon);
  item.appendChild(title);
  item.appendChild(closeBtn);
  
  // 点击项（非复选框）打开标签页
  item.addEventListener('click', (e) => {
    if (e.target !== checkbox && e.target !== closeBtn && e.target !== dragHandle) {
      if (isHistoryView && tab.url) {
        // 历史视图：在新标签页中打开
        chrome.tabs.create({ url: tab.url });
      } else if (tab.id) {
        // 当前视图：激活标签页
        chrome.tabs.update(tab.id, { active: true });
      }
    }
  });
  
  if (selectedTabIds.has(tab.id)) {
    item.classList.add('selected');
  }
  
  return item;
}

// 更新选择计数器
function updateSelectionCounter() {
  const total = tabsListContainer.querySelectorAll('.tab-item').length;
  const selected = selectedTabIds.size;
  selectionCounter.textContent = `${selected}/${total}`;
}

// 设置事件监听
function setupEventListeners() {
  // 搜索
  searchInput.addEventListener('input', (e) => {
    filterTagGroups(e.target.value);
  });
  
  // 全部展开
  document.getElementById('expandAllBtn').addEventListener('click', () => {
    if (categories.length > 0) {
      categories.forEach(cat => expandedCategories.add(cat.id));
      // 更新所有分类的展开状态
      const categoryItems = tagGroupsList.querySelectorAll('.category-item');
      categoryItems.forEach(item => {
        const header = item.querySelector('.category-header');
        if (header && header.dataset.categoryId) {
          const toggle = header.querySelector('.category-toggle');
          const children = item.querySelector('.category-children');
          if (toggle && children) {
            toggle.classList.remove('collapsed');
            children.classList.add('expanded');
          }
        }
      });
    }
  });
  
  // 全部折叠
  document.getElementById('collapseAllBtn').addEventListener('click', () => {
    if (categories.length > 0) {
      expandedCategories.clear();
      // 更新所有分类的折叠状态
      const categoryItems = tagGroupsList.querySelectorAll('.category-item');
      categoryItems.forEach(item => {
        const header = item.querySelector('.category-header');
        if (header && header.dataset.categoryId) {
          const toggle = header.querySelector('.category-toggle');
          const children = item.querySelector('.category-children');
          if (toggle && children) {
            toggle.classList.add('collapsed');
            children.classList.remove('expanded');
          }
        }
      });
    }
  });
  
  // 创建分类
  document.getElementById('createCategoryBtn').addEventListener('click', () => {
    openCreateCategoryModal();
  });
  
  // 打开该组
  document.getElementById('openGroupLink').addEventListener('click', async (e) => {
    e.preventDefault();
    if (selectedGroupId) {
      await openGroupTabs(selectedGroupId);
    }
  });
  
  // 删除该组
  document.getElementById('deleteGroupLink').addEventListener('click', async (e) => {
    e.preventDefault();
    if (selectedGroupId) {
      await deleteGroup(selectedGroupId);
    }
  });
  
  // 星标该组
  document.getElementById('starGroupLink').addEventListener('click', async (e) => {
    e.preventDefault();
    if (selectedGroupId) {
      await starGroup(selectedGroupId);
    }
  });
  
  // 去重
  document.getElementById('deduplicateLink').addEventListener('click', async (e) => {
    e.preventDefault();
    if (selectedGroupId) {
      await deduplicateGroup(selectedGroupId);
    }
  });
  
  // 刷新
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await loadData();
  });
  
  // 切换视图（当前/历史）
  document.getElementById('toggleViewBtn').addEventListener('click', async () => {
    isHistoryView = !isHistoryView;
    const toggleBtn = document.getElementById('toggleViewBtn');
    toggleBtn.textContent = isHistoryView ? '📋 当前' : '📜 历史';
    toggleBtn.title = isHistoryView ? '切换到当前视图' : '切换到历史视图';
    
    // 重置选中状态
    selectedGroupId = null;
    selectedTabIds.clear();
    selectedGroupHeader.style.display = 'none';
    tabsListContainer.innerHTML = '';
    emptyState.style.display = 'block';
    
    // 重新加载数据
    await loadData();
  });
  
  // 添加
  document.getElementById('addBtn').addEventListener('click', () => {
    // TODO: 实现添加功能
    alert('添加功能待实现');
  });
  
  // 模态框
  setupModalListeners();
}

// 设置模态框监听
function setupModalListeners() {
  const createCategoryModal = document.getElementById('createCategoryModal');
  const closeCategoryModal = document.getElementById('closeCategoryModal');
  const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
  const confirmCategoryBtn = document.getElementById('confirmCategoryBtn');
  
  closeCategoryModal.addEventListener('click', closeCreateCategoryModal);
  cancelCategoryBtn.addEventListener('click', closeCreateCategoryModal);
  confirmCategoryBtn.addEventListener('click', async () => {
    const name = document.getElementById('categoryNameInput').value.trim();
    if (name) {
      await createCategory(name);
      closeCreateCategoryModal();
    } else {
      alert('请输入分类名称');
    }
  });
}

// 打开创建分类模态框
function openCreateCategoryModal() {
  document.getElementById('categoryNameInput').value = '';
  document.getElementById('createCategoryModal').classList.add('show');
}

// 关闭创建分类模态框
function closeCreateCategoryModal() {
  document.getElementById('createCategoryModal').classList.remove('show');
}

// 创建分类
async function createCategory(name) {
  const newCategory = {
    id: Date.now(),
    name: name,
    groups: []
  };
  categories.push(newCategory);
  await chrome.storage.local.set({ categories: categories });
  await loadData();
}

// 过滤标签组
function filterTagGroups(searchText) {
  const searchLower = searchText.toLowerCase();
  const items = tagGroupsList.querySelectorAll('.tag-group-item, .category-item');
  
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    if (text.includes(searchLower)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

// 打开标签组中的所有标签页
async function openGroupTabs(groupId) {
  try {
    const groupTabs = await chrome.tabs.query({ groupId: groupId, windowId: currentWindowId });
    if (groupTabs && groupTabs.length > 0) {
      // 激活第一个标签页
      await chrome.tabs.update(groupTabs[0].id, { active: true });
    }
  } catch (error) {
    console.error('打开标签组失败:', error);
    alert('打开标签组失败');
  }
}

// 删除标签组
async function deleteGroup(groupId) {
  if (!confirm('确定要删除这个标签组吗？标签页不会被关闭，只是从标签组中移除。')) {
    return;
  }
  
  try {
    const group = await chrome.tabGroups.get(groupId);
    if (group && group.tabIds && group.tabIds.length > 0) {
      for (const tabId of group.tabIds) {
        await chrome.tabs.ungroup(tabId);
      }
    }
    await loadData();
    selectedGroupId = null;
    selectedGroupHeader.style.display = 'none';
    tabsListContainer.innerHTML = '';
    emptyState.style.display = 'block';
  } catch (error) {
    console.error('删除标签组失败:', error);
    alert('删除失败: ' + error.message);
  }
}

// 星标标签组
async function starGroup(groupId) {
  try {
    // TODO: 实现星标功能（可以存储在 storage 中）
    alert('星标功能待实现');
  } catch (error) {
    console.error('星标失败:', error);
  }
}

// 去重
async function deduplicateGroup(groupId) {
  try {
    const groupTabs = await chrome.tabs.query({ groupId: groupId, windowId: currentWindowId });
    const urlMap = new Map();
    const duplicates = [];
    
    groupTabs.forEach(tab => {
      if (urlMap.has(tab.url)) {
        duplicates.push(tab.id);
      } else {
        urlMap.set(tab.url, tab.id);
      }
    });
    
    if (duplicates.length === 0) {
      alert('没有重复的标签页');
      return;
    }
    
    if (confirm(`发现 ${duplicates.length} 个重复的标签页，是否移除？`)) {
      for (const tabId of duplicates) {
        await chrome.tabs.ungroup(tabId);
      }
      await loadData();
      if (selectedGroupId === groupId) {
        const group = await chrome.tabGroups.get(groupId);
        if (group) {
          await selectGroup(group);
        }
      }
    }
  } catch (error) {
    console.error('去重失败:', error);
    alert('去重失败: ' + error.message);
  }
}

