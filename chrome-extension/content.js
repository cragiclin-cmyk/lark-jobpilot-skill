(function() {
  'use strict';

  const LOG_PREFIX = '[JobPilot_Debug]';

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  log('🚀 Content Script 开始加载...');

  function injectUserSelectStyle() {
    const styleId = 'jobpilot-unlock-select';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `* { -webkit-user-select: text !important; user-select: text !important; }`;
    document.head.appendChild(style);
    log('✅ 已注入 CSS 解锁样式');
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function findActiveDetailContainer() {
    log('🔍 开始查找详情容器...');
    const selectors = ['.job-detail', '.detail-content', '.job-box', '.job-content', '[class*="detail"]', '.job-info'];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      log(`  尝试选择器 "${selector}": 找到 ${elements.length} 个元素`);
      
      for (const el of elements) {
        if (isVisible(el)) {
          const text = (el.innerText || '').trim();
          if (text.length > 100) {
            log(`  ✅ 找到有效容器: "${selector}", 文本长度: ${text.length}`);
            return el;
          }
        }
      }
    }
    
    log('  ⚠️ 未找到特定容器，使用 document.body');
    return document.body;
  }

  function flattenSkillTags(container) {
    log('🔍 开始扁平化技能标签...');
    const tagSelectors = [
      '.job-keyword-list li',
      '.job-keyword-list span',
      '.keyword-list li',
      '.keyword-list span',
      '.skill-tags li',
      '.skill-tags span',
      '.tag-list li',
      '.tag-list span',
      '[class*="keyword"] li',
      '[class*="keyword"] span'
    ];
    
    for (const selector of tagSelectors) {
      const elements = container.querySelectorAll(selector);
      if (elements.length >= 2) {
        const tags = Array.from(elements)
          .map(el => (el.innerText || '').trim())
          .filter(t => t.length > 0 && t.length < 20);
        
        if (tags.length >= 2) {
          const flattened = tags.join(' ');
          log(`  ✅ 扁平化 ${tags.length} 个技能标签: "${flattened.substring(0, 50)}..."`);
          return flattened;
        }
      }
    }
    
    log('  ⚠️ 未找到技能标签列表');
    return '';
  }

  function findByKeywords(container) {
    log('🔍 开始关键词搜索 JD...');
    const keywords = ['职位描述', '岗位职责', '任职要求', '岗位要求', '工作职责', '职位要求'];
    const allElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p, section');
    
    log(`  遍历 ${allElements.length} 个元素...`);
    
    for (const el of allElements) {
      const text = (el.innerText || '').trim();
      for (const keyword of keywords) {
        if (text.includes(keyword) && text.length < 50) {
          log(`  ✅ 找到关键词 "${keyword}" 在元素:`, el);
          
          let contentEl = el.nextElementSibling;
          let collectedText = '';
          let attempts = 0;
          
          while (contentEl && attempts < 15) {
            const contentText = (contentEl.innerText || '').trim();
            if (contentText.length > 20) {
              collectedText += contentText + '\n';
            }
            contentEl = contentEl.nextElementSibling;
            attempts++;
          }
          
          if (collectedText.length > 50) {
            log(`  ✅ 收集到 JD 文本，长度: ${collectedText.length}`);
            return collectedText;
          }
        }
      }
    }
    
    log('  ⚠️ 关键词搜索未找到 JD');
    return null;
  }

  function findBySpecificSelectors(container) {
    log('🔍 开始特定选择器搜索 JD...');
    const selectors = ['.job-sec-text', '.job-sec', '.job-description', '.detail-content', '.job-detail-content', '.text'];
    
    for (const selector of selectors) {
      const elements = container.querySelectorAll(selector);
      log(`  尝试选择器 "${selector}": 找到 ${elements.length} 个元素`);
      
      for (const el of elements) {
        if (isVisible(el)) {
          const text = (el.innerText || '').trim();
          if (text.length > 50) {
            log(`  ✅ 找到 JD，长度: ${text.length}`);
            return text;
          }
        }
      }
    }
    
    log('  ⚠️ 特定选择器未找到 JD');
    return null;
  }

  function findSalaryByKeyword() {
    log('🔍 开始暴力搜索薪资节点...');
    const salaryKeywords = ['元/天', '元/月', 'K', 'k', '薪', '薪资', '万/月', '/天', '/月'];
    const allElements = document.querySelectorAll('span, div, p, em, strong, b');
    
    log(`  遍历 ${allElements.length} 个元素...`);
    
    for (const el of allElements) {
      if (!isVisible(el)) continue;
      
      const text = (el.innerText || '').trim();
      if (text.length === 0 || text.length > 30) continue;
      
      for (const keyword of salaryKeywords) {
        if (text.includes(keyword)) {
          if (/[\d]/.test(text)) {
            log(`  ✅ 找到疑似薪资节点: "${text}"`, el);
            return el;
          }
        }
      }
    }
    
    log('  ⚠️ 暴力搜索未找到薪资节点');
    return null;
  }

  function findSalaryElement(container) {
    log('🔍 开始查找薪资元素...');
    const selectors = ['.salary', '.job-salary', '[class*="salary"]', '.red', '[class*="price"]', '.wage'];
    
    for (const selector of selectors) {
      const elements = container.querySelectorAll(selector);
      log(`  尝试选择器 "${selector}": 找到 ${elements.length} 个元素`);
      
      for (const el of elements) {
        if (isVisible(el)) {
          const text = (el.innerText || '').trim();
          if (text.length > 0 && text.length < 50) {
            log(`  ✅ 找到薪资元素: "${text}"`, el);
            return el;
          }
        }
      }
    }
    
    log('  ⚠️ 选择器未找到，尝试暴力搜索...');
    return findSalaryByKeyword();
  }

  function getSalaryRect(el) {
    if (!el) {
      log('  ⚠️ 薪资元素为空，无法获取坐标');
      return null;
    }
    
    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    
    const result = {
      x: Math.round(rect.left + scrollX),
      y: Math.round(rect.top + scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewportX: Math.round(rect.left),
      viewportY: Math.round(rect.top),
      devicePixelRatio: window.devicePixelRatio || 1
    };
    
    log(`  📐 薪资坐标:`, result);
    return result;
  }

  function extractJobInfo(container) {
    log('🔍 开始提取职位信息...');
    const infoSelectors = ['.job-name', '.job-title', '.name', 'h1', 'h2', '.title'];
    let jobTitle = '';
    let titleElement = null;
    
    for (const selector of infoSelectors) {
      const el = container.querySelector(selector);
      if (el && isVisible(el)) {
        const text = (el.innerText || '').trim();
        log(`  尝试选择器 "${selector}": "${text.substring(0, 30)}..."`);
        
        if (text.length > 2 && text.length < 100) {
          const salaryEl = el.querySelector('.salary, .job-salary, [class*="salary"]');
          if (salaryEl) {
            jobTitle = text.replace((salaryEl.innerText || '').trim(), '').trim();
          } else {
            jobTitle = text;
          }
          
          if (jobTitle.length > 2) {
            titleElement = el;
            log(`  ✅ 找到职位名称: "${jobTitle}"`);
            break;
          }
        }
      }
    }
    
    if (!jobTitle) {
      log('  ⚠️ 未找到职位名称');
    }
    
    const salaryElement = findSalaryElement(container);
    const salaryRect = getSalaryRect(salaryElement);
    
    return { jobTitle, salaryRect, titleElement };
  }

  function extractJobMeta(container, titleElement) {
    log('🔍 开始提取基础要求...');
    let headerArea = titleElement ? 
      (titleElement.closest('[class*="header"]') || titleElement.closest('[class*="banner"]') || titleElement.parentElement?.parentElement) : null;
    if (!headerArea) headerArea = container;
    
    const metaSelectors = ['.job-info span', '.job-tags', '.job-tag', '[class*="tag"]', '[class*="info-item"]', 'span'];
    let metaElements = [];
    
    for (const selector of metaSelectors) {
      const elements = headerArea.querySelectorAll(selector);
      if (elements.length > 0) {
        metaElements = Array.from(elements).filter(el => isVisible(el));
        if (metaElements.length > 0) {
          log(`  使用选择器 "${selector}" 找到 ${metaElements.length} 个元素`);
          break;
        }
      }
    }
    
    if (metaElements.length > 0) {
      const tags = metaElements.map(el => {
        const text = (el.innerText || '').trim();
        return text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      }).filter(t => t.length > 0 && t.length < 30 && !['立即沟通', '收藏', '分享', '举报'].includes(t));
      const result = [...new Set(tags)].join(' - ');
      log(`  ✅ 基础要求: "${result}"`);
      return result;
    }
    
    log('  ⚠️ 未找到基础要求');
    return '';
  }

  function flattenText(text) {
    return text ? text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  }

  function cleanJDText(text) {
    if (!text) return '';
    
    let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/收起/g, '').replace(/展开/g, '').replace(/显示全部/g, '');
    
    const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const processedLines = [];
    let tagBuffer = [];
    
    for (const line of lines) {
      const isLikelyTag = line.length >= 2 && line.length <= 15 && 
                          !/^\d/.test(line) && 
                          !line.includes('：') && 
                          !line.includes(':') &&
                          !line.startsWith('•') &&
                          !line.startsWith('-') &&
                          !line.startsWith('·') &&
                          !/^[（(]/.test(line) &&
                          !/^\d+[.、)）]/.test(line);
      
      if (isLikelyTag) {
        tagBuffer.push(line);
      } else {
        if (tagBuffer.length >= 2) {
          processedLines.push(tagBuffer.join(' '));
          log(`  📌 扁平化 ${tagBuffer.length} 个标签: "${tagBuffer.join(' ')}"`);
        } else if (tagBuffer.length === 1) {
          processedLines.push(tagBuffer[0]);
        }
        tagBuffer = [];
        processedLines.push(line);
      }
    }
    
    if (tagBuffer.length >= 2) {
      processedLines.push(tagBuffer.join(' '));
      log(`  📌 扁平化 ${tagBuffer.length} 个标签: "${tagBuffer.join(' ')}"`);
    } else if (tagBuffer.length === 1) {
      processedLines.push(tagBuffer[0]);
    }
    
    return processedLines.join('\n');
  }

  function extractAllJobInfo() {
    log('========== 开始提取岗位信息 ==========');
    
    injectUserSelectStyle();
    
    const container = findActiveDetailContainer();
    
    let jdText = findByKeywords(container) || findBySpecificSelectors(container);
    if (!jdText) {
      log('⚠️ 未找到 JD，尝试获取整个容器文本...');
      jdText = (container.innerText || '').trim();
    }
    
    const { jobTitle, salaryRect, titleElement } = extractJobInfo(container);
    const jobMeta = extractJobMeta(container, titleElement);
    
    const cleanedJD = jdText ? cleanJDText(jdText) : '';
    const cleanedMeta = jobMeta ? flattenText(jobMeta) : '';
    
    const result = {
      success: true,
      jobTitle: jobTitle || '',
      salaryRect: salaryRect,
      jdText: cleanedJD,
      jobMeta: cleanedMeta
    };
    
    log('========== 提取完成 ==========');
    log('📊 结果:', {
      jobTitle: result.jobTitle || '(空)',
      hasSalaryRect: !!result.salaryRect,
      jdLength: result.jdText.length,
      metaLength: result.jobMeta.length
    });
    
    return result;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('📨 收到消息:', message.action);
    
    if (message.action === 'extractJobInfo' || message.action === 'ping') {
      try {
        const result = extractAllJobInfo();
        log('📤 发送响应...');
        sendResponse(result);
      } catch (e) {
        log('❌ 提取失败:', e);
        sendResponse({ success: false, error: e.message, stack: e.stack });
      }
      return true;
    }
  });

  log('✅ Content Script 加载完成，等待消息...');
})();
