function getSupabaseClient() {
    if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase client is not loaded. Make sure js/supabase.js is included before js/upload.js.');
    }

    return supabaseClient;
}

function getElement(id) {
    return document.getElementById(id);
}

function showUploadError(message) {
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
    }
}

function showUploadSuccess(message) {
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

function clearUploadMessages() {
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

function setSubmitLoading(isLoading) {
    const submitBtn = getElement('submit-btn');

    if (!submitBtn) {
        return;
    }

    if (!submitBtn.dataset.originalText) {
        submitBtn.dataset.originalText = submitBtn.textContent;
    }

    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Please wait...' : submitBtn.dataset.originalText;
}

function setProgress(percent) {
    const progressContainer = getElement('upload-progress-container');
    const progressBar = getElement('progress-bar');

    if (progressContainer) {
        progressContainer.hidden = false;
    }

    if (progressBar) {
        progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
}

function hideProgress() {
    const progressContainer = getElement('upload-progress-container');
    const progressBar = getElement('progress-bar');

    if (progressContainer) {
        progressContainer.hidden = true;
    }

    if (progressBar) {
        progressBar.style.width = '0%';
    }
}

function getSelectedFiles(id) {
    const input = getElement(id);

    if (!input || !input.files) {
        return [];
    }

    return Array.from(input.files);
}

function sanitizeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
}

function getFilePath(userId, file) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    return `${userId}/${timestamp}-${random}-${sanitizeFileName(file.name)}`;
}

async function getCurrentSessionUser() {
    return checkAuth();
}

async function uploadFiles(bucket, files, userId, progressStart, progressEnd) {
    const client = getSupabaseClient();
    const publicUrls = [];

    if (files.length === 0) {
        setProgress(progressEnd);
        return publicUrls;
    }

    for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const filePath = getFilePath(userId, file);
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

        if (data?.publicUrl) {
            publicUrls.push(data.publicUrl);
        }

        const progress = progressStart + ((index + 1) / files.length) * (progressEnd - progressStart);
        setProgress(progress);
    }

    return publicUrls;
}

function renderImagePreviews() {
    const previewGrid = getElement('image-previews');
    const imageFiles = getSelectedFiles('prop-images').slice(0, 5);

    if (!previewGrid) {
        return;
    }

    previewGrid.innerHTML = '';

    imageFiles.forEach((file) => {
        const preview = document.createElement('div');
        const image = document.createElement('img');

        preview.className = 'image-preview';
        image.src = URL.createObjectURL(file);
        image.alt = file.name;
        image.addEventListener('load', () => URL.revokeObjectURL(image.src));
        preview.appendChild(image);
        previewGrid.appendChild(preview);
    });
}

function renderDocumentList() {
    const documentList = getElement('document-list');
    const documentFiles = getSelectedFiles('prop-documents');

    if (!documentList) {
        return;
    }

    documentList.innerHTML = '';

    documentFiles.forEach((file) => {
        const item = document.createElement('div');
        item.className = 'document-item';
        item.textContent = file.name;
        documentList.appendChild(item);
    });
}

function getFormValue(id) {
    return getElement(id)?.value.trim() || '';
}

function validateUploadForm(imageFiles) {
    const requiredFields = [
        ['prop-title', 'Property title is required.'],
        ['prop-description', 'Property description is required.'],
        ['prop-location', 'Property location is required.'],
        ['prop-type', 'Property type is required.'],
        ['prop-price', 'Property price is required.'],
        ['prop-size', 'Property size is required.']
    ];

    const missingField = requiredFields.find(([id]) => !getFormValue(id));

    if (missingField) {
        return missingField[1];
    }

    if (Number(getFormValue('prop-price')) <= 0) {
        return 'Property price must be greater than zero.';
    }

    if (Number(getFormValue('prop-size')) <= 0) {
        return 'Property size must be greater than zero.';
    }

    if (imageFiles.length > 5) {
        return 'You can upload up to 5 property images.';
    }

    return '';
}

async function handleUploadSubmit(event) {
    event.preventDefault();
    clearUploadMessages();

    const user = await getCurrentSessionUser();

    if (!user) {
        return;
    }

    const imageFiles = getSelectedFiles('prop-images');
    const documentFiles = getSelectedFiles('prop-documents');
    const validationError = validateUploadForm(imageFiles);

    if (validationError) {
        showUploadError(validationError);
        return;
    }

    setSubmitLoading(true);
    setProgress(5);

    try {
        const imageUrls = await uploadFiles('property-images', imageFiles.slice(0, 5), user.id, 10, 55);
        const documentUrls = await uploadFiles('property-docs', documentFiles, user.id, 55, 85);
        const client = getSupabaseClient();

        setProgress(92);

        const { error } = await client
            .from('properties')
            .insert({
                user_id: user.id,
                title: getFormValue('prop-title'),
                description: getFormValue('prop-description'),
                location: getFormValue('prop-location'),
                type: getFormValue('prop-type'),
                price: Number(getFormValue('prop-price')),
                size: Number(getFormValue('prop-size')),
                image_urls: imageUrls,
                doc_urls: documentUrls,
                status: 'pending',
                created_at: new Date().toISOString()
            });

        if (error) {
            throw error;
        }

        setProgress(100);
        showUploadSuccess('Property submitted successfully! Our team will review it within 24-48 hours. Redirecting to your dashboard...');

        window.setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2200);
    } catch (error) {
        console.error('Upload failed:', error);
        hideProgress();
        showUploadError(error.message || 'Unable to submit property. Please try again.');
    } finally {
        setSubmitLoading(false);
    }
}

function initUploadPage() {
    const form = getElement('upload-form');
    const imageInput = getElement('prop-images');
    const documentInput = getElement('prop-documents');

    getCurrentSessionUser();
    hideProgress();

    if (imageInput) {
        imageInput.addEventListener('change', renderImagePreviews);
    }

    if (documentInput) {
        documentInput.addEventListener('change', renderDocumentList);
    }

    if (form) {
        form.addEventListener('submit', handleUploadSubmit);
    }
}

document.addEventListener('DOMContentLoaded', initUploadPage);
