let tesseractWorker = null;

const LOG_PREFIX = '[JobPilot_Debug]';

function log(...args) {
  console.log(LOG_PREFIX, ...args);
}

document.addEventListener('DOMContentLoaded', function() {
  const grabBtn = document.getElementById('grabBtn');
  const loading = document.getElementById('loading');
  const loadingText = document.getElementById('loadingText');
  const messageEl = document.getElementById('message');
  const preview = document.getElementById('preview');
  const previewContent = document.getElementById('previewContent');
  const debugZone = document.getElementById('debugZone');
  const debugImage = document.getElementById('debugImage');
  const debugOcrResult = document.getElementById('debugOcrResult');

  log('🚀 Popup 已加载');

  grabBtn.addEventListener('click', async function() {
    log('========== 用户点击抓取按钮 ==========');
    
    grabBtn.disabled = true;
    loading.classList.add('show');
    messageEl.className = 'message';
    messageEl.textContent = '';
    preview.classList.remove('show');
    debugZone.classList.remove('show');

    try {
      log('📡 查询当前标签页...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        log('❌ 无法获取当前标签页');
        showError('无法获取当前标签页信息');
        return;
      }

      log('✅ 当前标签页:', tab.url);
      
      const isZhipin = tab.url && tab.url.includes('zhipin.com');
      log(`  是否 Boss 直聘: ${isZhipin}`);
      
      updateLoadingText('正在提取页面信息...');
      const result = await executeContentScript(tab.id, isZhipin);
      
      log('📥 Content Script 返回结果:', result);
      
      if (!result) {
        log('❌ Content Script 返回空结果');
        showWarning('未识别到岗位信息，请手动划选 JD 文本后再试。');
        return;
      }
      
      if (!result.success) {
        log('❌ Content Script 返回失败:', result.error);
        showError('提取失败: ' + (result.error || '未知错误'));
        return;
      }

      let ocrSalary = null;
      let debugImageDataUrl = null;
      
      if (result.salaryRect) {
        log('📐 检测到薪资坐标，开始 OCR 流程...');
        
        try {
          updateLoadingText('正在截图...');
          log('📸 调用 captureVisibleTab...');
          
          const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: 'png',
            quality: 100
          });
          
          log('✅ 截图成功，大小:', screenshotDataUrl.length);
          
          updateLoadingText('正在图像增强处理...');
          const enhancedResult = await enhanceAndCropImage(screenshotDataUrl, result.salaryRect);
          debugImageDataUrl = enhancedResult.dataUrl;
          
          log('✅ 图像增强完成');
          
          updateLoadingText('正在 OCR 识别薪资...');
          ocrSalary = await performLocalOCR(enhancedResult.canvas);
          
          if (ocrSalary) {
            log('✅ OCR 识别成功:', ocrSalary);
          } else {
            log('⚠️ OCR 识别失败，使用占位符');
            ocrSalary = 'OCR失败待确认';
          }
        } catch (ocrError) {
          log('❌ OCR 流程异常:', ocrError);
          ocrSalary = 'OCR失败待确认';
        }
      } else {
        log('⚠️ 未检测到薪资坐标，跳过 OCR');
        updateDebugZone(null, 'DOM 抓取成功，但未找到薪资坐标');
      }

      if (debugImageDataUrl) {
        updateDebugZone(debugImageDataUrl, ocrSalary || '识别失败');
      }

      let finalText = '';
      
      if (result.jobTitle) {
        finalText += `【岗位信息】${result.jobTitle}`;
      }
      
      if (ocrSalary) {
        finalText += `  ${ocrSalary}`;
      }
      
      if (result.jobTitle || ocrSalary) {
        finalText += '\n';
      }
      
      if (result.jobMeta) {
        finalText += `【基础要求】${result.jobMeta}\n`;
      }
      
      if (result.jdText) {
        finalText += `\n【职位描述】\n${result.jdText}`;
      }
      
      finalText = finalText.replace(/\n{3,}/g, '\n\n').trim();
      
      log('📝 最终文本长度:', finalText.length);
      
      if (finalText.length > 30) {
        const command = `调用 jobpilot 分析以下岗位并入库：\n\n${finalText}`;
        await navigator.clipboard.writeText(command);
        log('✅ 已写入剪贴板');
        showSuccess('JD 提取成功！已生成 Agent 指令，请前往终端 Ctrl+V 粘贴执行。');
        
        const previewText = finalText.length > 200 ? finalText.substring(0, 200) + '...' : finalText;
        previewContent.textContent = previewText;
        preview.classList.add('show');
      } else {
        log('⚠️ 最终文本过短:', finalText);
        showWarning('未识别到岗位信息，请手动划选 JD 文本后再试。');
      }
    } catch (error) {
      log('❌ 主流程异常:', error);
      showError('操作失败：' + error.message);
    } finally {
      grabBtn.disabled = false;
      loading.classList.remove('show');
      log('========== 抓取流程结束 ==========');
    }
  });

  async function executeContentScript(tabId, isZhipin) {
    log('🔧 执行 Content Script, tabId:', tabId);
    
    return new Promise((resolve) => {
      const timeout = 10000;
      const timeoutId = setTimeout(() => {
        log('⏰ Content Script 执行超时');
        resolve(null);
      }, timeout);

      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function(skipSalaryText) {
          const LOG_PREFIX = '[JobPilot_Debug]';
          function log(...args) { console.log(LOG_PREFIX, ...args); }
          
          log('📌 注入脚本开始执行...');

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

          function findByKeywords(container) {
            log('🔍 开始关键词搜索 JD...');
            const keywords = ['职位描述', '岗位职责', '任职要求', '岗位要求', '工作职责', '职位要求'];
            const allElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p, section');
            
            log(`  遍历 ${allElements.length} 个元素...`);
            
            for (const el of allElements) {
              const text = (el.innerText || '').trim();
              for (const keyword of keywords) {
                if (text.includes(keyword) && text.length < 50) {
                  log(`  ✅ 找到关键词 "${keyword}"`);
                  
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
                    log(`  ✅ 找到疑似薪资节点: "${text}"`);
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
                    log(`  ✅ 找到薪资元素: "${text}"`);
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

          try {
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
          } catch (e) {
            log('❌ 提取失败:', e);
            return { success: false, error: e.message, stack: e.stack };
          }
        },
        args: [isZhipin]
      }, (results) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          log('❌ Chrome Runtime Error:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        
        if (!results || results.length === 0) {
          log('❌ 脚本执行返回空结果');
          resolve(null);
          return;
        }
        
        log('✅ 脚本执行成功');
        resolve(results[0].result);
      });
    });
  }

  function updateDebugZone(imageUrl, ocrResult) {
    if (imageUrl) {
      debugImage.src = imageUrl;
    }
    debugOcrResult.textContent = ocrResult || '-';
    debugZone.classList.add('show');
  }

  async function enhanceAndCropImage(screenshotDataUrl, rect) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.getElementById('ocrCanvas');
          const ctx = canvas.getContext('2d');
          
          const dpr = rect.devicePixelRatio || 1;
          
          const viewportX = rect.viewportX !== undefined ? rect.viewportX : rect.x;
          const viewportY = rect.viewportY !== undefined ? rect.viewportY : rect.y;
          
          let srcX = Math.round(viewportX * dpr);
          let srcY = Math.round(viewportY * dpr);
          let srcWidth = Math.round(rect.width * dpr);
          let srcHeight = Math.round(rect.height * dpr);
          
          srcX = Math.max(0, Math.min(srcX, img.width - 1));
          srcY = Math.max(0, Math.min(srcY, img.height - 1));
          srcWidth = Math.min(srcWidth, img.width - srcX);
          srcHeight = Math.min(srcHeight, img.height - srcY);
          
          log('📐 裁剪参数:', { srcX, srcY, srcWidth, srcHeight, dpr });
          
          const scale = 3;
          canvas.width = srcWidth * scale;
          canvas.height = srcHeight * scale;
          
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, canvas.width, canvas.height);
          
          log('✅ 放大完成，尺寸:', canvas.width, 'x', canvas.height);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          let redPixelCount = 0;
          const totalPixels = data.length / 4;
          
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const isRed = (r > g + 40 && r > b + 40) ||
                          (r > 160 && g < 110 && b < 110) ||
                          (r > 200 && r > g * 1.4 && r > b * 1.4);
            
            if (isRed) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
              redPixelCount++;
            } else {
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
            }
          }
          
          log(`🔴 红色像素: ${redPixelCount} / ${totalPixels} (${(redPixelCount/totalPixels*100).toFixed(1)}%)`);
          
          ctx.putImageData(imageData, 0, 0);
          
          const dataUrl = canvas.toDataURL('image/png');
          
          resolve({ canvas, dataUrl });
        } catch (e) {
          log('❌ 图像处理失败:', e);
          reject(e);
        }
      };
      
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      
      img.src = screenshotDataUrl;
    });
  }

  async function initTesseractWorker() {
    if (tesseractWorker) return tesseractWorker;
    
    log('🔄 初始化 Tesseract Worker...');
    
    try {
      const extensionUrl = chrome.runtime.getURL('');
      const langPath = extensionUrl.endsWith('/') ? extensionUrl : extensionUrl + '/';
      
      log('  extensionUrl:', extensionUrl);
      log('  workerPath:', chrome.runtime.getURL('worker.min.js'));
      log('  corePath:', chrome.runtime.getURL('tesseract-core.wasm.js'));
      log('  langPath:', langPath);
      log('  traineddata:', chrome.runtime.getURL('eng.traineddata'));
      
      tesseractWorker = await Tesseract.createWorker('eng', 1, {
        workerPath: chrome.runtime.getURL('worker.min.js'),
        corePath: chrome.runtime.getURL('tesseract-core.wasm.js'),
        workerBlobURL: false,
        langPath: langPath,
        gzip: false,
        logger: m => {
          if (m.status === 'loading tesseract core') {
            log('📦 加载 Tesseract 核心...');
          } else if (m.status === 'initializing tesseract') {
            log('⚙️ 初始化 Tesseract...');
          } else if (m.status === 'loading language traineddata') {
            log('📚 加载语言数据...');
          } else if (m.status === 'initializing api') {
            log('🔧 初始化 API...');
          } else if (m.status === 'recognizing text') {
            log(`📊 OCR 进度: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      await tesseractWorker.setParameters({
        tessedit_char_whitelist: '0123456789-KkMm元天/月·~',
        tessedit_pageseg_mode: '7'
      });
      
      log('✅ Tesseract Worker 初始化完成');
      return tesseractWorker;
    } catch (e) {
      log('❌ Tesseract 初始化失败:', e);
      log('  错误详情:', e.message);
      if (e.stack) log('  堆栈:', e.stack);
      throw e;
    }
  }

  async function performLocalOCR(canvas) {
    log('🔍 开始本地 OCR 识别...');
    
    try {
      const worker = await initTesseractWorker();
      
      const result = await worker.recognize(canvas);
      
      log('📝 Tesseract 原始结果:', result.data.text);
      log('📊 Tesseract 置信度:', result.data.confidence);
      
      const cleanedText = cleanOCRResult(result.data.text);
      
      if (cleanedText && /\d/.test(cleanedText)) {
        log('✅ OCR 清洗后结果:', cleanedText);
        return cleanedText;
      } else {
        log('⚠️ OCR 未识别出有效数字');
        return null;
      }
    } catch (e) {
      log('❌ OCR 识别失败:', e);
      return null;
    }
  }

  function cleanOCRResult(text) {
    if (!text) return '';
    
    log('🧹 OCR 原始结果:', text);
    
    let cleaned = text
      .replace(/\s+/g, '')
      .replace(/[oOQD]/g, '0')
      .replace(/[lIi|!]/g, '1')
      .replace(/[sS]/g, '5')
      .replace(/[zZ]/g, '2')
      .replace(/[bB]/g, '8')
      .replace(/[gq]/g, '9')
      .replace(/[?_·•×*]/g, '-')
      .replace(/~/g, '-');
    
    log('🧹 字符替换后:', cleaned);
    
    cleaned = cleaned.replace(/(?:70|30)\/[A-Za-z]/gi, '元/天');
    cleaned = cleaned.replace(/(?:70|30)[KkXx]/g, '元/天');
    cleaned = cleaned.replace(/(\d)(?:70|30)[Kk]/g, '$1元/天');
    cleaned = cleaned.replace(/元\/[KkXx]/g, '元/天');
    
    log('🧹 视觉幻觉修复后:', cleaned);
    
    cleaned = cleaned.replace(/[^\d.\-KkMm万天元\/]/g, '');
    
    cleaned = cleaned.replace(/-{2,}/g, '-');
    cleaned = cleaned.replace(/^-+|-+$/g, '');
    
    const salaryMatch = cleaned.match(/(\d+\.?\d*)\s*[-~]\s*(\d+\.?\d*)\s*([KkMm万天元\/]+)?/);
    if (salaryMatch) {
      cleaned = `${salaryMatch[1]}-${salaryMatch[2]}${salaryMatch[3] || ''}`;
    }
    
    log('🧹 最终结果:', cleaned);
    
    return cleaned;
  }

  function updateLoadingText(text) {
    if (loadingText) loadingText.textContent = text;
  }

  function showSuccess(text) {
    messageEl.className = 'message success';
    messageEl.innerHTML = `✅ ${text}`;
  }

  function showError(text) {
    messageEl.className = 'message error';
    messageEl.innerHTML = `❌ ${text}`;
  }

  function showWarning(text) {
    messageEl.className = 'message warning';
    messageEl.innerHTML = `⚠️ ${text}`;
  }
});
