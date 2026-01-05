// Popup 主逻辑
let currentWindowId = null;
let selectedTabIds = [];
let selectedColor = 'grey';
let currentManagingGroupId = null;

// DOM 元素
const addToGroupBtn = document.getElementById('addToGroupBtn');
const createGroupBtn = document.getElementById('createGroupBtn');
const openManagerBtn = document.getElementById('openManagerBtn');
const currentTabTitle = document.getElementById('currentTabTitle');
const groupsContainer = document.getElementById('groupsContainer');
const tabsContainer = document.getElementById('tabsContainer');
const emptyState = document.getElementById('emptyState');
const loadingTabs = document.getElementById('loadingTabs');

// 视图切换
const mainView = document.getElementById('mainView');
const detailView = document.getElementById('detailView');
const backBtn = document.getElementById('backBtn');
const detailGroupName = document.getElementById('detailGroupName');
const detailStats = document.getElementById('detailStats');
const detailTabCount = document.getElementById('detailTabCount');
const detailLastUpdate = document.getElementById('detailLastUpdate');
const detailTabsContainer = document.getElementById('detailTabsContainer');
const detailTabsCount = document.getElementById('detailTabsCount');
const openGroupBtn = document.getElementById('openGroupBtn');
const deleteGroupBtn2 = document.getElementById('deleteGroupBtn2');
const editGroupBtn2 = document.getElementById('editGroupBtn2');

let currentDetailGroup = null;

// 模态框
const addToGroupModal = document.getElementById('addToGroupModal');
const createGroupModal = document.getElementById('createGroupModal');
const manageGroupModal = document.getElementById('manageGroupModal');

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

    // 加载当前标签页信息
    await loadCurrentTab();

    // 加载群组和标签页
    await loadGroups();
    await loadTabs();
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

// 设置事件监听
function setupEventListeners() {
  // 添加到群组按钮
  addToGroupBtn.addEventListener('click', () => {
    openAddToGroupModal();
  });

  // 创建群组按钮
  createGroupBtn.addEventListener('click', () => {
    openCreateGroupModal();
  });

  // 打开管理页面按钮
  openManagerBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 关闭模态框
  document.getElementById('closeAddModal').addEventListener('click', closeAddToGroupModal);
  document.getElementById('closeCreateModal').addEventListener('click', closeCreateGroupModal);
  document.getElementById('closeManageModal').addEventListener('click', closeManageGroupModal);
  document.getElementById('cancelAddBtn').addEventListener('click', closeAddToGroupModal);
  document.getElementById('cancelCreateBtn').addEventListener('click', closeCreateGroupModal);
  document.getElementById('cancelManageBtn').addEventListener('click', closeManageGroupModal);

  // 确认添加
  document.getElementById('confirmAddBtn').addEventListener('click', handleAddToGroup);

  // 确认创建
  document.getElementById('confirmCreateBtn').addEventListener('click', handleCreateGroup);

  // 删除群组
  document.getElementById('deleteGroupBtn').addEventListener('click', handleDeleteGroup);

  // 详情视图
  backBtn.addEventListener('click', () => {
    showMainView();
  });

  openGroupBtn.addEventListener('click', async () => {
    if (currentDetailGroup) {
      await openGroupTabs(currentDetailGroup.id);
    }
  });

  deleteGroupBtn2.addEventListener('click', async () => {
    if (currentDetailGroup) {
      await handleDeleteGroupFromDetail();
    }
  });

  editGroupBtn2.addEventListener('click', () => {
    if (currentDetailGroup) {
      showMainView();
      openManageGroupModal(currentDetailGroup);
    }
  });

  // 颜色选择器
  setupColorPickers();
}

// 加载当前标签页
async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentTabTitle.textContent = tab.title || tab.url || '无标题';
      selectedTabIds = [tab.id];
    }
  } catch (error) {
    console.error('加载当前标签页失败:', error);
  }
}

// 加载群组
async function loadGroups() {
  try {
    const groups = await chrome.tabGroups.query({ windowId: currentWindowId });
    renderGroups(groups);
  } catch (error) {
    console.error('加载群组失败:', error);
  }
}

// 渲染群组
async function renderGroups(groups) {
  groupsContainer.innerHTML = '';

  if (groups.length === 0) {
    emptyState.classList.add('show');
    return;
  }

  emptyState.classList.remove('show');

  // 使用 Promise.all 并行创建所有群组卡片
  const groupCards = await Promise.all(
    groups.map(group => createGroupCard(group))
  );
  
  groupCards.forEach(card => {
    groupsContainer.appendChild(card);
  });
}

// 创建群组卡片
async function createGroupCard(group) {
  const card = document.createElement('div');
  card.className = 'group-card';
  card.style.borderLeftColor = getColorValue(group.color);

  const header = document.createElement('div');
  header.className = 'group-header';

  const nameDiv = document.createElement('div');
  nameDiv.className = 'group-name';
  
  const colorIndicator = document.createElement('span');
  colorIndicator.className = 'group-color-indicator';
  colorIndicator.style.backgroundColor = getColorValue(group.color);
  
  const nameSpan = document.createElement('span');
  nameSpan.textContent = group.title || '未命名群组';
  
  nameDiv.appendChild(colorIndicator);
  nameDiv.appendChild(nameSpan);

  const actions = document.createElement('div');
  actions.className = 'group-actions';
  
  const manageBtn = document.createElement('button');
  manageBtn.textContent = '管理';
  manageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openManageGroupModal(group);
  });
  
  actions.appendChild(manageBtn);

  header.appendChild(nameDiv);
  header.appendChild(actions);

  const info = document.createElement('div');
  info.className = 'group-info';
  
  const tabsCount = document.createElement('div');
  tabsCount.className = 'group-tabs-count';
  
  // 获取实际的标签页数量
  let tabCount = 0;
  try {
    const groupTabs = await chrome.tabs.query({ groupId: group.id, windowId: currentWindowId });
    tabCount = groupTabs ? groupTabs.length : 0;
  } catch (error) {
    console.error('获取标签页数量失败:', error);
    tabCount = group.tabIds ? group.tabIds.length : 0;
  }
  
  tabsCount.innerHTML = `📄 ${tabCount} 个标签页`;
  
  info.appendChild(tabsCount);

  card.appendChild(header);
  card.appendChild(info);

  // 添加标签页列表
  try {
    // 使用 groupId 查询标签页（这是正确的方式）
    const groupTabs = await chrome.tabs.query({ groupId: group.id, windowId: currentWindowId });
    
    if (groupTabs && groupTabs.length > 0) {
      const tabsList = document.createElement('div');
      tabsList.className = 'group-tabs-preview';
      
      // 限制显示数量，避免列表过长
      const maxDisplay = 5;
      const displayTabs = groupTabs.slice(0, maxDisplay);
      
      displayTabs.forEach(tab => {
        const tabItem = document.createElement('div');
        tabItem.className = 'group-tab-preview-item';
        
        const favicon = document.createElement('img');
        favicon.className = 'tab-preview-favicon';
        favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="%23999"/></svg>';
        favicon.onerror = () => {
          favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="%23999"/></svg>';
        };
        
        const tabTitle = document.createElement('span');
        tabTitle.className = 'tab-preview-title';
        tabTitle.textContent = tab.title || tab.url || '无标题';
        tabTitle.title = tab.url || '';
        
        tabItem.appendChild(favicon);
        tabItem.appendChild(tabTitle);
        tabsList.appendChild(tabItem);
      });
      
      // 如果还有更多标签页，显示提示
      if (groupTabs.length > maxDisplay) {
        const moreItem = document.createElement('div');
        moreItem.className = 'group-tab-preview-more';
        moreItem.textContent = `... 还有 ${groupTabs.length - maxDisplay} 个标签页`;
        tabsList.appendChild(moreItem);
      }
      
      card.appendChild(tabsList);
    }
  } catch (error) {
    console.error('获取群组标签页失败:', error);
  }

  // 点击卡片显示详情
  card.addEventListener('click', (e) => {
    // 如果点击的是管理按钮或标签页项，不触发显示详情
    if (e.target.closest('.group-actions') || e.target.closest('.group-tabs-preview')) {
      return;
    }
    showGroupDetail(group);
  });

  return card;
}

// 加载标签页
async function loadTabs() {
  try {
    loadingTabs.style.display = 'block';
    const tabs = await chrome.tabs.query({ windowId: currentWindowId });
    renderTabs(tabs);
    loadingTabs.style.display = 'none';
  } catch (error) {
    console.error('加载标签页失败:', error);
    loadingTabs.textContent = '加载失败';
  }
}

// 渲染标签页
async function renderTabs(tabs) {
  tabsContainer.innerHTML = '';

  // 获取所有群组信息
  const groups = await chrome.tabGroups.query({ windowId: currentWindowId });
  const groupMap = new Map();
  groups.forEach(group => {
    if (group.tabIds) {
      group.tabIds.forEach(tabId => {
        groupMap.set(tabId, group);
      });
    }
  });

  tabs.forEach(tab => {
    const tabCard = createTabCard(tab, groupMap.get(tab.id));
    tabsContainer.appendChild(tabCard);
  });
}

// 创建标签页卡片
function createTabCard(tab, group) {
  const card = document.createElement('div');
  card.className = 'tab-card';

  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23999"/></svg>';
  favicon.onerror = () => {
    favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23999"/></svg>';
  };

  const info = document.createElement('div');
  info.className = 'tab-info';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || tab.url || '无标题';

  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = tab.url || '';

  info.appendChild(title);
  info.appendChild(url);

  card.appendChild(favicon);
  card.appendChild(info);

  if (group) {
    const badge = document.createElement('div');
    badge.className = 'tab-group-badge';
    badge.textContent = group.title || '未命名群组';
    card.appendChild(badge);
  }

  // 点击选择标签页
  card.addEventListener('click', () => {
    if (selectedTabIds.includes(tab.id)) {
      selectedTabIds = selectedTabIds.filter(id => id !== tab.id);
      card.style.background = 'white';
    } else {
      selectedTabIds.push(tab.id);
      card.style.background = '#e8f0fe';
    }
  });

  return card;
}

// 打开添加到群组模态框
async function openAddToGroupModal() {
  const groups = await chrome.tabGroups.query({ windowId: currentWindowId });
  const groupSelect = document.getElementById('groupSelect');
  
  groupSelect.innerHTML = '<option value="">-- 选择群组 --</option>';
  groups.forEach(group => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.title || '未命名群组';
    groupSelect.appendChild(option);
  });

  // 显示选中的标签页
  await renderSelectedTabs();

  addToGroupModal.classList.add('show');
}

// 关闭添加到群组模态框
function closeAddToGroupModal() {
  addToGroupModal.classList.remove('show');
  document.getElementById('newGroupName').value = '';
  document.getElementById('groupSelect').value = '';
}

// 打开创建群组模态框
function openCreateGroupModal() {
  selectedColor = 'grey';
  updateColorPicker('createColorPicker', selectedColor);
  createGroupModal.classList.add('show');
}

// 关闭创建群组模态框
function closeCreateGroupModal() {
  createGroupModal.classList.remove('show');
  document.getElementById('createGroupName').value = '';
}

// 打开管理群组模态框
async function openManageGroupModal(group) {
  currentManagingGroupId = group.id;
  selectedColor = group.color || 'grey';
  
  document.getElementById('manageGroupTitle').textContent = `管理群组: ${group.title || '未命名群组'}`;
  
  const body = document.getElementById('manageGroupBody');
  body.innerHTML = '';

  // 群组信息
  const infoDiv = document.createElement('div');
  infoDiv.className = 'form-group';
  infoDiv.innerHTML = `
    <label>群组名称:</label>
    <input type="text" id="editGroupName" class="form-input" value="${group.title || ''}" placeholder="输入群组名称">
  `;
  body.appendChild(infoDiv);

  // 颜色选择
  const colorDiv = document.createElement('div');
  colorDiv.className = 'form-group';
  colorDiv.innerHTML = '<label>选择颜色:</label>';
  const colorPicker = document.createElement('div');
  colorPicker.className = 'color-picker';
  colorPicker.id = 'manageColorPicker';
  
  const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
  colors.forEach(color => {
    const option = document.createElement('div');
    option.className = `color-option ${color === group.color ? 'active' : ''}`;
    option.dataset.color = color;
    option.style.backgroundColor = getColorValue(color);
    option.addEventListener('click', () => {
      updateColorPicker('manageColorPicker', color);
      selectedColor = color;
    });
    colorPicker.appendChild(option);
  });
  
  colorDiv.appendChild(colorPicker);
  body.appendChild(colorDiv);

  // 标签页列表
  if (group.tabIds && group.tabIds.length > 0) {
    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'form-group';
    tabsDiv.innerHTML = '<label>群组中的标签页:</label>';
    const tabsList = document.createElement('div');
    tabsList.className = 'group-tabs-list';
    
    const tabs = await chrome.tabs.query({ windowId: currentWindowId });
    const groupTabs = tabs.filter(tab => group.tabIds.includes(tab.id));
    
    groupTabs.forEach(tab => {
      const tabItem = document.createElement('div');
      tabItem.className = 'group-tab-item';
      
      const tabInfo = document.createElement('div');
      tabInfo.className = 'group-tab-info';
      
      const tabTitle = document.createElement('div');
      tabTitle.className = 'group-tab-title';
      tabTitle.textContent = tab.title || tab.url || '无标题';
      
      const tabUrl = document.createElement('div');
      tabUrl.className = 'group-tab-url';
      tabUrl.textContent = tab.url || '';
      
      tabInfo.appendChild(tabTitle);
      tabInfo.appendChild(tabUrl);
      
      const tabActions = document.createElement('div');
      tabActions.className = 'group-tab-actions';
      
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '移除';
      removeBtn.addEventListener('click', async () => {
        await chrome.tabs.ungroup(tab.id);
        // 重新获取群组信息
        try {
          const updatedGroup = await chrome.tabGroups.get(group.id);
          await loadGroups();
          if (updatedGroup && updatedGroup.tabIds && updatedGroup.tabIds.length > 0) {
            openManageGroupModal(updatedGroup);
          } else {
            closeManageGroupModal();
          }
        } catch (error) {
          // 群组可能已被删除
          await loadGroups();
          closeManageGroupModal();
        }
      });
      
      tabActions.appendChild(removeBtn);
      
      tabItem.appendChild(tabInfo);
      tabItem.appendChild(tabActions);
      tabsList.appendChild(tabItem);
    });
    
    tabsDiv.appendChild(tabsList);
    body.appendChild(tabsDiv);
  }

  // 保存按钮事件
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = '保存更改';
  saveBtn.style.marginTop = '12px';
  saveBtn.addEventListener('click', async () => {
    const newName = document.getElementById('editGroupName').value.trim();
    if (newName) {
      await chrome.tabGroups.update(group.id, { title: newName, color: selectedColor });
    } else {
      await chrome.tabGroups.update(group.id, { color: selectedColor });
    }
    await loadGroups();
    closeManageGroupModal();
  });
  body.appendChild(saveBtn);

  manageGroupModal.classList.add('show');
}

// 关闭管理群组模态框
function closeManageGroupModal() {
  manageGroupModal.classList.remove('show');
  currentManagingGroupId = null;
}

// 处理添加到群组
async function handleAddToGroup() {
  const groupSelect = document.getElementById('groupSelect');
  const newGroupName = document.getElementById('newGroupName').value.trim();

  if (!groupSelect.value && !newGroupName) {
    alert('请选择现有群组或输入新群组名称');
    return;
  }

  try {
    if (newGroupName) {
      // 创建新群组
      const tabIds = selectedTabIds.length > 0 ? selectedTabIds : await getCurrentTabIds();
      if (tabIds.length === 0) {
        alert('请选择要添加的标签页');
        return;
      }

      // 先创建群组
      const groupId = await chrome.tabs.group({ tabIds: tabIds });
      await chrome.tabGroups.update(groupId, {
        title: newGroupName,
        color: selectedColor
      });
    } else {
      // 添加到现有群组
      const groupId = parseInt(groupSelect.value);
      const tabIds = selectedTabIds.length > 0 ? selectedTabIds : await getCurrentTabIds();
      if (tabIds.length === 0) {
        alert('请选择要添加的标签页');
        return;
      }

      // 获取群组现有的标签页
      const group = await chrome.tabGroups.get(groupId);
      const existingTabIds = group.tabIds || [];
      const allTabIds = [...new Set([...existingTabIds, ...tabIds])];

      // 将标签页添加到群组
      await chrome.tabs.group({ groupId: groupId, tabIds: tabIds });
    }

    closeAddToGroupModal();
    await loadGroups();
    await loadTabs();
  } catch (error) {
    console.error('添加到群组失败:', error);
    alert('操作失败: ' + error.message);
  }
}

// 处理创建群组
async function handleCreateGroup() {
  const groupName = document.getElementById('createGroupName').value.trim();
  
  if (!groupName) {
    alert('请输入群组名称');
    return;
  }

  try {
    const tabIds = selectedTabIds.length > 0 ? selectedTabIds : await getCurrentTabIds();
    if (tabIds.length === 0) {
      alert('请选择要添加的标签页');
      return;
    }

    const groupId = await chrome.tabs.group({ tabIds: tabIds });
    await chrome.tabGroups.update(groupId, {
      title: groupName,
      color: selectedColor
    });

    closeCreateGroupModal();
    await loadGroups();
    await loadTabs();
  } catch (error) {
    console.error('创建群组失败:', error);
    alert('创建失败: ' + error.message);
  }
}

// 处理删除群组
async function handleDeleteGroup() {
  if (!currentManagingGroupId) {
    alert('无法获取群组信息');
    return;
  }

  if (!confirm('确定要删除这个群组吗？标签页不会被关闭，只是从群组中移除。')) {
    return;
  }

  try {
    // 获取群组中的所有标签页
    const group = await chrome.tabGroups.get(currentManagingGroupId);
    if (group && group.tabIds && group.tabIds.length > 0) {
      // 从群组中移除所有标签页
      for (const tabId of group.tabIds) {
        await chrome.tabs.ungroup(tabId);
      }
      // 当群组中没有标签页时，Chrome 会自动删除群组
      await loadGroups();
      await loadTabs();
      closeManageGroupModal();
    } else {
      alert('群组中已经没有标签页');
    }
  } catch (error) {
    console.error('删除群组失败:', error);
    alert('删除失败: ' + error.message);
  }
}

// 添加标签页到群组
async function addTabsToGroup(tabIds, groupId) {
  try {
    if (tabIds.length === 0) {
      tabIds = await getCurrentTabIds();
    }
    
    const group = await chrome.tabGroups.get(groupId);
    const existingTabIds = group.tabIds || [];
    const allTabIds = [...new Set([...existingTabIds, ...tabIds])];
    
    await chrome.tabs.group({ groupId: groupId, tabIds: tabIds });
    await loadGroups();
    await loadTabs();
  } catch (error) {
    console.error('添加到群组失败:', error);
    alert('操作失败: ' + error.message);
  }
}

// 获取当前标签页ID
async function getCurrentTabIds() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? [tab.id] : [];
}

// 渲染选中的标签页
async function renderSelectedTabs() {
  const container = document.getElementById('selectedTabs');
  container.innerHTML = '';

  if (selectedTabIds.length === 0) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      selectedTabIds = [tab.id];
    }
  }

  const tabs = await chrome.tabs.query({ windowId: currentWindowId });
  const selectedTabs = tabs.filter(tab => selectedTabIds.includes(tab.id));

  selectedTabs.forEach(tab => {
    const item = document.createElement('div');
    item.className = 'selected-tab-item';
    item.textContent = tab.title || tab.url || '无标题';
    container.appendChild(item);
  });
}

// 设置颜色选择器
function setupColorPickers() {
  const pickers = ['colorPicker', 'createColorPicker'];
  pickers.forEach(pickerId => {
    const picker = document.getElementById(pickerId);
    if (picker) {
      picker.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', () => {
          updateColorPicker(pickerId, option.dataset.color);
          selectedColor = option.dataset.color;
        });
      });
    }
  });
}

// 更新颜色选择器
function updateColorPicker(pickerId, color) {
  const picker = document.getElementById(pickerId);
  if (picker) {
    picker.querySelectorAll('.color-option').forEach(option => {
      if (option.dataset.color === color) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
  }
}

// 获取颜色值
function getColorValue(color) {
  const colorMap = {
    'grey': '#9AA0A6',
    'blue': '#8AB4F8',
    'red': '#F28B82',
    'yellow': '#FDD663',
    'green': '#81C995',
    'pink': '#FF8BCB',
    'purple': '#C58AF9',
    'cyan': '#78D9EC'
  };
  return colorMap[color] || colorMap['grey'];
}

// 显示主视图
function showMainView() {
  mainView.style.display = 'block';
  detailView.style.display = 'none';
  currentDetailGroup = null;
}

// 显示群组详情
async function showGroupDetail(group) {
  currentDetailGroup = group;
  
  // 更新详情视图标题
  detailGroupName.textContent = group.title || '未命名群组';
  
  // 获取群组中的标签页
  try {
    const groupTabs = await chrome.tabs.query({ groupId: group.id, windowId: currentWindowId });
    const tabCount = groupTabs ? groupTabs.length : 0;
    
    // 更新统计信息
    detailTabCount.textContent = `${tabCount} 个标签页`;
    detailTabsCount.textContent = `0/${tabCount}`;
    
    // 更新最后更新时间（如果有）
    if (group.lastUpdate) {
      detailLastUpdate.textContent = `最后更新: ${formatDate(group.lastUpdate)}`;
    } else {
      detailLastUpdate.textContent = '';
    }
    
    // 渲染标签页列表
    renderDetailTabs(groupTabs || []);
    
  } catch (error) {
    console.error('获取群组详情失败:', error);
    detailTabCount.textContent = '0 个标签页';
    detailTabsContainer.innerHTML = '<div class="empty-state show"><p>无法加载标签页</p></div>';
  }
  
  // 切换视图
  mainView.style.display = 'none';
  detailView.style.display = 'block';
}

// 渲染详情页面的标签页列表
function renderDetailTabs(tabs) {
  detailTabsContainer.innerHTML = '';
  
  if (tabs.length === 0) {
    detailTabsContainer.innerHTML = '<div class="empty-state show"><p>该群组中没有标签页</p></div>';
    return;
  }
  
  tabs.forEach(tab => {
    const tabItem = createDetailTabItem(tab);
    detailTabsContainer.appendChild(tabItem);
  });
}

// 创建详情页面的标签页项
function createDetailTabItem(tab) {
  const item = document.createElement('div');
  item.className = 'detail-tab-item';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'detail-tab-checkbox';
  checkbox.addEventListener('change', updateDetailTabsCount);
  
  const favicon = document.createElement('img');
  favicon.className = 'detail-tab-favicon';
  favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23999"/></svg>';
  favicon.onerror = () => {
    favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23999"/></svg>';
  };
  
  const info = document.createElement('div');
  info.className = 'detail-tab-info';
  
  const title = document.createElement('div');
  title.className = 'detail-tab-title';
  title.textContent = tab.title || tab.url || '无标题';
  
  const url = document.createElement('div');
  url.className = 'detail-tab-url';
  url.textContent = tab.url || '';
  
  info.appendChild(title);
  info.appendChild(url);
  
  const actions = document.createElement('div');
  actions.className = 'detail-tab-actions';
  
  const openBtn = document.createElement('button');
  openBtn.className = 'detail-tab-action-btn';
  openBtn.textContent = '打开';
  openBtn.title = '在新标签页中打开';
  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.tabs.update(tab.id, { active: true });
  });
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'detail-tab-action-btn';
  removeBtn.textContent = '移除';
  removeBtn.title = '从群组中移除';
  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm('确定要从群组中移除这个标签页吗？')) {
      await chrome.tabs.ungroup(tab.id);
      // 重新加载详情
      if (currentDetailGroup) {
        await showGroupDetail(currentDetailGroup);
        await loadGroups();
      }
    }
  });
  
  actions.appendChild(openBtn);
  actions.appendChild(removeBtn);
  
  item.appendChild(checkbox);
  item.appendChild(favicon);
  item.appendChild(info);
  item.appendChild(actions);
  
  // 点击项打开标签页
  item.addEventListener('click', (e) => {
    if (e.target.type !== 'checkbox' && !e.target.closest('.detail-tab-actions')) {
      chrome.tabs.update(tab.id, { active: true });
    }
  });
  
  return item;
}

// 更新详情页面的标签页计数
function updateDetailTabsCount() {
  const checkboxes = detailTabsContainer.querySelectorAll('.detail-tab-checkbox:checked');
  const total = detailTabsContainer.querySelectorAll('.detail-tab-checkbox').length;
  detailTabsCount.textContent = `${checkboxes.length}/${total}`;
}

// 打开群组中的所有标签页
async function openGroupTabs(groupId) {
  try {
    const tabs = await chrome.tabs.query({ groupId: groupId, windowId: currentWindowId });
    if (tabs && tabs.length > 0) {
      // 激活第一个标签页
      await chrome.tabs.update(tabs[0].id, { active: true });
      // 将其他标签页移到前台
      for (let i = 1; i < tabs.length; i++) {
        await chrome.tabs.update(tabs[i].id, { active: false });
      }
    }
  } catch (error) {
    console.error('打开群组标签页失败:', error);
    alert('打开标签页失败');
  }
}

// 从详情页面删除群组
async function handleDeleteGroupFromDetail() {
  if (!currentDetailGroup) return;
  
  if (!confirm('确定要删除这个群组吗？标签页不会被关闭，只是从群组中移除。')) {
    return;
  }

  try {
    // 获取群组中的所有标签页
    const tabs = await chrome.tabs.query({ groupId: currentDetailGroup.id, windowId: currentWindowId });
    if (tabs && tabs.length > 0) {
      // 从群组中移除所有标签页
      for (const tab of tabs) {
        await chrome.tabs.ungroup(tab.id);
      }
    }
    
    // 返回主视图并刷新
    showMainView();
    await loadGroups();
  } catch (error) {
    console.error('删除群组失败:', error);
    alert('删除失败: ' + error.message);
  }
}

