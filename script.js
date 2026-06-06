// ========== PDF.js Configuration ==========
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// ========== Global Variables ==========
let lastAdTime = 0;
let pendingAction = null;
let userHistory = JSON.parse(localStorage.getItem('toolHistory') || '[]');
let currentToolId = null;

// ========== Helper Functions ==========
function showLoading(show = true) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function addToHistory(toolName, result) {
    userHistory.unshift({
        tool: toolName,
        result: result,
        timestamp: new Date().toISOString(),
        id: Date.now()
    });
    if (userHistory.length > 20) userHistory.pop();
    localStorage.setItem('toolHistory', JSON.stringify(userHistory));
}

function shareResult(title, text, url) {
    if (navigator.share) {
        navigator.share({ title, text, url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text);
        showToast('تم نسخ الرابط للحفظ', 'info');
    }
}

function showAdBeforeAction(callback) {
    const now = Date.now();
    const timeSinceLastAd = now - lastAdTime;
    if (timeSinceLastAd > 30000 || lastAdTime === 0) {
        pendingAction = callback;
        const modal = document.getElementById('adModal');
        modal.style.display = 'flex';
        
        try {
            (adsbygoogle = window.adsbygoogle || []).push({});
        } catch(e) { console.error("AdSense error:", e); }
        
        let seconds = 5;
        const countdownSpan = document.getElementById('countdown');
        const timerInterval = setInterval(() => {
            seconds--;
            if (countdownSpan) countdownSpan.innerText = seconds;
            if (seconds <= 0) {
                clearInterval(timerInterval);
                const closeBtn = document.getElementById('closeAdBtn');
                closeBtn.disabled = false;
                closeBtn.style.opacity = '1';
                closeBtn.innerText = 'استكمال العملية';
            }
        }, 1000);
        
        const closeBtn = document.getElementById('closeAdBtn');
        const closeHandler = () => {
            clearInterval(timerInterval);
            modal.style.display = 'none';
            lastAdTime = Date.now();
            if (pendingAction) {
                pendingAction();
                pendingAction = null;
            }
            closeBtn.removeEventListener('click', closeHandler);
        };
        closeBtn.addEventListener('click', closeHandler, { once: true });
        closeBtn.disabled = true;
        closeBtn.style.opacity = '0.5';
        closeBtn.innerText = 'انتظر 5 ثوانٍ...';
    } else {
        callback();
    }
}

// ========== Page Navigation ==========
function showPrivacyPage() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('privacyPage').classList.add('active');
    updateBreadcrumbs('سياسة الخصوصية');
}

function showContactPage() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('contactPage').classList.add('active');
    updateBreadcrumbs('اتصل بنا');
}

function showAboutPage() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('aboutPage').classList.add('active');
    updateBreadcrumbs('من نحن');
}

function showToolsPage() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('toolsPage').classList.add('active');
    updateBreadcrumbs('الرئيسية');
    renderTools('all');
}

function updateBreadcrumbs(pageName) {
    const bread = document.getElementById('breadcrumbs');
    if (bread) bread.innerHTML = `<a href="#" onclick="showToolsPage()"><i class="fas fa-home"></i> الرئيسية</a> / <span>${pageName}</span>`;
}

// ========== Tools Definition ==========
const tools = {
    'image-to-ico': { category: 'images', name: 'تحويل الصورة إلى ICO', desc: 'تحويل PNG, JPG إلى أيقونات Windows', icon: 'fa-images' },
    'image-compress': { category: 'images', name: 'ضغط الصور بدون فقدان', desc: 'ضغط JPEG, PNG مع الحفاظ على الجودة', icon: 'fa-compress' },
    'image-convert': { category: 'images', name: 'تحويل الصور', desc: 'تحويل بين JPG, PNG, WEBP, BMP', icon: 'fa-exchange-alt' },
    'remove-bg': { category: 'images', name: 'إزالة خلفية الصور', desc: 'إزالة الخلفية من الصور تلقائياً', icon: 'fa-eraser' },
    'resize-image': { category: 'images', name: 'تغيير حجم الصور', desc: 'تغيير أبعاد الصور بدقة عالية', icon: 'fa-expand' },
    'crop-image': { category: 'images', name: 'قص الصور', desc: 'قص الصور بأداة احترافية', icon: 'fa-crop' },
    'watermark': { category: 'images', name: 'إضافة علامة مائية', desc: 'إضافة نص أو صورة كعلامة مائية', icon: 'fa-watermark' },
    'heic-to-png': { category: 'images', name: 'تحويل HEIC إلى PNG', desc: 'تحويل صور الآيفون HEIC إلى PNG', icon: 'fa-mobile-alt' },
    'image-filter': { category: 'images', name: 'فلتر الصور', desc: 'تطبيق فلاتر على الصور', icon: 'fa-magic' },
    'images-to-pdf': { category: 'pdf', name: 'الصور إلى PDF', desc: 'دمج الصور في ملف PDF واحد', icon: 'fa-file-pdf' },
    'merge-pdf': { category: 'pdf', name: 'دمج PDF', desc: 'دمج عدة PDF في ملف واحد', icon: 'fa-compress-alt' },
    'split-pdf': { category: 'pdf', name: 'تقسيم PDF', desc: 'تقسيم ملف PDF إلى صفحات منفصلة', icon: 'fa-cut' },
    'compress-pdf': { category: 'pdf', name: 'ضغط PDF', desc: 'تقليل حجم ملفات PDF', icon: 'fa-file-archive' },
    'pdf-to-images': { category: 'pdf', name: 'PDF إلى صور', desc: 'تحويل PDF إلى صور PNG', icon: 'fa-file-image' },
    'pdf-protect': { category: 'pdf', name: 'حماية PDF', desc: 'إضافة كلمة مرور لملف PDF', icon: 'fa-lock' },
    'json-formatter': { category: 'dev', name: 'تنسيق JSON', desc: 'تنسيق JSON وعرضه بشكل مرتب', icon: 'fa-code' },
    'json-to-dart': { category: 'dev', name: 'JSON إلى Dart', desc: 'تحويل JSON إلى Model في Dart', icon: 'fa-brands fa-dart' },
    'base64': { category: 'dev', name: 'Base64', desc: 'تشفير وفك تشفير Base64', icon: 'fa-lock' },
    'password-generator': { category: 'dev', name: 'مولد كلمات مرور', desc: 'إنشاء كلمات مرور قوية', icon: 'fa-key' },
    'uuid-generator': { category: 'dev', name: 'مولد UUID', desc: 'إنشاء معرفات فريدة', icon: 'fa-id-card' },
    'color-converter': { category: 'dev', name: 'محول الألوان', desc: 'تحويل بين HEX و RGB و HSL', icon: 'fa-palette' },
    'url-encode': { category: 'dev', name: 'تشفير URL', desc: 'تشفير وفك تشفير الروابط', icon: 'fa-link' },
    'regex-tester': { category: 'dev', name: 'اختبار Regex', desc: 'اختبار التعابير النمطية', icon: 'fa-terminal' },
    'qr-generator': { category: 'qr', name: 'مولد QR متقدم', desc: 'QR Code مع شعار و vCard', icon: 'fa-qrcode' },
    'qr-reader': { category: 'qr', name: 'قارئ QR', desc: 'قراءة QR Code من الصور', icon: 'fa-qrcode' },
    'barcode-generator': { category: 'qr', name: 'مولد باركود', desc: 'إنشاء باركود بأنواع مختلفة', icon: 'fa-barcode' },
    'profile-downloader': { category: 'social', name: 'صورة الملف الشخصي', desc: 'تحميل صور الملفات الشخصية', icon: 'fa-user-circle' },
    'youtube-thumbnail': { category: 'social', name: 'مصغر يوتيوب', desc: 'استخراج صور مصغرة لليوتيوب', icon: 'fa-youtube' },
    'instagram-downloader': { category: 'social', name: 'تحميل من انستقرام', desc: 'تحميل فيديوهات وصور انستقرام', icon: 'fa-instagram' }
};

// ========== Categories ==========
const categories = [
    { id: 'all', name: 'الكل', icon: 'fa-th' },
    { id: 'images', name: 'الصور', icon: 'fa-image' },
    { id: 'pdf', name: 'PDF', icon: 'fa-file-pdf' },
    { id: 'dev', name: 'المطورين', icon: 'fa-code' },
    { id: 'qr', name: 'QR & Barcode', icon: 'fa-qrcode' },
    { id: 'social', name: 'سوشيال ميديا', icon: 'fa-share-alt' }
];

// ========== Render Functions ==========
function renderCategories() {
    const nav = document.getElementById('categoriesNav');
    if(!nav) return;
    nav.innerHTML = categories.map(cat => `<button class="category-btn ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}"><i class="fas ${cat.icon}"></i> ${cat.name}</button>`).join('');
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTools(btn.dataset.category);
        });
    });
}

function renderTools(category = 'all') {
    const grid = document.getElementById('toolsGrid');
    if(!grid) return;
    const filteredTools = Object.entries(tools).filter(([id, tool]) => category === 'all' || tool.category === category);
    grid.innerHTML = filteredTools.map(([id, tool]) => `<div class="tool-card" onclick="openTool('${id}')"><i class="fas ${tool.icon}"></i><h3>${tool.name}</h3><p>${tool.desc}</p><button class="tool-btn">استخدام الأداة</button></div>`).join('');
}

function searchTools() {
    const searchTerm = document.getElementById('searchTools')?.value.toLowerCase() || '';
    const grid = document.getElementById('toolsGrid');
    if(!grid) return;
    const filteredTools = Object.entries(tools).filter(([id, tool]) => tool.name.toLowerCase().includes(searchTerm) || tool.desc.toLowerCase().includes(searchTerm));
    grid.innerHTML = filteredTools.map(([id, tool]) => `<div class="tool-card" onclick="openTool('${id}')"><i class="fas ${tool.icon}"></i><h3>${tool.name}</h3><p>${tool.desc}</p><button class="tool-btn">استخدام الأداة</button></div>`).join('');
}

function openTool(toolId) {
    currentToolId = toolId;
    const tool = tools[toolId];
    if (!tool) return;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('toolPage').classList.add('active');
    document.getElementById('toolTitle').textContent = tool.name;
    document.getElementById('toolDesc').textContent = tool.desc;
    document.getElementById('toolBody').innerHTML = getToolHTML(toolId);
    setTimeout(() => {
        const initFunc = toolInitializers[toolId];
        if (initFunc) initFunc();
    }, 100);
    updateBreadcrumbs(tool.name);
}

function getToolHTML(toolId) {
    const htmls = {
        'image-to-ico': getImageToICOHtml,
        'image-compress': getImageCompressHtml,
        'image-convert': getImageConvertHtml,
        'remove-bg': getRemoveBgHtml,
        'resize-image': getResizeImageHtml,
        'crop-image': getCropImageHtml,
        'watermark': getWatermarkHtml,
        'heic-to-png': getHeicToPngHtml,
        'image-filter': getImageFilterHtml,
        'images-to-pdf': getImagesToPdfHtml,
        'merge-pdf': getMergePdfHtml,
        'split-pdf': getSplitPdfHtml,
        'compress-pdf': getCompressPdfHtml,
        'pdf-to-images': getPdfToImagesHtml,
        'pdf-protect': getPdfProtectHtml,
        'json-formatter': getJsonFormatterHtml,
        'json-to-dart': getJsonToDartHtml,
        'base64': getBase64Html,
        'password-generator': getPasswordGeneratorHtml,
        'uuid-generator': getUuidGeneratorHtml,
        'color-converter': getColorConverterHtml,
        'url-encode': getUrlEncodeHtml,
        'regex-tester': getRegexTesterHtml,
        'qr-generator': getQrGeneratorHtml,
        'qr-reader': getQrReaderHtml,
        'barcode-generator': getBarcodeGeneratorHtml,
        'profile-downloader': getProfileDownloaderHtml,
        'youtube-thumbnail': getYoutubeThumbnailHtml,
        'instagram-downloader': getInstagramDownloaderHtml
    };
    return (htmls[toolId] || (() => '<p>جاري تحميل الأداة...</p>'))();
}

// ========== Tool HTML Generators ==========
function getImageToICOHtml() {
    return `
        <div class="upload-area" id="icoUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اسحب وأفلت صورتك هنا</h3>
            <p>PNG, JPG, GIF, WEBP (حد أقصى 5 م.ب)</p>
            <button class="browse-btn" id="icoBrowseBtn">اختر صورة</button>
            <input type="file" id="icoFileInput" accept="image/*" style="display: none;">
        </div>
        <div id="icoPreview" style="display: none;">
            <div class="preview-area">
                <img id="icoPreviewImg" style="max-width: 100px;">
                <p id="icoPreviewInfo"></p>
            </div>
            <h4>معاينة الأحجام</h4>
            <div class="sizes-preview" id="sizesPreview"></div>
        </div>
        <div class="form-group">
            <label>اسم الملف</label>
            <input type="text" id="icoFileName" class="form-control" value="icon">
        </div>
        <div class="progress-bar" id="icoProgress" style="display: none;"><div class="progress-fill"></div></div>
        <div class="actions">
            <button class="btn btn-primary" id="convertICObtn"><i class="fas fa-magic"></i> تحويل إلى ICO</button>
            <button class="btn btn-info" id="shareIcoBtn" style="display: none;"><i class="fas fa-share-alt"></i> مشاركة</button>
        </div>
    `;
}

function getImageCompressHtml() {
    return `
        <div class="upload-area" id="compressUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر صورة لضغطها</h3>
            <button class="browse-btn" id="compressBrowseBtn">اختر صورة</button>
            <input type="file" id="compressFileInput" accept="image/*" style="display: none;">
        </div>
        <div class="form-group">
            <label>جودة الضغط: <span id="qualityValue">80</span>%</label>
            <input type="range" id="compressQuality" min="10" max="100" value="80">
        </div>
        <div id="compressPreview" style="display: none;">
            <div class="preview-area">
                <p>الأصل: <span id="originalSize"></span> | المضغوط: <span id="compressedSize"></span></p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <div><p>الصورة الأصلية</p><img id="originalPreview" style="max-width: 150px;"></div>
                    <div><p>بعد الضغط</p><img id="compressedPreview" style="max-width: 150px;"></div>
                </div>
            </div>
        </div>
        <div class="actions">
            <button class="btn btn-primary" id="compressBtn">ضغط الصورة</button>
        </div>
    `;
}

function getImageConvertHtml() {
    return `
        <div class="upload-area" id="convertUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر صورة للتحويل</h3>
            <button class="browse-btn" id="convertBrowseBtn">اختر صورة</button>
            <input type="file" id="convertFileInput" accept="image/*" style="display: none;">
        </div>
        <div class="form-group">
            <label>صيغة الإخراج</label>
            <select id="outputFormat" class="form-control">
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WEBP</option>
                <option value="image/bmp">BMP</option>
            </select>
        </div>
        <div id="convertPreview" style="display: none;">
            <div class="preview-area"><img id="convertPreviewImg" style="max-width: 200px;"></div>
        </div>
        <div class="actions">
            <button class="btn btn-primary" id="convertImageBtn">تحويل</button>
        </div>
    `;
}

function getRemoveBgHtml() {
    return `
        <div class="upload-area" id="removeBgUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر صورة لإزالة الخلفية</h3>
            <p>للحصول على أفضل النتائج، اختر صورة ذات خلفية موحدة</p>
            <button class="browse-btn" id="removeBgBrowseBtn">اختر صورة</button>
            <input type="file" id="removeBgFileInput" accept="image/*" style="display: none;">
        </div>
        <div class="form-group">
            <label>حساسية الإزالة: <span id="thresholdValue">50</span></label>
            <input type="range" id="bgThreshold" min="10" max="100" value="50">
        </div>
        <div id="removeBgPreview" style="display: none;">
            <div class="preview-area">
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <div><p>الأصل</p><img id="originalBgImg" style="max-width: 150px;"></div>
                    <div><p>بعد الإزالة</p><img id="removedBgImg" style="max-width: 150px;"></div>
                </div>
            </div>
        </div>
        <div class="actions">
            <button class="btn btn-primary" id="removeBgBtn">إزالة الخلفية</button>
        </div>
    `;
}

function getResizeImageHtml() {
    return `
        <div class="upload-area" id="resizeUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر صورة لتغيير حجمها</h3>
            <button class="browse-btn" id="resizeBrowseBtn">اختر صورة</button>
            <input type="file" id="resizeFileInput" accept="image/*" style="display: none;">
        </div>
        <div class="form-group">
            <label>العرض (بكسل)</label>
            <input type="number" id="resizeWidth" class="form-control" placeholder="عرض جديد">
        </div>
        <div class="form-group">
            <label>الارتفاع (بكسل)</label>
            <input type="number" id="resizeHeight" class="form-control" placeholder="ارتفاع جديد">
        </div>
        <div class="form-group">
            <label><input type="checkbox" id="keepAspect" checked> الحفاظ على النسبة</label>
        </div>
        <div id="resizePreview" style="display: none;">
            <div class="preview-area"><img id="resizePreviewImg" style="max-width: 200px;"><p id="resizeInfo"></p></div>
        </div>
        <div class="actions">
            <button class="btn btn-primary" id="resizeBtn">تغيير الحجم</button>
        </div>
    `;
}

function getCropImageHtml() {
    return `
        <div class="upload-area" id="cropUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر صورة لقصها</h3>
            <button class="browse-btn" id="cropBrowseBtn">اختر صورة</button>
            <input type="file" id="cropFileInput" accept="image/*" style="display: none;">
        </div>
        <div id="cropContainer" style="display: none;">
            <div style="max-width: 100%; max-height: 400px;"><img id="cropImage" style="max-width: 100%;"></div>
            <div class="form-group">
                <label>نسبة القص</label>
                <select id="aspectRatio" class="form-control">
                    <option value="0">حر</option>
                    <option value="1">1:1</option>
                    <option value="4/3">4:3</option>
                    <option value="16/9">16:9</option>
                </select>
            </div>
            <div class="actions"><button class="btn btn-primary" id="cropBtn">قص الصورة</button></div>
        </div>
    `;
}

function getWatermarkHtml() {
    return `
        <div class="upload-area" id="watermarkUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر صورة لإضافة علامة مائية</h3>
            <button class="browse-btn" id="watermarkBrowseBtn">اختر صورة</button>
            <input type="file" id="watermarkFileInput" accept="image/*" style="display: none;">
        </div>
        <div class="form-group">
            <label>نوع العلامة المائية</label>
            <select id="watermarkType" class="form-control">
                <option value="text">نص</option>
                <option value="image">صورة</option>
            </select>
        </div>
        <div id="watermarkTextOptions">
            <div class="form-group"><label>النص</label><input type="text" id="watermarkText" class="form-control" value="علامة مائية"></div>
            <div class="form-group"><label>اللون</label><input type="color" id="watermarkColor" class="form-control" value="#ffffff"></div>
        </div>
        <div id="watermarkImageOptions" style="display: none;">
            <div class="upload-area" id="watermarkImageUploadArea">
                <h3>اختر صورة العلامة المائية</h3>
                <button class="browse-btn" id="watermarkImageBrowseBtn">اختر صورة</button>
                <input type="file" id="watermarkImageFile" accept="image/*" style="display: none;">
            </div>
        </div>
        <div class="form-group">
            <label>الشفافية: <span id="watermarkOpacityValue">50</span>%</label>
            <input type="range" id="watermarkOpacity" min="0" max="100" value="50">
        </div>
        <div id="watermarkPreview" style="display: none;"><div class="preview-area"><img id="watermarkPreviewImg" style="max-width: 300px;"></div></div>
        <div class="actions"><button class="btn btn-primary" id="applyWatermarkBtn">تطبيق العلامة المائية</button></div>
    `;
}

function getHeicToPngHtml() {
    return `
        <div class="upload-area" id="heicUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر صورة HEIC للتحويل</h3>
            <p>صور الآيفون (HEIC/HEIF) إلى PNG</p>
            <button class="browse-btn" id="heicBrowseBtn">اختر صورة</button>
            <input type="file" id="heicFileInput" accept=".heic,.heif,image/heic,image/heif" style="display: none;">
        </div>
        <div id="heicPreview" style="display: none;"><div class="preview-area"><img id="heicPreviewImg" style="max-width: 200px;"></div></div>
        <div class="actions"><button class="btn btn-primary" id="convertHeicBtn">تحويل إلى PNG</button></div>
    `;
}

function getImageFilterHtml() {
    return `
        <div class="upload-area" id="filterUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر صورة لتطبيق الفلتر</h3>
            <button class="browse-btn" id="filterBrowseBtn">اختر صورة</button>
            <input type="file" id="filterFileInput" accept="image/*" style="display: none;">
        </div>
        <div class="form-group">
            <label>الفلتر</label>
            <select id="filterType" class="form-control">
                <option value="none">بدون فلتر</option>
                <option value="grayscale">أبيض وأسود</option>
                <option value="sepia">سيبيا</option>
                <option value="invert">عكس الألوان</option>
                <option value="brightness">سطوع +50%</option>
                <option value="contrast">تباين +50%</option>
                <option value="blur">ضبابية</option>
            </select>
        </div>
        <div id="filterPreview" style="display: none;"><div class="preview-area"><img id="filterPreviewImg" style="max-width: 200px;"></div></div>
        <div class="actions"><button class="btn btn-primary" id="applyFilterBtn">تطبيق الفلتر</button></div>
    `;
}

function getImagesToPdfHtml() {
    return `
        <div class="upload-area" id="pdfUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر صوراً متعددة</h3>
            <button class="browse-btn" id="pdfBrowseBtn">اختر صوراً</button>
            <input type="file" id="pdfFilesInput" multiple accept="image/*" style="display: none;">
        </div>
        <div id="pdfImagesPreview" class="preview-area" style="display: none;"><div id="imageList" style="display: flex; flex-wrap: wrap; gap: 10px;"></div></div>
        <div class="form-group">
            <label>حجم الصفحة</label>
            <select id="pdfPageSize" class="form-control">
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="fit">تلقائي</option>
            </select>
        </div>
        <div class="actions"><button class="btn btn-primary" id="createPdfBtn">إنشاء PDF</button></div>
    `;
}

function getMergePdfHtml() {
    return `
        <div class="upload-area" id="mergePdfUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر ملفات PDF للدمج</h3>
            <button class="browse-btn" id="mergePdfBrowseBtn">اختر PDF</button>
            <input type="file" id="mergePdfFiles" multiple accept=".pdf" style="display: none;">
        </div>
        <div id="mergePdfList" class="preview-area" style="display: none;"><div id="pdfFileList"></div></div>
        <div class="actions"><button class="btn btn-primary" id="doMergePdfBtn">دمج الملفات</button></div>
    `;
}

function getSplitPdfHtml() {
    return `
        <div class="upload-area" id="splitPdfUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر ملف PDF للتقسيم</h3>
            <button class="browse-btn" id="splitPdfBrowseBtn">اختر PDF</button>
            <input type="file" id="splitPdfFile" accept=".pdf" style="display: none;">
        </div>
        <div id="splitResult" class="preview-area" style="display: none;"><div id="splitPagesList"></div></div>
        <div class="actions"><button class="btn btn-primary" id="doSplitPdfBtn">تقسيم PDF</button></div>
    `;
}

function getCompressPdfHtml() {
    return `
        <div class="upload-area" id="compressPdfUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر PDF للضغط</h3>
            <button class="browse-btn" id="compressPdfBrowseBtn">اختر PDF</button>
            <input type="file" id="compressPdfFile" accept=".pdf" style="display: none;">
        </div>
        <div class="form-group">
            <label>جودة الضغط: <span id="pdfQualityValue">80</span>%</label>
            <input type="range" id="pdfCompressQuality" min="10" max="100" value="80">
        </div>
        <div id="compressPdfResult" class="preview-area" style="display: none;">
            <p>الأصلي: <span id="originalPdfSize"></span> | المضغوط: <span id="compressedPdfSize"></span></p>
            <p>التوفير: <span id="saveRatio"></span>%</p>
        </div>
        <div class="actions"><button class="btn btn-primary" id="doCompressPdfBtn">ضغط PDF</button></div>
    `;
}

function getPdfToImagesHtml() {
    return `
        <div class="upload-area" id="pdfToImagesUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر PDF للتحويل إلى صور</h3>
            <button class="browse-btn" id="pdfToImagesBrowseBtn">اختر PDF</button>
            <input type="file" id="pdfToImagesFile" accept=".pdf" style="display: none;">
        </div>
        <div class="form-group">
            <label>الدقة</label>
            <select id="pdfImageQuality" class="form-control">
                <option value="1">منخفضة</option>
                <option value="2" selected>متوسطة</option>
                <option value="3">عالية</option>
            </select>
        </div>
        <div id="pdfToImagesResult" style="display: none;"><div class="preview-area" id="pdfImagesPreview"></div></div>
        <div class="actions"><button class="btn btn-primary" id="doPdfToImagesBtn">تحويل إلى صور</button></div>
    `;
}

function getPdfProtectHtml() {
    return `
        <div class="upload-area" id="protectPdfUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر PDF للحماية</h3>
            <button class="browse-btn" id="protectPdfBrowseBtn">اختر PDF</button>
            <input type="file" id="protectPdfFile" accept=".pdf" style="display: none;">
        </div>
        <div class="form-group">
            <label>كلمة المرور</label>
            <input type="password" id="pdfPassword" class="form-control" placeholder="أدخل كلمة المرور">
        </div>
        <div class="actions"><button class="btn btn-primary" id="doProtectPdfBtn">حماية PDF</button></div>
    `;
}

function getJsonFormatterHtml() {
    return `
        <div class="form-group"><label>JSON النص</label><textarea id="jsonInput" class="form-control" placeholder='{"name": "example"}' rows="5"></textarea></div>
        <div class="actions">
            <button class="btn btn-primary" id="formatJsonBtn">تنسيق</button>
            <button class="btn btn-info" id="minifyJsonBtn">تصغير</button>
            <button class="btn btn-accent" id="validateJsonBtn">تحقق</button>
        </div>
        <div id="jsonOutput" class="result-box" style="display: none;"><div class="json-pretty" id="formattedJson"></div></div>
        <div id="jsonValidation" style="display: none;"></div>
    `;
}

function getJsonToDartHtml() {
    return `
        <div class="form-group"><label>JSON</label><textarea id="dartJsonInput" class="form-control" placeholder='{"name": "John", "age": 30}' rows="5"></textarea></div>
        <div class="form-group"><label>اسم الـ Class</label><input type="text" id="className" class="form-control" value="MyModel"></div>
        <div class="actions"><button class="btn btn-primary" id="convertToDartBtn">تحويل إلى Dart</button><button class="btn btn-success" id="copyDartCodeBtn">نسخ</button></div>
        <div id="dartOutput" class="result-box" style="display: none;"><pre id="dartCode" style="background: var(--dark); color: var(--light); padding: 1rem; border-radius: 8px; overflow-x: auto;"></pre></div>
    `;
}

function getBase64Html() {
    return `
        <div class="form-group"><label>النص</label><textarea id="base64Text" class="form-control" placeholder="أدخل النص..." rows="3"></textarea></div>
        <div class="actions"><button class="btn btn-primary" id="encodeBase64Btn">تشفير</button><button class="btn btn-info" id="decodeBase64Btn">فك تشفير</button></div>
        <div id="base64Result" class="result-box" style="display: none;"><div class="form-group"><label>النتيجة</label><textarea id="base64Output" class="form-control" rows="3" readonly></textarea><button class="btn btn-success" id="copyBase64Btn" style="margin-top: 0.5rem;">نسخ</button></div></div>
    `;
}

function getPasswordGeneratorHtml() {
    return `
        <div class="form-group"><label>الطول: <span id="passwordLengthValue">12</span></label><input type="range" id="passwordLength" min="6" max="32" value="12"></div>
        <div class="form-group"><label><input type="checkbox" id="useUppercase" checked> أحرف كبيرة</label></div>
        <div class="form-group"><label><input type="checkbox" id="useLowercase" checked> أحرف صغيرة</label></div>
        <div class="form-group"><label><input type="checkbox" id="useNumbers" checked> أرقام</label></div>
        <div class="form-group"><label><input type="checkbox" id="useSymbols" checked> رموز</label></div>
        <div class="actions"><button class="btn btn-primary" id="generatePasswordBtn">إنشاء</button><button class="btn btn-success" id="copyPasswordBtn">نسخ</button></div>
        <div id="passwordResult" class="result-box" style="display: none;"><input type="text" id="generatedPassword" class="form-control" readonly><div id="passwordStrength" style="margin-top: 0.5rem;"></div></div>
    `;
}

function getUuidGeneratorHtml() {
    return `
        <div class="form-group"><label>العدد</label><input type="number" id="uuidCount" class="form-control" value="1" min="1" max="100"></div>
        <div class="actions"><button class="btn btn-primary" id="generateUuidBtn">إنشاء</button><button class="btn btn-success" id="copyUuidBtn">نسخ الكل</button></div>
        <div id="uuidResult" class="result-box" style="display: none;"><pre id="uuidList" style="background: var(--light); padding: 1rem; border-radius: 8px;"></pre></div>
    `;
}

function getColorConverterHtml() {
    return `
        <div class="form-group"><label>اللون (HEX/RGB)</label><input type="text" id="colorInput" class="form-control" placeholder="#FF5733 أو rgb(255,87,51)"></div>
        <div class="actions"><button class="btn btn-primary" id="convertColorBtn">تحويل</button></div>
        <div id="colorResult" class="preview-area" style="display: none;">
            <div id="colorPreview" style="width: 100px; height: 100px; border-radius: 8px; margin: 0 auto;"></div>
            <p><strong>HEX:</strong> <span id="hexResult"></span></p>
            <p><strong>RGB:</strong> <span id="rgbResult"></span></p>
            <p><strong>HSL:</strong> <span id="hslResult"></span></p>
        </div>
    `;
}

function getUrlEncodeHtml() {
    return `
        <div class="form-group"><label>الرابط / النص</label><textarea id="urlInput" class="form-control" placeholder="أدخل الرابط..." rows="3"></textarea></div>
        <div class="actions"><button class="btn btn-primary" id="encodeUrlBtn">تشفير</button><button class="btn btn-info" id="decodeUrlBtn">فك تشفير</button></div>
        <div id="urlResult" class="result-box" style="display: none;"><textarea id="urlOutput" class="form-control" rows="3" readonly></textarea><button class="btn btn-success" id="copyUrlBtn">نسخ</button></div>
    `;
}

function getRegexTesterHtml() {
    return `
        <div class="form-group"><label>النمط (Regex)</label><input type="text" id="regexPattern" class="form-control" placeholder="[a-z]+"></div>
        <div class="form-group"><label>النص المراد اختباره</label><textarea id="regexText" class="form-control" placeholder="أدخل النص..." rows="4"></textarea></div>
        <div class="form-group"><label><input type="checkbox" id="regexGlobal"> البحث العام (global)</label></div>
        <div class="actions"><button class="btn btn-primary" id="testRegexBtn">اختبار</button></div>
        <div id="regexResult" class="result-box" style="display: none;"><pre id="regexMatches" style="background: var(--light); padding: 1rem; border-radius: 8px;"></pre></div>
    `;
}

function getQrGeneratorHtml() {
    return `
        <div class="form-group"><label>نوع المحتوى</label><select id="qrType" class="form-control"><option value="text">نص / رابط</option><option value="wifi">Wi-Fi</option><option value="phone">رقم هاتف</option><option value="vcard">بطاقة اتصال</option></select></div>
        <div id="qrTextInput"><div class="form-group"><label>المحتوى</label><textarea id="qrContent" class="form-control" placeholder="أدخل النص أو الرابط..."></textarea></div></div>
        <div id="qrWifiInput" style="display: none;"><div class="form-group"><label>SSID</label><input type="text" id="wifiSsid" class="form-control"></div><div class="form-group"><label>كلمة المرور</label><input type="text" id="wifiPassword" class="form-control"></div><div class="form-group"><label>نوع الأمان</label><select id="wifiEncryption" class="form-control"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">بدون</option></select></div></div>
        <div id="qrPhoneInput" style="display: none;"><div class="form-group"><label>رقم الهاتف</label><input type="tel" id="phoneNumber" class="form-control"></div></div>
        <div id="qrVcardInput" style="display: none;"><div class="form-group"><label>الاسم</label><input type="text" id="vcardName" class="form-control"></div><div class="form-group"><label>الهاتف</label><input type="text" id="vcardPhone" class="form-control"></div><div class="form-group"><label>البريد</label><input type="email" id="vcardEmail" class="form-control"></div></div>
        <div class="form-group"><label>إضافة شعار</label><input type="file" id="qrLogo" accept="image/*"></div>
        <div class="form-group"><label>الحجم: <span id="qrSizeValue">300</span></label><input type="range" id="qrSize" min="150" max="500" value="300"></div>
        <div class="preview-area" id="qrPreviewArea"><canvas id="qrCanvas" style="max-width: 100%; display: none;"></canvas><div id="qrEmptyMsg">سيظهر الكود هنا</div></div>
        <div class="actions"><button class="btn btn-primary" id="generateQrBtn">إنشاء QR</button></div>
    `;
}

function getQrReaderHtml() {
    return `
        <div class="upload-area" id="qrReaderUploadArea">
            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem;"></i>
            <h3>اختر صورة تحتوي على QR Code</h3>
            <button class="browse-btn" id="qrReaderBrowseBtn">اختر صورة</button>
            <input type="file" id="qrReaderFileInput" accept="image/*" style="display: none;">
        </div>
        <div class="form-group">
            <label>أو استخدم الكاميرا</label>
            <button class="btn btn-info" id="openCameraBtn"><i class="fas fa-camera"></i> فتح الكاميرا</button>
            <video id="cameraVideo" style="width: 100%; max-width: 400px; margin-top: 1rem; display: none;" autoplay playsinline></video>
            <canvas id="cameraCanvas" style="display: none;"></canvas>
        </div>
        <div id="qrReaderResult" class="result-box" style="display: none;">
            <p><strong>المحتوى المقروء:</strong></p>
            <textarea id="qrReadContent" class="form-control" rows="3" readonly></textarea>
            <button class="btn btn-success" id="copyQrResultBtn">نسخ</button>
        </div>
    `;
}

function getBarcodeGeneratorHtml() {
    return `
        <div class="form-group"><label>نوع الباركود</label><select id="barcodeType" class="form-control"><option value="EAN13">EAN-13</option><option value="CODE128">Code 128</option><option value="CODE39">Code 39</option><option value="UPC">UPC</option></select></div>
        <div class="form-group"><label>القيمة</label><input type="text" id="barcodeValue" class="form-control" placeholder="أدخل القيمة"></div>
        <div class="form-group"><label>الارتفاع: <span id="barcodeHeightValue">100</span></label><input type="range" id="barcodeHeight" min="50" max="200" value="100"></div>
        <div class="preview-area barcode-preview" id="barcodePreviewArea"><svg id="barcodeSvg" style="max-width: 100%;"></svg><div id="barcodeEmptyMsg">سيظهر الباركود هنا</div></div>
        <div class="actions"><button class="btn btn-primary" id="generateBarcodeBtn">إنشاء باركود</button></div>
    `;
}

function getProfileDownloaderHtml() {
    return `
        <div class="form-group"><label>المنصة</label><select id="platformSelect" class="form-control"><option value="github">GitHub</option><option value="twitter">Twitter</option><option value="instagram">Instagram</option></select></div>
        <div class="form-group"><label>اسم المستخدم</label><input type="text" id="username" class="form-control" placeholder="أدخل اسم المستخدم"></div>
        <div class="actions"><button class="btn btn-primary" id="fetchProfileBtn">البحث</button></div>
        <div id="profileResult" style="display: none;"><div class="preview-area"><img id="profileImage" style="max-width: 150px; border-radius: 50%;"><div class="actions"><a href="#" class="btn btn-success" id="downloadProfileBtn">تحميل</a></div></div></div>
    `;
}

function getYoutubeThumbnailHtml() {
    return `
        <div class="form-group"><label>رابط يوتيوب</label><input type="text" id="youtubeUrl" class="form-control" placeholder="https://youtube.com/watch?v=..."></div>
        <div class="form-group"><label>الجودة</label><select id="thumbnailQuality" class="form-control"><option value="maxresdefault">عالية (HD)</option><option value="hqdefault">جيدة</option><option value="mqdefault">متوسطة</option><option value="default">عادية</option></select></div>
        <div class="actions"><button class="btn btn-primary" id="getThumbnailBtn">استخراج</button></div>
        <div id="thumbnailResult" style="display: none;"><div class="preview-area"><img id="thumbnailImage" style="max-width: 100%;"><div class="actions"><a href="#" class="btn btn-success" id="downloadThumbnailBtn">تحميل</a></div></div></div>
    `;
}

function getInstagramDownloaderHtml() {
    return `
        <div class="form-group"><label>رابط منشور Instagram</label><input type="text" id="instagramUrl" class="form-control" placeholder="https://www.instagram.com/p/..."></div>
        <div class="info-page" style="padding: 1rem; background: var(--light); border-radius: var(--border-radius); margin-bottom: 1rem;">
            <i class="fas fa-info-circle"></i>
            <p class="text-muted">ملاحظة: هذه الأداة توفر رابط المعاينة فقط. لتحميل المحتوى، استخدم المواقع المتخصصة.</p>
        </div>
        <div class="actions"><button class="btn btn-primary" id="getInstagramBtn">استخراج المعاينة</button></div>
        <div id="instagramResult" style="display: none;"><div class="preview-area" id="instagramPreview"></div></div>
    `;
}

// ========== Tool Initializers ==========
const toolInitializers = {};

// ICO Converter
toolInitializers['image-to-ico'] = function() {
    let currentICOCanvas = null;
    let currentICOFile = null;
    
    const uploadArea = document.getElementById('icoUploadArea');
    const browseBtn = document.getElementById('icoBrowseBtn');
    const fileInput = document.getElementById('icoFileInput');
    const convertBtn = document.getElementById('convertICObtn');
    const fileNameInput = document.getElementById('icoFileName');
    const progress = document.getElementById('icoProgress');
    const fill = progress?.querySelector('.progress-fill');
    
    function handleFile(file) {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('حجم الملف كبير جداً (الحد 5 م.ب)', 'error');
            return;
        }
        currentICOFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                document.getElementById('icoPreviewImg').src = e.target.result;
                document.getElementById('icoPreviewInfo').innerHTML = `${file.name} (${formatFileSize(file.size)})`;
                document.getElementById('icoPreview').style.display = 'block';
                
                const sizes = [16, 32, 48, 64, 128, 256];
                const previewDiv = document.getElementById('sizesPreview');
                previewDiv.innerHTML = '';
                sizes.forEach(size => {
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, size, size);
                    const div = document.createElement('div');
                    div.className = 'size-preview-item';
                    div.innerHTML = `<strong>${size}×${size}</strong><br>`;
                    div.appendChild(canvas);
                    previewDiv.appendChild(div);
                });
                currentICOCanvas = img;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    function canvasToBMP(canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, w, h);
        const pixelData = imgData.data;
        let bmp = [];
        let rowPadding = (4 - ((w * 3) % 4)) % 4;
        
        for (let y = h - 1; y >= 0; y--) {
            for (let x = 0; x < w; x++) {
                let i = (y * w + x) * 4;
                bmp.push(pixelData[i + 2]);
                bmp.push(pixelData[i + 1]);
                bmp.push(pixelData[i + 0]);
            }
            for (let p = 0; p < rowPadding; p++) bmp.push(0);
        }
        return new Uint8Array(bmp);
    }
    
    async function convertToICO() {
        if (!currentICOFile) {
            showToast('الرجاء اختيار صورة أولاً', 'error');
            return;
        }
        
        if (progress) progress.style.display = 'block';
        if (fill) fill.style.width = '20%';
        
        const sizes = [16, 32, 48, 64, 128, 256];
        const img = currentICOCanvas;
        
        let icoParts = [];
        let offset = 6 + (sizes.length * 16);
        
        for (let i = 0; i < sizes.length; i++) {
            const size = sizes[i];
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, size, size);
            
            const bmp = canvasToBMP(canvas);
            icoParts.push({
                width: size,
                height: size,
                size: bmp.length + 40,
                offset: offset,
                bmp: bmp
            });
            offset += bmp.length + 40;
            if (fill) fill.style.width = `${40 + (i / sizes.length) * 50}%`;
        }
        
        let header = new ArrayBuffer(offset);
        let dv = new DataView(header);
        dv.setUint16(0, 0, true);
        dv.setUint16(2, 1, true);
        dv.setUint16(4, icoParts.length, true);
        
        let pos = 6;
        icoParts.forEach(part => {
            dv.setUint8(pos, part.width === 256 ? 0 : part.width);
            dv.setUint8(pos + 1, part.height === 256 ? 0 : part.height);
            dv.setUint8(pos + 2, 0);
            dv.setUint8(pos + 3, 0);
            dv.setUint16(pos + 4, 1, true);
            dv.setUint16(pos + 6, 24, true);
            dv.setUint32(pos + 8, part.size, true);
            dv.setUint32(pos + 12, part.offset, true);
            pos += 16;
        });
        
        icoParts.forEach(part => {
            let dv2 = new DataView(header, part.offset);
            dv2.setUint32(0, 40, true);
            dv2.setInt32(4, part.width, true);
            dv2.setInt32(8, part.height * 2, true);
            dv2.setUint16(12, 1, true);
            dv2.setUint16(14, 24, true);
            dv2.setUint32(20, part.bmp.length, true);
            let bmpData = new Uint8Array(header, part.offset + 40);
            bmpData.set(part.bmp);
        });
        
        if (fill) fill.style.width = '100%';
        setTimeout(() => { if(progress) progress.style.display = 'none'; }, 500);
        
        const blob = new Blob([header], { type: 'image/x-icon' });
        const url = URL.createObjectURL(blob);
        const fileName = fileNameInput.value.trim() || 'icon';
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${fileName}.ico`;
        downloadLink.click();
        URL.revokeObjectURL(url);
        
        addToHistory('تحويل إلى ICO', `${fileName}.ico`);
        showToast('تم تحويل الصورة إلى أيقونة ICO بنجاح!', 'success');
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (convertBtn) convertBtn.addEventListener('click', () => showAdBeforeAction(() => convertToICO()));
    
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleFile(file);
            }
        });
    }
};

// Image Compress
toolInitializers['image-compress'] = function() {
    let originalFile = null;
    let compressedBlob = null;
    
    const uploadArea = document.getElementById('compressUploadArea');
    const browseBtn = document.getElementById('compressBrowseBtn');
    const fileInput = document.getElementById('compressFileInput');
    const qualitySlider = document.getElementById('compressQuality');
    const qualityValue = document.getElementById('qualityValue');
    const compressBtn = document.getElementById('compressBtn');
    
    function handleFile(file) {
        if (!file) return;
        originalFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('originalPreview').src = e.target.result;
            document.getElementById('originalSize').innerHTML = formatFileSize(file.size);
            document.getElementById('compressPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
    
    function compressImage() {
        if (!originalFile) {
            showToast('الرجاء اختيار صورة أولاً', 'error');
            return;
        }
        
        const quality = qualitySlider.value / 100;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                let mimeType = originalFile.type;
                if (mimeType === 'image/heic' || mimeType === 'image/heif') {
                    mimeType = 'image/jpeg';
                }
                
                canvas.toBlob((blob) => {
                    compressedBlob = blob;
                    document.getElementById('compressedPreview').src = URL.createObjectURL(blob);
                    document.getElementById('compressedSize').innerHTML = formatFileSize(blob.size);
                    const ratio = ((1 - blob.size / originalFile.size) * 100).toFixed(1);
                    
                    const downloadLink = document.createElement('a');
                    downloadLink.href = URL.createObjectURL(blob);
                    downloadLink.download = `compressed_${Date.now()}.${originalFile.name.split('.').pop()}`;
                    downloadLink.click();
                    
                    addToHistory('ضغط الصورة', `${ratio}% توفير`);
                    showToast(`تم الضغط بنسبة ${ratio}%`, 'success');
                }, mimeType, quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(originalFile);
    }
    
    if (qualitySlider) qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value;
    });
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (compressBtn) compressBtn.addEventListener('click', () => showAdBeforeAction(() => compressImage()));
};

// HEIC to PNG
toolInitializers['heic-to-png'] = function() {
    const uploadArea = document.getElementById('heicUploadArea');
    const browseBtn = document.getElementById('heicBrowseBtn');
    const fileInput = document.getElementById('heicFileInput');
    const convertBtn = document.getElementById('convertHeicBtn');
    const previewImg = document.getElementById('heicPreviewImg');
    const previewDiv = document.getElementById('heicPreview');
    
    function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            try {
                const blob = new Blob([arrayBuffer], { type: file.type });
                const pngBlob = await heic2any({ blob, toType: 'image/png' });
                const url = URL.createObjectURL(pngBlob);
                previewImg.src = url;
                previewDiv.style.display = 'block';
                
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = file.name.replace(/\.(heic|heif)$/i, '.png');
                downloadLink.click();
                
                addToHistory('HEIC to PNG', file.name);
                showToast('تم تحويل HEIC إلى PNG بنجاح', 'success');
            } catch (err) {
                showToast('فشل التحويل: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (convertBtn) convertBtn.addEventListener('click', () => fileInput.click());
};

// Image Filter
toolInitializers['image-filter'] = function() {
    let currentImage = null;
    const uploadArea = document.getElementById('filterUploadArea');
    const browseBtn = document.getElementById('filterBrowseBtn');
    const fileInput = document.getElementById('filterFileInput');
    const filterSelect = document.getElementById('filterType');
    const applyBtn = document.getElementById('applyFilterBtn');
    const previewImg = document.getElementById('filterPreviewImg');
    const previewDiv = document.getElementById('filterPreview');
    
    function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                previewImg.src = e.target.result;
                previewDiv.style.display = 'block';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    function applyFilter() {
        if (!currentImage) {
            showToast('الرجاء اختيار صورة أولاً', 'error');
            return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = currentImage.width;
        canvas.height = currentImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(currentImage, 0, 0);
        
        const filter = filterSelect.value;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        switch(filter) {
            case 'grayscale':
                for (let i = 0; i < data.length; i += 4) {
                    const gray = (data[i] + data[i+1] + data[i+2]) / 3;
                    data[i] = data[i+1] = data[i+2] = gray;
                }
                break;
            case 'sepia':
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i+1], b = data[i+2];
                    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                    data[i+1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                    data[i+2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                }
                break;
            case 'invert':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i];
                    data[i+1] = 255 - data[i+1];
                    data[i+2] = 255 - data[i+2];
                }
                break;
            case 'brightness':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, data[i] + 50);
                    data[i+1] = Math.min(255, data[i+1] + 50);
                    data[i+2] = Math.min(255, data[i+2] + 50);
                }
                break;
            case 'contrast':
                const factor = (259 * (50 + 255)) / (255 * (259 - 50));
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, factor * (data[i] - 128) + 128);
                    data[i+1] = Math.min(255, factor * (data[i+1] - 128) + 128);
                    data[i+2] = Math.min(255, factor * (data[i+2] - 128) + 128);
                }
                break;
            case 'blur':
                // Simple box blur
                const tempData = data.slice();
                const width = canvas.width;
                for (let y = 1; y < canvas.height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        const idx = (y * width + x) * 4;
                        let r = 0, g = 0, b = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const nidx = ((y + dy) * width + (x + dx)) * 4;
                                r += tempData[nidx];
                                g += tempData[nidx + 1];
                                b += tempData[nidx + 2];
                            }
                        }
                        data[idx] = r / 9;
                        data[idx + 1] = g / 9;
                        data[idx + 2] = b / 9;
                    }
                }
                break;
        }
        
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `filtered_${Date.now()}.png`;
            downloadLink.click();
            addToHistory('فلتر الصور', filter);
            showToast('تم تطبيق الفلتر بنجاح', 'success');
        });
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (applyBtn) applyBtn.addEventListener('click', () => showAdBeforeAction(applyFilter));
};

// Image Convert
toolInitializers['image-convert'] = function() {
    let currentImageFile = null;
    
    const uploadArea = document.getElementById('convertUploadArea');
    const browseBtn = document.getElementById('convertBrowseBtn');
    const fileInput = document.getElementById('convertFileInput');
    const convertBtn = document.getElementById('convertImageBtn');
    const formatSelect = document.getElementById('outputFormat');
    const previewImg = document.getElementById('convertPreviewImg');
    const previewDiv = document.getElementById('convertPreview');
    
    function handleFile(file) {
        if (!file) return;
        currentImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewDiv.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
    
    function convertImage() {
        if (!currentImageFile) {
            showToast('الرجاء اختيار صورة أولاً', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                const mimeType = formatSelect.value;
                const extension = mimeType.split('/')[1];
                
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const downloadLink = document.createElement('a');
                    downloadLink.href = url;
                    downloadLink.download = `converted_${Date.now()}.${extension}`;
                    downloadLink.click();
                    URL.revokeObjectURL(url);
                    addToHistory('تحويل الصورة', `to ${extension}`);
                    showToast(`تم تحويل الصورة إلى ${extension.toUpperCase()}`, 'success');
                }, mimeType);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(currentImageFile);
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (convertBtn) convertBtn.addEventListener('click', () => showAdBeforeAction(() => convertImage()));
};

// Remove Background
toolInitializers['remove-bg'] = function() {
    let originalImage = null;
    
    const uploadArea = document.getElementById('removeBgUploadArea');
    const browseBtn = document.getElementById('removeBgBrowseBtn');
    const fileInput = document.getElementById('removeBgFileInput');
    const removeBtn = document.getElementById('removeBgBtn');
    const thresholdSlider = document.getElementById('bgThreshold');
    const thresholdValue = document.getElementById('thresholdValue');
    
    function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage = e.target.result;
            document.getElementById('originalBgImg').src = originalImage;
            document.getElementById('removeBgPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
    
    function removeBackground() {
        if (!originalImage) {
            showToast('الرجاء اختيار صورة أولاً', 'error');
            return;
        }
        
        const threshold = parseInt(thresholdSlider.value);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Get background color from top-left corner
            const bgR = data[0];
            const bgG = data[1];
            const bgB = data[2];
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
                if (diff < threshold) {
                    data[i+3] = 0;
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                document.getElementById('removedBgImg').src = url;
                
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = `nobg_${Date.now()}.png`;
                downloadLink.click();
                URL.revokeObjectURL(url);
                addToHistory('إزالة الخلفية', '');
                showToast('تمت إزالة الخلفية بنجاح', 'success');
            }, 'image/png');
        };
        img.src = originalImage;
    }
    
    if (thresholdSlider) thresholdSlider.addEventListener('input', () => {
        thresholdValue.textContent = thresholdSlider.value;
    });
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (removeBtn) removeBtn.addEventListener('click', () => showAdBeforeAction(() => removeBackground()));
};

// Resize Image
toolInitializers['resize-image'] = function() {
    let originalImage = null;
    let originalWidth = 0, originalHeight = 0;
    
    const uploadArea = document.getElementById('resizeUploadArea');
    const browseBtn = document.getElementById('resizeBrowseBtn');
    const fileInput = document.getElementById('resizeFileInput');
    const resizeBtn = document.getElementById('resizeBtn');
    const widthInput = document.getElementById('resizeWidth');
    const heightInput = document.getElementById('resizeHeight');
    const keepAspect = document.getElementById('keepAspect');
    const previewImg = document.getElementById('resizePreviewImg');
    const previewDiv = document.getElementById('resizePreview');
    const resizeInfo = document.getElementById('resizeInfo');
    
    function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                originalWidth = img.width;
                originalHeight = img.height;
                originalImage = img;
                previewImg.src = e.target.result;
                resizeInfo.innerHTML = `الأبعاد الأصلية: ${originalWidth}×${originalHeight}`;
                previewDiv.style.display = 'block';
                widthInput.value = originalWidth;
                heightInput.value = originalHeight;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    function updateDimensions() {
        if (!keepAspect.checked || !originalWidth) return;
        const newWidth = parseInt(widthInput.value);
        if (!isNaN(newWidth) && newWidth > 0) {
            const ratio = originalHeight / originalWidth;
            heightInput.value = Math.round(newWidth * ratio);
        }
    }
    
    function resizeImage() {
        if (!originalImage) {
            showToast('الرجاء اختيار صورة أولاً', 'error');
            return;
        }
        
        let newWidth = parseInt(widthInput.value);
        let newHeight = parseInt(heightInput.value);
        
        if (isNaN(newWidth) || newWidth <= 0) newWidth = originalImage.width;
        if (isNaN(newHeight) || newHeight <= 0) newHeight = originalImage.height;
        
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(originalImage, 0, 0, newWidth, newHeight);
        
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `resized_${Date.now()}.png`;
            downloadLink.click();
            URL.revokeObjectURL(url);
            addToHistory('تغيير الحجم', `${newWidth}×${newHeight}`);
            showToast(`تم تغيير الحجم إلى ${newWidth}×${newHeight}`, 'success');
        }, 'image/png');
    }
    
    if (widthInput) widthInput.addEventListener('input', updateDimensions);
    if (heightInput) heightInput.addEventListener('input', () => {
        if (keepAspect.checked && originalWidth) {
            const newHeight = parseInt(heightInput.value);
            if (!isNaN(newHeight) && newHeight > 0) {
                const ratio = originalWidth / originalHeight;
                widthInput.value = Math.round(newHeight * ratio);
            }
        }
    });
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (resizeBtn) resizeBtn.addEventListener('click', () => showAdBeforeAction(() => resizeImage()));
};

// Crop Image
toolInitializers['crop-image'] = function() {
    let cropperInstance = null;
    
    const uploadArea = document.getElementById('cropUploadArea');
    const browseBtn = document.getElementById('cropBrowseBtn');
    const fileInput = document.getElementById('cropFileInput');
    const cropBtn = document.getElementById('cropBtn');
    const aspectSelect = document.getElementById('aspectRatio');
    const cropImage = document.getElementById('cropImage');
    const container = document.getElementById('cropContainer');
    
    function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            cropImage.src = e.target.result;
            container.style.display = 'block';
            if (cropperInstance) cropperInstance.destroy();
            cropperInstance = new Cropper(cropImage, {
                aspectRatio: parseFloat(aspectSelect.value) || NaN,
                viewMode: 1,
                autoCropArea: 0.8,
            });
        };
        reader.readAsDataURL(file);
    }
    
    if (aspectSelect) aspectSelect.addEventListener('change', () => {
        if (cropperInstance) {
            const ratio = parseFloat(aspectSelect.value);
            cropperInstance.setAspectRatio(ratio || NaN);
        }
    });
    
    function crop() {
        if (!cropperInstance) {
            showToast('الرجاء اختيار صورة أولاً', 'error');
            return;
        }
        const canvas = cropperInstance.getCroppedCanvas();
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `cropped_${Date.now()}.png`;
            downloadLink.click();
            URL.revokeObjectURL(url);
            addToHistory('قص الصورة', '');
            showToast('تم قص الصورة بنجاح', 'success');
        });
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (cropBtn) cropBtn.addEventListener('click', () => showAdBeforeAction(() => crop()));
};

// Watermark
toolInitializers['watermark'] = function() {
    let originalImage = null;
    let watermarkImage = null;
    
    const uploadArea = document.getElementById('watermarkUploadArea');
    const browseBtn = document.getElementById('watermarkBrowseBtn');
    const fileInput = document.getElementById('watermarkFileInput');
    const applyBtn = document.getElementById('applyWatermarkBtn');
    const typeSelect = document.getElementById('watermarkType');
    const textOptions = document.getElementById('watermarkTextOptions');
    const imageOptions = document.getElementById('watermarkImageOptions');
    const opacitySlider = document.getElementById('watermarkOpacity');
    const opacityValue = document.getElementById('watermarkOpacityValue');
    const previewImg = document.getElementById('watermarkPreviewImg');
    const previewDiv = document.getElementById('watermarkPreview');
    
    if (typeSelect) typeSelect.addEventListener('change', () => {
        if (textOptions) textOptions.style.display = typeSelect.value === 'text' ? 'block' : 'none';
        if (imageOptions) imageOptions.style.display = typeSelect.value === 'image' ? 'block' : 'none';
    });
    
    if (opacitySlider && opacityValue) opacitySlider.addEventListener('input', () => {
        opacityValue.textContent = opacitySlider.value;
    });
    
    function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                originalImage = img;
                previewImg.src = e.target.result;
                previewDiv.style.display = 'block';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    const watermarkImageUpload = document.getElementById('watermarkImageUploadArea');
    const watermarkImageBrowse = document.getElementById('watermarkImageBrowseBtn');
    const watermarkImageFile = document.getElementById('watermarkImageFile');
    
    if (watermarkImageUpload) watermarkImageUpload.addEventListener('click', () => watermarkImageFile.click());
    if (watermarkImageBrowse) watermarkImageBrowse.addEventListener('click', () => watermarkImageFile.click());
    if (watermarkImageFile) watermarkImageFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => { watermarkImage = img; };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    
    function applyWatermark() {
        if (!originalImage) {
            showToast('الرجاء اختيار صورة أولاً', 'error');
            return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(originalImage, 0, 0);
        
        const opacity = opacitySlider.value / 100;
        ctx.globalAlpha = opacity;
        
        if (typeSelect.value === 'text') {
            const text = document.getElementById('watermarkText').value;
            const color = document.getElementById('watermarkColor').value;
            ctx.font = `${Math.min(originalImage.width / 10, 50)}px Tajawal`;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        } else if (watermarkImage) {
            const size = Math.min(originalImage.width / 4, 150);
            const x = (canvas.width - size) / 2;
            const y = (canvas.height - size) / 2;
            ctx.drawImage(watermarkImage, x, y, size, size);
        }
        
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `watermarked_${Date.now()}.png`;
            downloadLink.click();
            URL.revokeObjectURL(url);
            addToHistory('علامة مائية', typeSelect.value);
            showToast('تمت إضافة العلامة المائية بنجاح', 'success');
        }, 'image/png');
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (applyBtn) applyBtn.addEventListener('click', () => showAdBeforeAction(() => applyWatermark()));
};

// Images to PDF
toolInitializers['images-to-pdf'] = function() {
    let images = [];
    const uploadArea = document.getElementById('pdfUploadArea');
    const browseBtn = document.getElementById('pdfBrowseBtn');
    const fileInput = document.getElementById('pdfFilesInput');
    const createBtn = document.getElementById('createPdfBtn');
    const imageList = document.getElementById('imageList');
    
    function handleFiles(files) {
        images = [];
        imageList.innerHTML = '';
        Array.from(files).forEach((file, index) => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    images.push({ name: file.name, data: e.target.result });
                    const div = document.createElement('div');
                    div.innerHTML = `<img src="${e.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;"><br><small>${file.name}</small>`;
                    imageList.appendChild(div);
                };
                reader.readAsDataURL(file);
            }
        });
        document.getElementById('pdfImagesPreview').style.display = 'block';
    }
    
    async function createPdf() {
        if (images.length === 0) {
            showToast('الرجاء اختيار صور أولاً', 'error');
            return;
        }
        
        showLoading(true);
        const { PDFDocument, rgb } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        const pageSize = document.getElementById('pdfPageSize').value;
        
        for (const image of images) {
            let img;
            if (image.data.includes('data:image/png')) {
                img = await pdfDoc.embedPng(image.data);
            } else {
                img = await pdfDoc.embedJpg(image.data);
            }
            
            const imgDims = img.scale(1);
            let page;
            if (pageSize === 'a4') {
                page = pdfDoc.addPage([595, 842]);
            } else if (pageSize === 'letter') {
                page = pdfDoc.addPage([612, 792]);
            } else {
                page = pdfDoc.addPage([imgDims.width, imgDims.height]);
            }
            
            const pageWidth = page.getWidth();
            const pageHeight = page.getHeight();
            const scale = Math.min(pageWidth / imgDims.width, pageHeight / imgDims.height);
            const width = imgDims.width * scale;
            const height = imgDims.height * scale;
            const x = (pageWidth - width) / 2;
            const y = (pageHeight - height) / 2;
            
            page.drawImage(img, { x, y, width, height });
        }
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `images_${Date.now()}.pdf`;
        downloadLink.click();
        URL.revokeObjectURL(url);
        showLoading(false);
        addToHistory('صور إلى PDF', `${images.length} صورة`);
        showToast('تم إنشاء PDF بنجاح', 'success');
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    if (createBtn) createBtn.addEventListener('click', () => showAdBeforeAction(() => createPdf()));
};

// Merge PDF
toolInitializers['merge-pdf'] = function() {
    let pdfFiles = [];
    const uploadArea = document.getElementById('mergePdfUploadArea');
    const browseBtn = document.getElementById('mergePdfBrowseBtn');
    const fileInput = document.getElementById('mergePdfFiles');
    const mergeBtn = document.getElementById('doMergePdfBtn');
    const fileList = document.getElementById('pdfFileList');
    
    async function handleFiles(files) {
        pdfFiles = [];
        fileList.innerHTML = '';
        for (const file of files) {
            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                pdfFiles.push({ name: file.name, data: arrayBuffer });
                const div = document.createElement('div');
                div.innerHTML = `<i class="fas fa-file-pdf"></i> ${file.name} (${formatFileSize(file.size)})`;
                div.style.padding = '5px';
                div.style.borderBottom = '1px solid var(--gray-light)';
                fileList.appendChild(div);
            }
        }
        document.getElementById('mergePdfList').style.display = 'block';
    }
    
    async function mergePdfs() {
        if (pdfFiles.length < 2) {
            showToast('الرجاء اختيار ملفين PDF على الأقل للدمج', 'error');
            return;
        }
        
        showLoading(true);
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();
        
        for (const pdfFile of pdfFiles) {
            const pdf = await PDFDocument.load(pdfFile.data);
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
        }
        
        const pdfBytes = await mergedPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `merged_${Date.now()}.pdf`;
        downloadLink.click();
        URL.revokeObjectURL(url);
        showLoading(false);
        addToHistory('دمج PDF', `${pdfFiles.length} ملف`);
        showToast('تم دمج ملفات PDF بنجاح', 'success');
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    if (mergeBtn) mergeBtn.addEventListener('click', () => showAdBeforeAction(() => mergePdfs()));
};

// Split PDF
toolInitializers['split-pdf'] = function() {
    let pdfFile = null;
    const uploadArea = document.getElementById('splitPdfUploadArea');
    const browseBtn = document.getElementById('splitPdfBrowseBtn');
    const fileInput = document.getElementById('splitPdfFile');
    const splitBtn = document.getElementById('doSplitPdfBtn');
    const resultDiv = document.getElementById('splitResult');
    const pagesList = document.getElementById('splitPagesList');
    
    function handleFile(file) {
        if (!file) return;
        pdfFile = file;
        showToast('تم اختيار ملف PDF', 'info');
    }
    
    async function splitPdf() {
        if (!pdfFile) {
            showToast('الرجاء اختيار ملف PDF أولاً', 'error');
            return;
        }
        
        showLoading(true);
        const arrayBuffer = await pdfFile.arrayBuffer();
        const { PDFDocument } = PDFLib;
        const sourcePdf = await PDFDocument.load(arrayBuffer);
        const pageCount = sourcePdf.getPageCount();
        
        pagesList.innerHTML = '';
        const zip = new JSZip();
        
        for (let i = 0; i < pageCount; i++) {
            const newPdf = await PDFDocument.create();
            const [page] = await newPdf.copyPages(sourcePdf, [i]);
            newPdf.addPage(page);
            const pdfBytes = await newPdf.save();
            zip.file(`page_${i + 1}.pdf`, pdfBytes);
            
            const div = document.createElement('div');
            div.innerHTML = `<i class="fas fa-file-pdf"></i> الصفحة ${i + 1}`;
            div.style.padding = '5px';
            pagesList.appendChild(div);
        }
        
        resultDiv.style.display = 'block';
        
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `pdf_pages_${Date.now()}.zip`;
        downloadLink.click();
        URL.revokeObjectURL(url);
        
        showLoading(false);
        addToHistory('تقسيم PDF', `${pageCount} صفحة`);
        showToast(`تم تقسيم PDF إلى ${pageCount} صفحة`, 'success');
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (splitBtn) splitBtn.addEventListener('click', () => showAdBeforeAction(() => splitPdf()));
};

// Compress PDF
toolInitializers['compress-pdf'] = function() {
    let pdfFile = null;
    const uploadArea = document.getElementById('compressPdfUploadArea');
    const browseBtn = document.getElementById('compressPdfBrowseBtn');
    const fileInput = document.getElementById('compressPdfFile');
    const compressBtn = document.getElementById('doCompressPdfBtn');
    const qualitySlider = document.getElementById('pdfCompressQuality');
    const qualityValue = document.getElementById('pdfQualityValue');
    const resultDiv = document.getElementById('compressPdfResult');
    
    if (qualitySlider) qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value;
    });
    
    function handleFile(file) {
        if (!file) return;
        pdfFile = file;
        document.getElementById('originalPdfSize').innerHTML = formatFileSize(file.size);
        resultDiv.style.display = 'block';
    }
    
    async function compressPdf() {
        if (!pdfFile) {
            showToast('الرجاء اختيار ملف PDF أولاً', 'error');
            return;
        }
        
        showLoading(true);
        const quality = parseInt(qualitySlider.value) / 100;
        const arrayBuffer = await pdfFile.arrayBuffer();
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Re-save with compression
        const pdfBytes = await pdfDoc.save();
        const compressedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        document.getElementById('compressedPdfSize').innerHTML = formatFileSize(compressedBlob.size);
        const ratio = ((1 - compressedBlob.size / pdfFile.size) * 100).toFixed(1);
        document.getElementById('saveRatio').innerHTML = ratio;
        
        const url = URL.createObjectURL(compressedBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `compressed_${pdfFile.name}`;
        downloadLink.click();
        URL.revokeObjectURL(url);
        
        showLoading(false);
        addToHistory('ضغط PDF', `${ratio}% توفير`);
        showToast(`تم ضغط PDF بنسبة ${ratio}%`, 'success');
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (compressBtn) compressBtn.addEventListener('click', () => showAdBeforeAction(() => compressPdf()));
};

// PDF to Images
toolInitializers['pdf-to-images'] = function() {
    let pdfFile = null;
    const uploadArea = document.getElementById('pdfToImagesUploadArea');
    const browseBtn = document.getElementById('pdfToImagesBrowseBtn');
    const fileInput = document.getElementById('pdfToImagesFile');
    const convertBtn = document.getElementById('doPdfToImagesBtn');
    const previewDiv = document.getElementById('pdfImagesPreview');
    
    function handleFile(file) {
        if (!file) return;
        pdfFile = file;
        showToast('تم اختيار ملف PDF', 'info');
    }
    
    async function convertPdfToImages() {
        if (!pdfFile) {
            showToast('الرجاء اختيار ملف PDF أولاً', 'error');
            return;
        }
        
        showLoading(true);
        const quality = parseInt(document.getElementById('pdfImageQuality').value);
        const scale = quality === 1 ? 1 : quality === 2 ? 1.5 : 2;
        
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        previewDiv.innerHTML = '';
        const zip = new JSZip();
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: scale });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            zip.file(`page_${i + 1}.png`, blob);
            
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            img.style.maxWidth = '100px';
            img.style.margin = '5px';
            previewDiv.appendChild(img);
        }
        
        document.getElementById('pdfToImagesResult').style.display = 'block';
        
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `pdf_images_${Date.now()}.zip`;
        downloadLink.click();
        URL.revokeObjectURL(url);
        
        showLoading(false);
        addToHistory('PDF إلى صور', `${pdf.numPages} صفحة`);
        showToast(`تم تحويل ${pdf.numPages} صفحة إلى صور`, 'success');
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (convertBtn) convertBtn.addEventListener('click', () => showAdBeforeAction(() => convertPdfToImages()));
};

// PDF Protect
toolInitializers['pdf-protect'] = function() {
    let pdfFile = null;
    const uploadArea = document.getElementById('protectPdfUploadArea');
    const browseBtn = document.getElementById('protectPdfBrowseBtn');
    const fileInput = document.getElementById('protectPdfFile');
    const protectBtn = document.getElementById('doProtectPdfBtn');
    const passwordInput = document.getElementById('pdfPassword');
    
    function handleFile(file) {
        if (!file) return;
        pdfFile = file;
        showToast('تم اختيار ملف PDF', 'info');
    }
    
    async function protectPdf() {
        const password = passwordInput.value;
        if (!password) {
            showToast('الرجاء إدخال كلمة المرور', 'error');
            return;
        }
        if (!pdfFile) {
            showToast('الرجاء اختيار ملف PDF أولاً', 'error');
            return;
        }
        
        showLoading(true);
        const arrayBuffer = await pdfFile.arrayBuffer();
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        await pdfDoc.encrypt({
            userPassword: password,
            ownerPassword: password,
            permissions: { printing: 'highResolution', modifying: false, copying: false }
        });
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `protected_${pdfFile.name}`;
        downloadLink.click();
        URL.revokeObjectURL(url);
        
        showLoading(false);
        addToHistory('حماية PDF', 'بكلمة مرور');
        showToast('تم حماية PDF بنجاح', 'success');
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (protectBtn) protectBtn.addEventListener('click', () => showAdBeforeAction(() => protectPdf()));
};

// JSON Formatter
toolInitializers['json-formatter'] = function() {
    const input = document.getElementById('jsonInput');
    const formatBtn = document.getElementById('formatJsonBtn');
    const minifyBtn = document.getElementById('minifyJsonBtn');
    const validateBtn = document.getElementById('validateJsonBtn');
    const outputDiv = document.getElementById('jsonOutput');
    const formattedJson = document.getElementById('formattedJson');
    const validationDiv = document.getElementById('jsonValidation');
    
    function validateAndGetJson() {
        try {
            const json = JSON.parse(input.value);
            return { valid: true, json: json };
        } catch (e) {
            validationDiv.style.display = 'block';
            validationDiv.innerHTML = `<div style="color: var(--danger);">خطأ: ${e.message}</div>`;
            outputDiv.style.display = 'none';
            return { valid: false };
        }
    }
    
    function formatJson() {
        const result = validateAndGetJson();
        if (result.valid) {
            validationDiv.style.display = 'none';
            formattedJson.innerHTML = JSON.stringify(result.json, null, 2);
            outputDiv.style.display = 'block';
            addToHistory('تنسيق JSON', '');
            showToast('تم تنسيق JSON بنجاح', 'success');
        }
    }
    
    function minifyJson() {
        const result = validateAndGetJson();
        if (result.valid) {
            validationDiv.style.display = 'none';
            formattedJson.innerHTML = JSON.stringify(result.json);
            outputDiv.style.display = 'block';
            addToHistory('تصغير JSON', '');
            showToast('تم تصغير JSON بنجاح', 'success');
        }
    }
    
    function validateJson() {
        const result = validateAndGetJson();
        if (result.valid) {
            validationDiv.innerHTML = `<div style="color: var(--success);">✓ JSON صحيح</div>`;
            validationDiv.style.display = 'block';
            showToast('JSON صحيح', 'success');
        }
    }
    
    if (formatBtn) formatBtn.addEventListener('click', () => showAdBeforeAction(formatJson));
    if (minifyBtn) minifyBtn.addEventListener('click', () => showAdBeforeAction(minifyJson));
    if (validateBtn) validateBtn.addEventListener('click', () => showAdBeforeAction(validateJson));
};

// JSON to Dart
toolInitializers['json-to-dart'] = function() {
    const input = document.getElementById('dartJsonInput');
    const classNameInput = document.getElementById('className');
    const convertBtn = document.getElementById('convertToDartBtn');
    const copyBtn = document.getElementById('copyDartCodeBtn');
    const outputDiv = document.getElementById('dartOutput');
    const dartCode = document.getElementById('dartCode');
    
    function jsonToDart(json, className) {
        let code = `class ${className} {\n`;
        const obj = typeof json === 'string' ? JSON.parse(json) : json;
        
        for (const [key, value] of Object.entries(obj)) {
            let type = 'dynamic';
            if (typeof value === 'string') type = 'String?';
            else if (typeof value === 'number') type = 'num?';
            else if (typeof value === 'boolean') type = 'bool?';
            else if (Array.isArray(value)) type = 'List<dynamic>?';
            else if (typeof value === 'object' && value !== null) type = 'Map<String, dynamic>?';
            
            code += `  ${type} ${key};\n`;
        }
        
        code += `\n  ${className}({`;
        for (const key of Object.keys(obj)) {
            code += ` this.${key},`;
        }
        code += `});\n\n`;
        
        code += `  factory ${className}.fromJson(Map<String, dynamic> json) {\n`;
        code += `    return ${className}(\n`;
        for (const key of Object.keys(obj)) {
            code += `      ${key}: json['${key}'],\n`;
        }
        code += `    );\n  }\n\n`;
        
        code += `  Map<String, dynamic> toJson() {\n`;
        code += `    return {\n`;
        for (const key of Object.keys(obj)) {
            code += `      '${key}': ${key},\n`;
        }
        code += `    };\n  }\n`;
        code += `}\n`;
        
        return code;
    }
    
    function convertToDart() {
        try {
            const json = JSON.parse(input.value);
            const className = classNameInput.value.trim() || 'MyModel';
            const dartCodeStr = jsonToDart(json, className);
            dartCode.textContent = dartCodeStr;
            outputDiv.style.display = 'block';
            addToHistory('JSON to Dart', className);
            showToast('تم تحويل JSON إلى Dart Model', 'success');
        } catch (e) {
            showToast('JSON غير صالح: ' + e.message, 'error');
        }
    }
    
    if (convertBtn) convertBtn.addEventListener('click', () => showAdBeforeAction(convertToDart));
    if (copyBtn) copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(dartCode.textContent);
        showToast('تم نسخ الكود', 'success');
    });
};

// Base64
toolInitializers['base64'] = function() {
    const input = document.getElementById('base64Text');
    const encodeBtn = document.getElementById('encodeBase64Btn');
    const decodeBtn = document.getElementById('decodeBase64Btn');
    const output = document.getElementById('base64Output');
    const resultDiv = document.getElementById('base64Result');
    const copyBtn = document.getElementById('copyBase64Btn');
    
    function encode() {
        const encoded = btoa(unescape(encodeURIComponent(input.value)));
        output.value = encoded;
        resultDiv.style.display = 'block';
        addToHistory('Base64 تشفير', '');
        showToast('تم التشفير بنجاح', 'success');
    }
    
    function decode() {
        try {
            const decoded = decodeURIComponent(escape(atob(input.value)));
            output.value = decoded;
            resultDiv.style.display = 'block';
            addToHistory('Base64 فك تشفير', '');
            showToast('تم فك التشفير بنجاح', 'success');
        } catch (e) {
            showToast('النص غير صالح لفك التشفير', 'error');
        }
    }
    
    if (encodeBtn) encodeBtn.addEventListener('click', () => showAdBeforeAction(encode));
    if (decodeBtn) decodeBtn.addEventListener('click', () => showAdBeforeAction(decode));
    if (copyBtn) copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(output.value);
        showToast('تم النسخ', 'success');
    });
};

// Password Generator
toolInitializers['password-generator'] = function() {
    const lengthSlider = document.getElementById('passwordLength');
    const lengthValue = document.getElementById('passwordLengthValue');
    const uppercaseCheck = document.getElementById('useUppercase');
    const lowercaseCheck = document.getElementById('useLowercase');
    const numbersCheck = document.getElementById('useNumbers');
    const symbolsCheck = document.getElementById('useSymbols');
    const generateBtn = document.getElementById('generatePasswordBtn');
    const copyBtn = document.getElementById('copyPasswordBtn');
    const resultDiv = document.getElementById('passwordResult');
    const passwordInput = document.getElementById('generatedPassword');
    const strengthDiv = document.getElementById('passwordStrength');
    
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    function generatePassword() {
        let chars = '';
        if (uppercaseCheck.checked) chars += uppercase;
        if (lowercaseCheck.checked) chars += lowercase;
        if (numbersCheck.checked) chars += numbers;
        if (symbolsCheck.checked) chars += symbols;
        
        if (chars === '') {
            showToast('الرجاء اختيار نوع واحد على الأقل', 'error');
            return '';
        }
        
        const length = parseInt(lengthSlider.value);
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars[Math.floor(Math.random() * chars.length)];
        }
        return password;
    }
    
    function checkStrength(password) {
        let strength = 0;
        if (password.length >= 12) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        if (strength <= 2) return { text: 'ضعيفة', color: 'var(--danger)' };
        if (strength <= 3) return { text: 'متوسطة', color: 'var(--warning)' };
        return { text: 'قوية جداً', color: 'var(--success)' };
    }
    
    function generateAndDisplay() {
        const password = generatePassword();
        if (password) {
            passwordInput.value = password;
            const strength = checkStrength(password);
            strengthDiv.innerHTML = `القوة: <span style="color: ${strength.color}">${strength.text}</span>`;
            resultDiv.style.display = 'block';
            addToHistory('كلمة مرور', `${password.length} حرف`);
            showToast('تم إنشاء كلمة مرور جديدة', 'success');
        }
    }
    
    if (generateBtn) generateBtn.addEventListener('click', () => showAdBeforeAction(generateAndDisplay));
    if (copyBtn) copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(passwordInput.value);
        showToast('تم نسخ كلمة المرور', 'success');
    });
    
    if (lengthSlider) lengthSlider.addEventListener('input', () => {
        lengthValue.textContent = lengthSlider.value;
    });
};

// UUID Generator
toolInitializers['uuid-generator'] = function() {
    const countInput = document.getElementById('uuidCount');
    const generateBtn = document.getElementById('generateUuidBtn');
    const copyBtn = document.getElementById('copyUuidBtn');
    const resultDiv = document.getElementById('uuidResult');
    const uuidList = document.getElementById('uuidList');
    
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    function generate() {
        const count = parseInt(countInput.value) || 1;
        let uuids = [];
        for (let i = 0; i < count; i++) {
            uuids.push(generateUUID());
        }
        uuidList.textContent = uuids.join('\n');
        resultDiv.style.display = 'block';
        addToHistory('UUID', `${count} معرف`);
        showToast(`تم إنشاء ${count} UUID`, 'success');
    }
    
    if (generateBtn) generateBtn.addEventListener('click', () => showAdBeforeAction(generate));
    if (copyBtn) copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(uuidList.textContent);
        showToast('تم نسخ جميع UUIDs', 'success');
    });
};

// Color Converter
toolInitializers['color-converter'] = function() {
    const input = document.getElementById('colorInput');
    const convertBtn = document.getElementById('convertColorBtn');
    const resultDiv = document.getElementById('colorResult');
    const preview = document.getElementById('colorPreview');
    const hexSpan = document.getElementById('hexResult');
    const rgbSpan = document.getElementById('rgbResult');
    const hslSpan = document.getElementById('hslResult');
    
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    function rgbToHex(r, g, b) {
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }
    
    function convertColor() {
        let color = input.value.trim();
        let r, g, b;
        
        if (color.startsWith('#')) {
            const rgb = hexToRgb(color);
            if (rgb) {
                r = rgb.r;
                g = rgb.g;
                b = rgb.b;
            }
        } else if (color.startsWith('rgb')) {
            const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
                r = parseInt(match[1]);
                g = parseInt(match[2]);
                b = parseInt(match[3]);
            }
        }
        
        if (r !== undefined) {
            const hex = rgbToHex(r, g, b);
            const hsl = rgbToHsl(r, g, b);
            preview.style.backgroundColor = hex;
            hexSpan.textContent = hex;
            rgbSpan.textContent = `rgb(${r}, ${g}, ${b})`;
            hslSpan.textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
            resultDiv.style.display = 'block';
            addToHistory('محول الألوان', hex);
            showToast('تم تحويل اللون بنجاح', 'success');
        } else {
            showToast('صيغة لون غير صالحة', 'error');
        }
    }
    
    if (convertBtn) convertBtn.addEventListener('click', () => showAdBeforeAction(convertColor));
};

// URL Encode/Decode
toolInitializers['url-encode'] = function() {
    const input = document.getElementById('urlInput');
    const encodeBtn = document.getElementById('encodeUrlBtn');
    const decodeBtn = document.getElementById('decodeUrlBtn');
    const output = document.getElementById('urlOutput');
    const resultDiv = document.getElementById('urlResult');
    const copyBtn = document.getElementById('copyUrlBtn');
    
    function encodeUrl() {
        const encoded = encodeURIComponent(input.value);
        output.value = encoded;
        resultDiv.style.display = 'block';
        addToHistory('تشفير URL', '');
        showToast('تم التشفير بنجاح', 'success');
    }
    
    function decodeUrl() {
        try {
            const decoded = decodeURIComponent(input.value);
            output.value = decoded;
            resultDiv.style.display = 'block';
            addToHistory('فك تشفير URL', '');
            showToast('تم فك التشفير بنجاح', 'success');
        } catch (e) {
            showToast('الرابط غير صالح', 'error');
        }
    }
    
    if (encodeBtn) encodeBtn.addEventListener('click', () => showAdBeforeAction(encodeUrl));
    if (decodeBtn) decodeBtn.addEventListener('click', () => showAdBeforeAction(decodeUrl));
    if (copyBtn) copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(output.value);
        showToast('تم النسخ', 'success');
    });
};

// Regex Tester
toolInitializers['regex-tester'] = function() {
    const patternInput = document.getElementById('regexPattern');
    const textInput = document.getElementById('regexText');
    const globalCheck = document.getElementById('regexGlobal');
    const testBtn = document.getElementById('testRegexBtn');
    const resultDiv = document.getElementById('regexResult');
    const matchesPre = document.getElementById('regexMatches');
    
    function testRegex() {
        const pattern = patternInput.value;
        const text = textInput.value;
        if (!pattern) {
            showToast('الرجاء إدخال النمط', 'error');
            return;
        }
        
        try {
            const flags = globalCheck.checked ? 'g' : '';
            const regex = new RegExp(pattern, flags);
            const matches = text.match(regex);
            
            if (matches && matches.length > 0) {
                matchesPre.innerHTML = `عدد التطابقات: ${matches.length}\n\n${matches.join('\n')}`;
            } else {
                matchesPre.innerHTML = 'لا توجد تطابقات';
            }
            resultDiv.style.display = 'block';
            addToHistory('اختبار Regex', pattern);
            showToast('تم اختبار النمط', 'success');
        } catch (e) {
            showToast('خطأ في النمط: ' + e.message, 'error');
        }
    }
    
    if (testBtn) testBtn.addEventListener('click', () => showAdBeforeAction(testRegex));
};

// QR Generator
toolInitializers['qr-generator'] = function() {
    let currentCanvas = null;
    
    const qrType = document.getElementById('qrType');
    const textInput = document.getElementById('qrTextInput');
    const wifiInput = document.getElementById('qrWifiInput');
    const phoneInput = document.getElementById('qrPhoneInput');
    const vcardInput = document.getElementById('qrVcardInput');
    const contentTextarea = document.getElementById('qrContent');
    const generateBtn = document.getElementById('generateQrBtn');
    const sizeSlider = document.getElementById('qrSize');
    const sizeValue = document.getElementById('qrSizeValue');
    
    if (qrType) qrType.addEventListener('change', () => {
        if (textInput) textInput.style.display = 'none';
        if (wifiInput) wifiInput.style.display = 'none';
        if (phoneInput) phoneInput.style.display = 'none';
        if (vcardInput) vcardInput.style.display = 'none';
        
        switch(qrType.value) {
            case 'text': if(textInput) textInput.style.display = 'block'; break;
            case 'wifi': if(wifiInput) wifiInput.style.display = 'block'; break;
            case 'phone': if(phoneInput) phoneInput.style.display = 'block'; break;
            case 'vcard': if(vcardInput) vcardInput.style.display = 'block'; break;
        }
    });
    
    function getQrContent() {
        switch(qrType.value) {
            case 'text':
                return contentTextarea.value;
            case 'wifi':
                const ssid = document.getElementById('wifiSsid')?.value || '';
                const password = document.getElementById('wifiPassword')?.value || '';
                const encryption = document.getElementById('wifiEncryption')?.value || 'WPA';
                return `WIFI:T:${encryption};S:${ssid};P:${password};;`;
            case 'phone':
                const phone = document.getElementById('phoneNumber')?.value || '';
                return `tel:${phone}`;
            case 'vcard':
                const name = document.getElementById('vcardName')?.value || '';
                const vcardPhone = document.getElementById('vcardPhone')?.value || '';
                const email = document.getElementById('vcardEmail')?.value || '';
                return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${vcardPhone}\nEMAIL:${email}\nEND:VCARD`;
            default:
                return '';
        }
    }
    
    async function generateQR() {
        const content = getQrContent();
        if (!content) {
            showToast('الرجاء إدخال المحتوى المطلوب', 'error');
            return;
        }
        
        const size = parseInt(sizeSlider.value);
        
        const qr = new QRious({
            element: document.createElement('canvas'),
            size: size,
            value: content,
            level: 'H'
        });
        
        let canvas = qr.canvas;
        const logoFile = document.getElementById('qrLogo')?.files[0];
        
        if (logoFile) {
            canvas = await addLogoToQRCode(canvas, logoFile);
        }
        
        currentCanvas = canvas;
        const previewArea = document.getElementById('qrPreviewArea');
        const existingCanvas = previewArea.querySelector('canvas');
        if (existingCanvas) existingCanvas.remove();
        canvas.style.display = 'block';
        canvas.style.maxWidth = '100%';
        previewArea.appendChild(canvas);
        const emptyMsg = document.getElementById('qrEmptyMsg');
        if (emptyMsg) emptyMsg.style.display = 'none';
        
        const downloadLink = document.createElement('a');
        downloadLink.href = canvas.toDataURL('image/png');
        downloadLink.download = `qrcode_${Date.now()}.png`;
        downloadLink.click();
        
        addToHistory('إنشاء QR', qrType.value);
        showToast('تم إنشاء QR Code بنجاح', 'success');
    }
    
    function addLogoToQRCode(qrCanvas, logoFile) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const logo = new Image();
                logo.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = qrCanvas.width;
                    canvas.height = qrCanvas.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(qrCanvas, 0, 0);
                    
                    const logoSize = qrCanvas.width * 0.25;
                    const x = (qrCanvas.width - logoSize) / 2;
                    const y = (qrCanvas.height - logoSize) / 2;
                    
                    ctx.fillStyle = 'white';
                    ctx.fillRect(x - 5, y - 5, logoSize + 10, logoSize + 10);
                    ctx.drawImage(logo, x, y, logoSize, logoSize);
                    resolve(canvas);
                };
                logo.src = e.target.result;
            };
            reader.readAsDataURL(logoFile);
        });
    }
    
    if (generateBtn) generateBtn.addEventListener('click', () => showAdBeforeAction(generateQR));
    if (sizeSlider) sizeSlider.addEventListener('input', () => {
        if (sizeValue) sizeValue.textContent = sizeSlider.value;
    });
};

// QR Reader
toolInitializers['qr-reader'] = function() {
    const uploadArea = document.getElementById('qrReaderUploadArea');
    const browseBtn = document.getElementById('qrReaderBrowseBtn');
    const fileInput = document.getElementById('qrReaderFileInput');
    const openCameraBtn = document.getElementById('openCameraBtn');
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const resultDiv = document.getElementById('qrReaderResult');
    const contentTextarea = document.getElementById('qrReadContent');
    const copyBtn = document.getElementById('copyQrResultBtn');
    let stream = null;
    
    async function readQRFromImage(imageData) {
        const image = new Image();
        image.src = imageData;
        await new Promise(resolve => { image.onload = resolve; });
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = image.width;
        tempCanvas.height = image.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const imageDataObj = ctx.getImageData(0, 0, image.width, image.height);
        const code = jsQR(imageDataObj.data, image.width, image.height);
        
        if (code) {
            contentTextarea.value = code.data;
            resultDiv.style.display = 'block';
            addToHistory('قراءة QR', code.data.substring(0, 50));
            showToast('تم قراءة QR Code بنجاح', 'success');
        } else {
            showToast('لم يتم العثور على QR Code', 'error');
        }
    }
    
    function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            readQRFromImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }
    
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            video.style.display = 'block';
            video.play();
            
            const scanInterval = setInterval(() => {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, canvas.width, canvas.height);
                    if (code) {
                        clearInterval(scanInterval);
                        if (stream) {
                            stream.getTracks().forEach(track => track.stop());
                            video.style.display = 'none';
                        }
                        contentTextarea.value = code.data;
                        resultDiv.style.display = 'block';
                        addToHistory('قراءة QR (كاميرا)', code.data.substring(0, 50));
                        showToast('تم قراءة QR Code بنجاح', 'success');
                    }
                }
            }, 500);
            
            openCameraBtn.textContent = 'إيقاف الكاميرا';
            openCameraBtn.onclick = () => {
                clearInterval(scanInterval);
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    video.style.display = 'none';
                }
                openCameraBtn.textContent = 'فتح الكاميرا';
                openCameraBtn.onclick = startCamera;
            };
        } catch (err) {
            showToast('لا يمكن الوصول إلى الكاميرا', 'error');
        }
    }
    
    if (uploadArea) uploadArea.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    if (openCameraBtn) openCameraBtn.addEventListener('click', startCamera);
    if (copyBtn) copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(contentTextarea.value);
        showToast('تم النسخ', 'success');
    });
};

// Barcode Generator
toolInitializers['barcode-generator'] = function() {
    const generateBtn = document.getElementById('generateBarcodeBtn');
    const typeSelect = document.getElementById('barcodeType');
    const valueInput = document.getElementById('barcodeValue');
    const heightSlider = document.getElementById('barcodeHeight');
    const heightValue = document.getElementById('barcodeHeightValue');
    
    if (heightSlider && heightValue) heightSlider.addEventListener('input', () => {
        heightValue.textContent = heightSlider.value;
    });
    
    function generateBarcode() {
        let value = valueInput.value.trim();
        if (!value) {
            showToast('الرجاء إدخال قيمة الباركود', 'error');
            return;
        }
        
        const type = typeSelect.value;
        const height = parseInt(heightSlider.value);
        
        const svg = document.getElementById('barcodeSvg');
        svg.innerHTML = '';
        
        try {
            JsBarcode(svg, value, {
                format: type,
                height: height,
                displayValue: true,
                font: 'Tajawal',
                textAlign: 'center'
            });
            
            const emptyMsg = document.getElementById('barcodeEmptyMsg');
            if (emptyMsg) emptyMsg.style.display = 'none';
            svg.style.display = 'block';
            
            // Also create PNG version for download
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, value, {
                format: type,
                height: height,
                displayValue: true,
                font: 'Tajawal'
            });
            
            const downloadLink = document.createElement('a');
            downloadLink.href = canvas.toDataURL('image/png');
            downloadLink.download = `barcode_${type}_${Date.now()}.png`;
            downloadLink.click();
            
            addToHistory('إنشاء باركود', type);
            showToast('تم إنشاء الباركود بنجاح', 'success');
        } catch (e) {
            showToast('خطأ في إنشاء الباركود: ' + e.message, 'error');
        }
    }
    
    if (generateBtn) generateBtn.addEventListener('click', () => showAdBeforeAction(generateBarcode));
};

// Profile Downloader
toolInitializers['profile-downloader'] = function() {
    const platform = document.getElementById('platformSelect');
    const username = document.getElementById('username');
    const fetchBtn = document.getElementById('fetchProfileBtn');
    const resultDiv = document.getElementById('profileResult');
    const profileImage = document.getElementById('profileImage');
    const downloadBtn = document.getElementById('downloadProfileBtn');
    
    function fetchProfile() {
        const user = username.value.trim();
        if (!user) {
            showToast('الرجاء إدخال اسم المستخدم', 'error');
            return;
        }
        
        let url = '';
        switch(platform.value) {
            case 'github':
                url = `https://github.com/${user}.png`;
                profileImage.src = url;
                resultDiv.style.display = 'block';
                downloadBtn.href = url;
                addToHistory('تحميل صورة الملف الشخصي', `GitHub/${user}`);
                showToast('تم تحميل الصورة', 'success');
                return;
            case 'twitter':
                url = `https://unavatar.io/twitter/${user}`;
                profileImage.src = url;
                resultDiv.style.display = 'block';
                downloadBtn.href = url;
                addToHistory('تحميل صورة الملف الشخصي', `Twitter/${user}`);
                showToast('تم تحميل الصورة', 'success');
                return;
            case 'instagram':
                showToast('Instagram API يتطلب مصادقة، استخدم رابط المعاينة', 'info');
                return;
            default:
                showToast('منصة غير مدعومة حالياً', 'info');
                return;
        }
    }
    
    if (fetchBtn) fetchBtn.addEventListener('click', () => showAdBeforeAction(fetchProfile));
};

// YouTube Thumbnail
toolInitializers['youtube-thumbnail'] = function() {
    const urlInput = document.getElementById('youtubeUrl');
    const qualitySelect = document.getElementById('thumbnailQuality');
    const getBtn = document.getElementById('getThumbnailBtn');
    const resultDiv = document.getElementById('thumbnailResult');
    const thumbnailImg = document.getElementById('thumbnailImage');
    const downloadBtn = document.getElementById('downloadThumbnailBtn');
    
    function extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([^&]+)/,
            /(?:youtu\.be\/)([^?]+)/,
            /(?:youtube\.com\/embed\/)([^?]+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }
    
    function getThumbnail() {
        const url = urlInput.value.trim();
        const videoId = extractVideoId(url);
        if (!videoId) {
            showToast('رابط يوتيوب غير صالح', 'error');
            return;
        }
        
        const quality = qualitySelect.value;
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
        thumbnailImg.src = thumbnailUrl;
        resultDiv.style.display = 'block';
        downloadBtn.href = thumbnailUrl;
        addToHistory('مصغر يوتيوب', videoId);
        showToast('تم استخراج الصورة المصغرة', 'success');
    }
    
    if (getBtn) getBtn.addEventListener('click', () => showAdBeforeAction(getThumbnail));
};

// Instagram Downloader
toolInitializers['instagram-downloader'] = function() {
    const urlInput = document.getElementById('instagramUrl');
    const getBtn = document.getElementById('getInstagramBtn');
    const previewDiv = document.getElementById('instagramPreview');
    const resultDiv = document.getElementById('instagramResult');
    
    function getInstagramPreview() {
        const url = urlInput.value.trim();
        if (!url) {
            showToast('الرجاء إدخال رابط Instagram', 'error');
            return;
        }
        
        // Instagram oEmbed API (for public posts)
        const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`;
        
        previewDiv.innerHTML = '<p>جاري تحميل المعاينة...</p>';
        resultDiv.style.display = 'block';
        
        fetch(oembedUrl)
            .then(response => response.json())
            .then(data => {
                if (data.thumbnail_url) {
                    previewDiv.innerHTML = `
                        <img src="${data.thumbnail_url}" style="max-width: 100%; border-radius: 8px;">
                        <p><strong>${data.title || ''}</strong></p>
                        <p class="text-muted">لتحميل المحتوى، استخدم المواقع المتخصصة مثل saveinsta.app</p>
                    `;
                    addToHistory('Instagram معاينة', url);
                } else {
                    previewDiv.innerHTML = '<p>لا يمكن عرض المعاينة. قد يكون المنشور خاصاً.</p>';
                }
            })
            .catch(() => {
                previewDiv.innerHTML = '<p>حدث خطأ. تأكد من الرابط وجرب مرة أخرى.</p>';
            });
    }
    
    if (getBtn) getBtn.addEventListener('click', () => showAdBeforeAction(getInstagramPreview));
};

// ========== Page Content Generators ==========
function generatePageContent() {
    // Privacy Policy
    document.getElementById('privacyContent').innerHTML = `
        <h3>مقدمة</h3>
        <p>نحن في منصة الأدوات المتكاملة ندرك أهمية خصوصية بياناتك. توضح سياسة الخصوصية هذه كيفية جمع واستخدام وحماية معلوماتك عند استخدام منصتنا.</p>
        
        <h3>جمع المعلومات</h3>
        <p>نحن لا نقوم بجمع أو تخزين أي من ملفاتك أو بياناتك الشخصية. جميع الأدوات تعمل مباشرة في متصفحك، ولا يتم تحميل أي من ملفاتك إلى خوادمنا.</p>
        
        <h3>الإعلانات</h3>
        <p>نستخدم Google AdSense لعرض الإعلانات. قد تقوم Google بجمع بعض المعلومات لعرض إعلانات مخصصة. يمكنك التحكم في إعدادات الإعلانات من خلال حساب Google الخاص بك.</p>
        
        <h3>ملفات تعريف الارتباط (Cookies)</h3>
        <p>نستخدم ملفات تعريف الارتباط لتحسين تجربتك، مثل حفظ تفضيلات الوضع الليلي وحجم الخط. لا نستخدمها لجمع معلومات شخصية.</p>
        
        <h3>الأمان</h3>
        <p>نحن نلتزم بحماية بياناتك. جميع المعالجات تتم محلياً على جهازك، مما يضمن أمان ملفاتك.</p>
        
        <p class="text-muted" style="margin-top: 2rem;">آخر تحديث: 1 يناير 2026</p>
    `;
    
    // Contact Page
    document.getElementById('contactContent').innerHTML = `
        <div class="contact-info">
            <a href="https://wa.me/201150603363" target="_blank" class="contact-item whatsapp">
                <i class="fab fa-whatsapp fa-2x"></i>
                <div><h4>واتساب</h4><p>01150603363</p></div>
            </a>
            <a href="mailto:draculla2o24@gmail.com" class="contact-item email">
                <i class="fas fa-envelope fa-2x"></i>
                <div><h4>البريد الإلكتروني</h4><p>draculla2o24@gmail.com</p></div>
            </a>
            <a href="https://www.facebook.com/share/1B8pRJEb6k/" target="_blank" class="contact-item facebook">
                <i class="fab fa-facebook fa-2x"></i>
                <div><h4>فيسبوك</h4><p>صفحتنا على فيسبوك</p></div>
            </a>
            <a href="https://www.linkedin.com/" target="_blank" class="contact-item linkedin">
                <i class="fab fa-linkedin fa-2x"></i>
                <div><h4>لينكد إن</h4><p>صفحتنا على LinkedIn</p></div>
            </a>
        </div>
        <div class="social-links">
            <a href="https://wa.me/201150603363" target="_blank" class="whatsapp"><i class="fab fa-whatsapp"></i></a>
            <a href="https://www.facebook.com/share/1B8pRJEb6k/" target="_blank" class="facebook"><i class="fab fa-facebook-f"></i></a>
            <a href="https://www.linkedin.com/" target="_blank" class="linkedin"><i class="fab fa-linkedin-in"></i></a>
        </div>
    `;
    
    // About Page
    document.getElementById('aboutContent').innerHTML = `
        <h3>منصة الأدوات المتكاملة</h3>
        <p>نحن منصة عربية تهدف إلى توفير مجموعة متكاملة من الأدوات المجانية التي يحتاجها المستخدم العربي في حياته اليومية وعمله.</p>
        
        <h3>رؤيتنا</h3>
        <p>نسعى لأن نكون المنصة العربية الأولى للأدوات المجانية عبر الإنترنت، نقدم حلولاً سريعة وآمنة وسهلة الاستخدام للجميع.</p>
        
        <h3>رسالتنا</h3>
        <p>تقديم أدوات عالية الجودة تعمل مباشرة في المتصفح دون الحاجة لتثبيت برامج، مع الحفاظ على خصوصية وأمان بيانات المستخدمين.</p>
        
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-number">55+</div><p>أداة مجانية</p></div>
            <div class="stat-card"><div class="stat-number">100%</div><p>آمنة وخاصة</p></div>
            <div class="stat-card"><div class="stat-number">24/7</div><p>متاحة دائماً</p></div>
        </div>
        
        <h3>التقنيات المستخدمة</h3>
        <p>نستخدم أحدث تقنيات الويب مثل HTML5 و JavaScript و CSS3 لضمان تجربة سلسلة على جميع الأجهزة والمتصفحات.</p>
    `;
}

// ========== Initialization ==========
function initDarkMode() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) document.body.classList.add('dark-mode');
    document.getElementById('darkModeToggle')?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    });
}

function initFontSize() {
    const fontSize = localStorage.getItem('fontSize');
    if (fontSize === 'large') document.body.classList.add('font-large');
    document.getElementById('fontSizeToggle')?.addEventListener('click', () => {
        document.body.classList.toggle('font-large');
        localStorage.setItem('fontSize', document.body.classList.contains('font-large') ? 'large' : 'normal');
    });
}

function initShareSite() {
    document.getElementById('shareSiteBtn')?.addEventListener('click', () => {
        shareResult('منصة الأدوات المتكاملة', 'أكثر من 55 أداة مجانية في منصة واحدة', window.location.href);
    });
    
    document.getElementById('twitterShareBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('اكتشفت منصة رائعة تحتوي على أكثر من 55 أداة مجانية!')}&url=${encodeURIComponent(window.location.href)}`, '_blank');
    });
}

// Main Init
function init() {
    renderCategories();
    renderTools('all');
    initDarkMode();
    initFontSize();
    initShareSite();
    generatePageContent();
}

// Expose global functions
window.showToolsPage = showToolsPage;
window.showPrivacyPage = showPrivacyPage;
window.showContactPage = showContactPage;
window.showAboutPage = showAboutPage;
window.openTool = openTool;
window.searchTools = searchTools;

document.addEventListener('DOMContentLoaded', init);