// Background Service Worker

// 安装时的初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('标签页分组管理器已安装');
  
  // 创建右键菜单
  createContextMenus();
});

// 创建右键菜单
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // 添加到群组菜单
    chrome.contextMenus.create({
      id: 'addToGroup',
      title: '添加到群组',
      contexts: ['page', 'tab']
    });

    // 创建新群组菜单
    chrome.contextMenus.create({
      id: 'createNewGroup',
      title: '创建新群组',
      contexts: ['page', 'tab']
    });
  });
}

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToGroup') {
    // 打开添加到群组界面
    await openAddToGroupDialog(tab);
  } else if (info.menuItemId === 'createNewGroup') {
    // 打开创建群组界面
    await openCreateGroupDialog(tab);
  }
});

// 打开添加到群组对话框
async function openAddToGroupDialog(tab) {
  try {
    // 获取所有群组
    const window = await chrome.windows.get(tab.windowId);
    const groups = await chrome.tabGroups.query({ windowId: tab.windowId });

    if (groups.length === 0) {
      // 如果没有群组，提示创建
      const create = confirm('还没有群组，是否创建新群组？');
      if (create) {
        await openCreateGroupDialog(tab);
      }
      return;
    }

    // 显示群组选择对话框
    const groupNames = groups.map(g => g.title || '未命名群组').join('\n');
    const selectedIndex = prompt(
      `选择要添加到的群组（输入序号）:\n${groups.map((g, i) => `${i + 1}. ${g.title || '未命名群组'}`).join('\n')}\n\n或输入 "new" 创建新群组`,
      '1'
    );

    if (selectedIndex === null) return;

    if (selectedIndex.toLowerCase() === 'new') {
      await openCreateGroupDialog(tab);
      return;
    }

    const index = parseInt(selectedIndex) - 1;
    if (index >= 0 && index < groups.length) {
      const groupId = groups[index].id;
      await chrome.tabs.group({ groupId: groupId, tabIds: [tab.id] });
    }
  } catch (error) {
    console.error('添加到群组失败:', error);
  }
}

// 打开创建群组对话框
async function openCreateGroupDialog(tab) {
  try {
    const groupName = prompt('输入新群组名称:', '新群组');
    if (!groupName) return;

    // 创建群组
    const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
    
    // 设置群组名称和颜色
    const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    await chrome.tabGroups.update(groupId, {
      title: groupName,
      color: randomColor
    });
  } catch (error) {
    console.error('创建群组失败:', error);
  }
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 可以在这里添加标签页更新时的处理逻辑
});

// 监听群组更新（在文件末尾统一处理，避免重复）

// 监听标签页关闭
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // 当标签页关闭时，如果它属于某个标签组，保存该标签组的信息
  try {
    // 在标签页关闭前，尝试获取其所属的标签组
    // 注意：此时标签页可能已经关闭，我们需要通过其他方式获取
    // 由于标签页已关闭，我们无法直接获取其 groupId
    // 但我们可以定期保存所有标签组信息（已在 saveGroupsPeriodically 中实现）
  } catch (error) {
    console.error('处理标签页关闭失败:', error);
  }
});

// 监听标签组关闭（当标签组中所有标签页都被关闭时）
chrome.tabGroups.onRemoved.addListener(async (group) => {
  // 在标签组关闭前，尝试获取其标签页信息
  try {
    // 如果还有标签页ID，尝试获取它们的信息
    if (group.tabIds && group.tabIds.length > 0) {
      // 注意：此时标签页可能已经关闭，无法通过 tabs API 获取
      // 但我们可以保存标签页ID和基本信息
      const tabsInfo = [];
      for (const tabId of group.tabIds) {
        try {
          const tab = await chrome.tabs.get(tabId);
          tabsInfo.push({
            id: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            pinned: tab.pinned
          });
        } catch (error) {
          // 标签页已关闭，无法获取
          console.log(`标签页 ${tabId} 已关闭，无法获取信息`);
        }
      }
      
      // 保存已关闭的标签组到历史记录
      await saveClosedGroupToHistory(group, tabsInfo);
    } else {
      await saveClosedGroupToHistory(group, []);
    }
  } catch (error) {
    console.error('保存已关闭标签组失败:', error);
    // 即使获取标签页信息失败，也保存标签组基本信息
    await saveClosedGroupToHistory(group, []);
  }
});

// 保存标签组到历史记录
async function saveGroupToHistory(group) {
  try {
    // 获取该标签组的所有标签页
    const tabs = await chrome.tabs.query({ groupId: group.id });
    
    const groupData = {
      id: group.id,
      title: group.title,
      color: group.color,
      collapsed: group.collapsed,
      windowId: group.windowId,
      tabs: tabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        pinned: tab.pinned
      })),
      updatedAt: Date.now()
    };
    
    // 从存储中获取历史记录
    const result = await chrome.storage.local.get(['groupHistory']);
    const history = result.groupHistory || [];
    
    // 检查是否已存在（更新现有记录）
    const existingIndex = history.findIndex(h => h.id === group.id && h.windowId === group.windowId);
    if (existingIndex >= 0) {
      history[existingIndex] = groupData;
    } else {
      // 添加到历史记录
      history.push(groupData);
    }
    
    // 限制历史记录数量（保留最近1000个）
    if (history.length > 1000) {
      history.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      history.splice(1000);
    }
    
    await chrome.storage.local.set({ groupHistory: history });
  } catch (error) {
    console.error('保存标签组历史失败:', error);
  }
}

// 保存已关闭的标签组到历史记录
async function saveClosedGroupToHistory(group, tabsInfo = []) {
  try {
    const groupData = {
      id: group.id,
      title: group.title,
      color: group.color,
      collapsed: group.collapsed,
      windowId: group.windowId,
      tabs: tabsInfo.length > 0 ? tabsInfo : (group.tabIds ? group.tabIds.map(tabId => ({ id: tabId })) : []),
      closedAt: Date.now(),
      isClosed: true
    };
    
    // 从存储中获取已关闭的标签组历史
    const result = await chrome.storage.local.get(['closedGroupHistory']);
    const closedHistory = result.closedGroupHistory || [];
    
    // 检查是否已存在
    const existingIndex = closedHistory.findIndex(h => h.id === group.id);
    if (existingIndex >= 0) {
      closedHistory[existingIndex] = groupData;
    } else {
      closedHistory.push(groupData);
    }
    
    // 限制历史记录数量（保留最近500个已关闭的标签组）
    if (closedHistory.length > 500) {
      closedHistory.sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
      closedHistory.splice(500);
    }
    
    await chrome.storage.local.set({ closedGroupHistory: closedHistory });
  } catch (error) {
    console.error('保存已关闭标签组历史失败:', error);
  }
}

// 保存标签页到历史记录
async function saveTabToHistory(tabId, removeInfo) {
  try {
    // 尝试从历史记录中获取标签页信息
    const historyItems = await chrome.history.search({
      text: '',
      maxResults: 100,
      startTime: Date.now() - 60000 // 最近1分钟
    });
    
    // 这里可以进一步处理标签页历史记录
    // 由于标签页关闭时无法直接获取其完整信息，需要通过其他方式保存
  } catch (error) {
    console.error('保存标签页历史失败:', error);
  }
}

// 定期保存所有当前标签组（作为备份）
chrome.alarms.create('saveGroupsPeriodically', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'saveGroupsPeriodically') {
    try {
      // 获取所有窗口的所有标签组
      const windows = await chrome.windows.getAll();
      for (const window of windows) {
        const groups = await chrome.tabGroups.query({ windowId: window.id });
        for (const group of groups) {
          await saveGroupToHistory(group);
        }
      }
    } catch (error) {
      console.error('定期保存标签组失败:', error);
    }
  }
});

// 在标签组更新时也保存（确保在关闭前有最新数据）
chrome.tabGroups.onUpdated.addListener(async (group) => {
  // 延迟保存，避免频繁写入
  setTimeout(async () => {
    await saveGroupToHistory(group);
  }, 1000);
});

