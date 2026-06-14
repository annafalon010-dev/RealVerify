/*
═══════════════════════════════════════════════════════════════════════════════
  SUPABASE SQL SETUP FOR STEP 2 - RUN IN SUPABASE SQL EDITOR
═══════════════════════════════════════════════════════════════════════════════

-- New columns on properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS doc_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS id_front_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS id_back_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_signature_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS quarter TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS gps_lat NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS gps_lng NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS cadastral_number TEXT;

-- New witnesses table
CREATE TABLE IF NOT EXISTS witnesses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    witness_number INT,
    full_name TEXT,
    phone TEXT,
    id_number TEXT,
    id_scan_url TEXT,
    signature_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE witnesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert witnesses for own properties"
ON witnesses FOR INSERT
WITH CHECK (
    property_id IN (
        SELECT id FROM properties WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view witnesses for own properties"
ON witnesses FOR SELECT
USING (
    property_id IN (
        SELECT id FROM properties WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- NOTE: Create the 'property-videos' bucket manually in Supabase Storage section
-- with PUBLIC visibility (same as property-images bucket)

═══════════════════════════════════════════════════════════════════════════════
*/

// Helper to get Supabase client
function getSupabaseClient() {
    if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase client is not loaded. Make sure js/supabase.js is included before js/upload.js.');
    }
    return supabaseClient;
}

// DOM element getter
function getElement(id) {
    return document.getElementById(id);
}

// Show error message
function showError(message) {
    const errorMsg = getElement('error-msg');
    const successMsg = getElement('success-msg');
    
    if (successMsg) {
        successMsg.hidden = true;
        successMsg.classList.remove('show');
    }
    
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.hidden = false;
        errorMsg.classList.add('show');
        errorMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Show success message
function showSuccess(message) {
    const errorMsg = getElement('error-msg');
    const successMsg = getElement('success-msg');
    
    if (errorMsg) {
        errorMsg.hidden = true;
        errorMsg.classList.remove('show');
    }
    
    if (successMsg) {
        successMsg.textContent = message;
        successMsg.hidden = false;
        successMsg.classList.add('show');
    }
}

// Clear messages
function clearMessages() {
    const errorMsg = getElement('error-msg');
    const successMsg = getElement('success-msg');
    
    if (errorMsg) {
        errorMsg.textContent = '';
        errorMsg.hidden = true;
        errorMsg.classList.remove('show');
    }
    
    if (successMsg) {
        successMsg.hidden = true;
        successMsg.classList.remove('show');
    }
}

// Set submit button loading state
function setSubmitLoading(isLoading) {
    const submitBtn = getElement('submit-btn');
    if (!submitBtn) return;
    
    if (!submitBtn.dataset.originalText) {
        submitBtn.dataset.originalText = submitBtn.textContent;
    }
    
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Submitting...' : submitBtn.dataset.originalText;
}

// Update progress bar
function setProgress(label, percent) {
    const container = getElement('upload-progress-container');
    const bar = getElement('progress-bar');
    const labelEl = getElement('progress-label');
    
    if (container) {
        container.style.display = 'block';
    }
    
    if (labelEl) {
        labelEl.textContent = label;
    }
    
    if (bar) {
        bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
}

// Hide progress container
function hideProgress() {
    const container = getElement('upload-progress-container');
    if (container) {
        container.style.display = 'none';
    }
}

// Get selected files from input
function getSelectedFiles(id) {
    const input = getElement(id);
    if (!input || !input.files) return [];
    return Array.from(input.files);
}

// Sanitize file name
function sanitizeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
}

// Generate unique file path
function getFilePath(userId, propertyId, fileName) {
    const sanitized = sanitizeFileName(fileName);
    const timestamp = Date.now();
    return `${userId}/${propertyId}/${timestamp}-${sanitized}`;
}

// Get current authenticated user
async function getCurrentUser() {
    try {
        const user = await checkAuth();
        return user;
    } catch (error) {
        console.error('Auth check failed:', error);
        return null;
    }
}

// Upload a single file to Supabase Storage
async function uploadFile(bucket, filePath, file) {
    const client = getSupabaseClient();
    
    const { error } = await client.storage
        .from(bucket)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });
    
    if (error) {
        throw error;
    }
    
    const { data } = client.storage
        .from(bucket)
        .getPublicUrl(filePath);
    
    return data?.publicUrl || '';
}

// Handle image file selection and preview
function setupImageUpload() {
    const input = getElement('property-images');
    const area = getElement('image-upload-area');
    const preview = getElement('image-previews');
    
    if (!input || !area) return;
    
    // Click to select
    area.addEventListener('click', () => input.click());
    
    // Drag and drop
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('drag-over');
    });
    
    area.addEventListener('dragleave', () => {
        area.classList.remove('drag-over');
    });
    
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        input.files = createFileList(files);
        renderImagePreviews();
    });
    
    // File input change
    input.addEventListener('change', renderImagePreviews);
}

// Render image previews
function renderImagePreviews() {
    const files = getSelectedFiles('property-images').slice(0, 6);
    const preview = getElement('image-previews');
    
    if (!preview) return;
    
    preview.innerHTML = '';
    
    files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.onload = () => URL.revokeObjectURL(img.src);
        
        const checkmark = document.createElement('div');
        checkmark.className = 'preview-checkmark';
        checkmark.innerHTML = '✓';
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'preview-remove';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            removeImageAtIndex(index);
        });
        
        item.appendChild(img);
        item.appendChild(checkmark);
        item.appendChild(removeBtn);
        preview.appendChild(item);
    });
}

// Remove image at index
function removeImageAtIndex(index) {
    const input = getElement('property-images');
    const files = Array.from(input.files).filter((_, i) => i !== index);
    input.files = createFileList(files);
    renderImagePreviews();
}

// Handle video file selection
function setupVideoUpload() {
    const input = getElement('property-video');
    const area = getElement('video-upload-area');
    
    if (!input || !area) return;
    
    area.addEventListener('click', () => input.click());
    
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('drag-over');
    });
    
    area.addEventListener('dragleave', () => {
        area.classList.remove('drag-over');
    });
    
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
        if (files.length > 0) {
            input.files = createFileList([files[0]]);
            renderVideoPreview();
        }
    });
    
    input.addEventListener('change', renderVideoPreview);
}

// Render video preview
function renderVideoPreview() {
    const files = getSelectedFiles('property-video');
    const container = getElement('video-preview');
    const filenameEl = getElement('video-filename');
    const videoEl = getElement('video-element');
    
    if (!container || !videoEl) return;
    
    if (files.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    const file = files[0];
    if (filenameEl) {
        filenameEl.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
    }
    
    videoEl.src = URL.createObjectURL(file);
    container.style.display = 'block';
}

// Remove video
function removeVideo() {
    const input = getElement('property-video');
    const container = getElement('video-preview');
    const videoEl = getElement('video-element');
    
    if (videoEl && videoEl.src) {
        URL.revokeObjectURL(videoEl.src);
        videoEl.src = '';
    }
    
    input.value = '';
    if (container) {
        container.style.display = 'none';
    }
}

// Handle file uploads with preview
function setupFileUpload(inputId, areaId, previewId, fileType) {
    const input = getElement(inputId);
    const area = getElement(areaId);
    const preview = getElement(previewId);
    
    if (!input || !area) return;
    
    area.addEventListener('click', () => input.click());
    
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('drag-over');
    });
    
    area.addEventListener('dragleave', () => {
        area.classList.remove('drag-over');
    });
    
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('drag-over');
        
        let files = Array.from(e.dataTransfer.files);
        if (fileType === 'image') {
            files = files.filter(f => f.type.startsWith('image/'));
        } else if (fileType === 'pdf') {
            files = files.filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
        }
        
        if (files.length > 0) {
            input.files = createFileList([files[0]]);
            renderFilePreview(inputId, previewId, fileType);
        }
    });
    
    input.addEventListener('change', () => renderFilePreview(inputId, previewId, fileType));
}

// Render file preview
function renderFilePreview(inputId, previewId, fileType) {
    const files = getSelectedFiles(inputId);
    const preview = getElement(previewId);
    
    if (!preview) return;
    
    preview.innerHTML = '';
    
    if (files.length === 0) {
        return;
    }
    
    const file = files[0];
    
    if (fileType === 'image' && file.type.startsWith('image/')) {
        const item = document.createElement('div');
        item.className = 'preview-item';
        
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.onload = () => URL.revokeObjectURL(img.src);
        
        const checkmark = document.createElement('div');
        checkmark.className = 'preview-checkmark';
        checkmark.innerHTML = '✓';
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'preview-remove';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            getElement(inputId).value = '';
            renderFilePreview(inputId, previewId, fileType);
        });
        
        item.appendChild(img);
        item.appendChild(checkmark);
        item.appendChild(removeBtn);
        preview.appendChild(item);
    } else {
        const item = document.createElement('div');
        item.style.padding = '12px';
        item.style.background = 'rgba(201, 168, 76, 0.1)';
        item.style.borderRadius = '8px';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = file.name;
        nameSpan.style.fontSize = '0.9rem';
        nameSpan.style.color = '#b8b8b8';
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '✕';
        removeBtn.style.background = 'none';
        removeBtn.style.border = 'none';
        removeBtn.style.color = '#ef4444';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '1.2rem';
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            getElement(inputId).value = '';
            renderFilePreview(inputId, previewId, fileType);
        });
        
        item.appendChild(nameSpan);
        item.appendChild(removeBtn);
        preview.appendChild(item);
    }
}

// Create a FileList from array (for drag-drop compatibility)
function createFileList(files) {
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    return dt.files;
}

// Get form value
function getFormValue(id) {
    const el = getElement(id);
    return el ? el.value.trim() : '';
}

// Validate form
function validateForm() {
    const requiredFields = [
        ['property-title', 'Property Title is required'],
        ['property-type', 'Property Type is required'],
        ['property-description', 'Property Description is required'],
        ['region', 'Region is required'],
        ['city', 'City is required'],
        ['quarter', 'Quarter/Neighbourhood is required'],
        ['price', 'Price is required'],
        ['size', 'Size is required'],
        ['document-type', 'Document Type is required'],
        ['ownership-doc', 'Ownership Document is required'],
        ['id-front', 'ID Front is required'],
        ['id-back', 'ID Back is required'],
        ['owner-signature', 'Owner Signature is required'],
        ['witness1-name', 'Witness 1 Name is required'],
        ['witness1-phone', 'Witness 1 Phone is required'],
        ['witness1-id', 'Witness 1 ID Number is required'],
        ['witness1-id-scan', 'Witness 1 ID Scan is required'],
        ['witness1-signature', 'Witness 1 Signature is required'],
        ['witness2-name', 'Witness 2 Name is required'],
        ['witness2-phone', 'Witness 2 Phone is required'],
        ['witness2-id', 'Witness 2 ID Number is required'],
        ['witness2-id-scan', 'Witness 2 ID Scan is required'],
        ['witness2-signature', 'Witness 2 Signature is required'],
        ['confirm-checkbox', 'You must confirm the accuracy of information']
    ];
    
    for (const [id, message] of requiredFields) {
        const el = getElement(id);
        if (!el) continue;
        
        if (el.type === 'checkbox') {
            if (!el.checked) {
                return message;
            }
        } else if (el.type === 'file') {
            if (el.files.length === 0) {
                return message;
            }
        } else {
            if (!getFormValue(id)) {
                return message;
            }
        }
    }
    
    // Validate property images (at least 1)
    const imageFiles = getSelectedFiles('property-images');
    if (imageFiles.length === 0) {
        return 'At least 1 property image is required';
    }
    
    // Validate price and size
    const price = Number(getFormValue('price'));
    const size = Number(getFormValue('size'));
    
    if (price <= 0) {
        return 'Price must be greater than zero';
    }
    
    if (size <= 0) {
        return 'Size must be greater than zero';
    }
    
    return '';
}

// Main form submission handler
async function handleFormSubmit(event) {
    event.preventDefault();
    clearMessages();
    
    const user = await getCurrentUser();
    if (!user) {
        showError('You must be logged in to submit a property');
        return;
    }
    
    // Validate form
    const validationError = validateForm();
    if (validationError) {
        showError(validationError);
        return;
    }
    
    setSubmitLoading(true);
    hideProgress();
    
    try {
        // Generate property ID (will be saved in DB)
        const propertyId = crypto.randomUUID ? crypto.randomUUID() : 'prop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Collect all files
        const propertyImages = getSelectedFiles('property-images');
        const propertyVideo = getSelectedFiles('property-video');
        const ownershipDoc = getSelectedFiles('ownership-doc');
        const idFront = getSelectedFiles('id-front');
        const idBack = getSelectedFiles('id-back');
        const ownerSignature = getSelectedFiles('owner-signature');
        const witness1IdScan = getSelectedFiles('witness1-id-scan');
        const witness1Sig = getSelectedFiles('witness1-signature');
        const witness2IdScan = getSelectedFiles('witness2-id-scan');
        const witness2Sig = getSelectedFiles('witness2-signature');
        
        const totalFiles = 
            propertyImages.length + 
            (propertyVideo.length > 0 ? 1 : 0) +
            1 + // ownership doc
            2 + // id front/back
            1 + // owner sig
            2 + // witness 1 id/sig
            2;  // witness 2 id/sig
        
        let uploadedCount = 0;
        
        // Helper to upload and track progress
        async function uploadAndTrack(bucket, files, pathPrefix) {
            const urls = [];
            for (const file of files) {
                const filePath = `${pathPrefix}/${pathPrefix === 'property-images' ? file.name : sanitizeFileName(file.name)}`;
                const url = await uploadFile(bucket, filePath, file);
                urls.push(url);
                uploadedCount++;
                setProgress(`Uploading files... ${uploadedCount} of ${totalFiles} complete (${Math.round((uploadedCount / totalFiles) * 100)}%)`, (uploadedCount / totalFiles) * 100);
            }
            return urls;
        }
        
        // Upload property images
        setProgress('Uploading property images...', 10);
        const imageUrls = await uploadAndTrack('property-images', propertyImages, `${user.id}/${propertyId}`);
        
        // Upload property video if exists
        let videoUrl = '';
        if (propertyVideo.length > 0) {
            setProgress('Uploading video...', (uploadedCount / totalFiles) * 100);
            const urls = await uploadAndTrack('property-videos', propertyVideo, `${user.id}/${propertyId}`);
            videoUrl = urls[0] || '';
        }
        
        // Upload ownership document
        setProgress('Uploading ownership document...', (uploadedCount / totalFiles) * 100);
        const docUrls = await uploadAndTrack('property-docs', ownershipDoc, `${user.id}/${propertyId}`);
        const docUrl = docUrls[0] || '';
        
        // Upload ID front/back
        setProgress('Uploading ID documents...', (uploadedCount / totalFiles) * 100);
        const idFrontUrls = await uploadAndTrack('property-docs', idFront, `${user.id}/${propertyId}`);
        const idFrontUrl = idFrontUrls[0] || '';
        const idBackUrls = await uploadAndTrack('property-docs', idBack, `${user.id}/${propertyId}`);
        const idBackUrl = idBackUrls[0] || '';
        
        // Upload owner signature
        setProgress('Uploading signature...', (uploadedCount / totalFiles) * 100);
        const ownerSigUrls = await uploadAndTrack('property-docs', ownerSignature, `${user.id}/${propertyId}`);
        const ownerSigUrl = ownerSigUrls[0] || '';
        
        // Upload witness 1 documents
        setProgress('Uploading witness documents...', (uploadedCount / totalFiles) * 100);
        const w1IdUrls = await uploadAndTrack('property-docs', witness1IdScan, `${user.id}/${propertyId}`);
        const w1IdUrl = w1IdUrls[0] || '';
        const w1SigUrls = await uploadAndTrack('property-docs', witness1Sig, `${user.id}/${propertyId}`);
        const w1SigUrl = w1SigUrls[0] || '';
        
        // Upload witness 2 documents
        const w2IdUrls = await uploadAndTrack('property-docs', witness2IdScan, `${user.id}/${propertyId}`);
        const w2IdUrl = w2IdUrls[0] || '';
        const w2SigUrls = await uploadAndTrack('property-docs', witness2Sig, `${user.id}/${propertyId}`);
        const w2SigUrl = w2SigUrls[0] || '';
        
        setProgress('Saving property to database...', 95);
        
        const client = getSupabaseClient();
        
        // Insert property record
        const { data: propertyData, error: propertyError } = await client
            .from('properties')
            .insert({
                id: propertyId,
                user_id: user.id,
                title: getFormValue('property-title'),
                description: getFormValue('property-description'),
                type: getFormValue('property-type'),
                region: getFormValue('region'),
                quarter: getFormValue('quarter'),
                price: Number(getFormValue('price')),
                size: Number(getFormValue('size')),
                gps_lat: getFormValue('gps-lat') ? Number(getFormValue('gps-lat')) : null,
                gps_lng: getFormValue('gps-lng') ? Number(getFormValue('gps-lng')) : null,
                cadastral_number: getFormValue('cadastral-number') || null,
                image_urls: imageUrls,
                video_url: videoUrl,
                doc_url: docUrl,
                document_type: getFormValue('document-type'),
                id_front_url: idFrontUrl,
                id_back_url: idBackUrl,
                owner_signature_url: ownerSigUrl,
                status: 'pending',
                created_at: new Date().toISOString()
            });
        
        if (propertyError) {
            throw propertyError;
        }
        
        // Insert witness 1 record
        const { error: witness1Error } = await client
            .from('witnesses')
            .insert({
                property_id: propertyId,
                witness_number: 1,
                full_name: getFormValue('witness1-name'),
                phone: getFormValue('witness1-phone'),
                id_number: getFormValue('witness1-id'),
                id_scan_url: w1IdUrl,
                signature_url: w1SigUrl
            });
        
        if (witness1Error) {
            throw witness1Error;
        }
        
        // Insert witness 2 record
        const { error: witness2Error } = await client
            .from('witnesses')
            .insert({
                property_id: propertyId,
                witness_number: 2,
                full_name: getFormValue('witness2-name'),
                phone: getFormValue('witness2-phone'),
                id_number: getFormValue('witness2-id'),
                id_scan_url: w2IdUrl,
                signature_url: w2SigUrl
            });
        
        if (witness2Error) {
            throw witness2Error;
        }
        
        setProgress('Complete!', 100);
        showSuccess('Property submitted successfully! Your listing is now pending admin review. You will receive a notification once it has been reviewed. Redirecting to dashboard...');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 3000);
        
    } catch (error) {
        console.error('Submission failed:', error);
        hideProgress();
        showError(`Submission failed: ${error.message || 'Please try again'}`);
    } finally {
        setSubmitLoading(false);
    }
}

// Initialize form
function initializeForm() {
    // Setup upload handlers
    setupImageUpload();
    setupVideoUpload();
    
    // Setup individual file uploads
    setupFileUpload('ownership-doc', 'doc-upload-area', 'doc-preview', 'pdf');
    setupFileUpload('id-front', 'id-front-area', 'id-front-preview', 'pdf');
    setupFileUpload('id-back', 'id-back-area', 'id-back-preview', 'pdf');
    setupFileUpload('owner-signature', 'signature-upload-area', 'signature-preview', 'image');
    
    // Witness uploads
    setupFileUpload('witness1-id-scan', 'witness1-id-area', 'witness1-id-preview', 'image');
    setupFileUpload('witness1-signature', 'witness1-sig-area', 'witness1-sig-preview', 'image');
    setupFileUpload('witness2-id-scan', 'witness2-id-area', 'witness2-id-preview', 'image');
    setupFileUpload('witness2-signature', 'witness2-sig-area', 'witness2-sig-preview', 'image');
    
    // Form submission
    const form = getElement('upload-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    hideProgress();
    getCurrentUser();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initializeForm);
