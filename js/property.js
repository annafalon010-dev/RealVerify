function getSupabaseClient() {
    if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase client is not loaded. Make sure js/supabase.js is included before js/property.js.');
    }

    return supabaseClient;
}

const PROPERTIES_PER_PAGE = 6;
let currentPage = 1;
let currentProperties = [];

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => {
        const entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        };

        return entities[character];
    });
}

function formatPrice(price) {
    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
        return '₦0';
    }

    return `₦${numericPrice.toLocaleString('en-NG')}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return 'Date unavailable';
    }

    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function getBadgeHTML(status) {
    const normalizedStatus = String(status || 'pending').toLowerCase();

    if (normalizedStatus === 'verified') {
        return `
            <span class="badge-verified">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 3L19 6V11C19 15.5 16.1 19.1 12 21C7.9 19.1 5 15.5 5 11V6L12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                    <path d="M9 12L11 14L15.5 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Verified
            </span>
        `;
    }

    if (normalizedStatus === 'rejected') {
        return '<span class="badge-rejected">Rejected</span>';
    }

    return '<span class="badge-pending">Pending</span>';
}

function getImageUrls(property) {
    const imageUrls = property?.image_urls;

    if (Array.isArray(imageUrls)) {
        return imageUrls.filter(Boolean);
    }

    if (typeof imageUrls === 'string' && imageUrls.trim()) {
        try {
            const parsedUrls = JSON.parse(imageUrls);

            if (Array.isArray(parsedUrls)) {
                return parsedUrls.filter(Boolean);
            }
        } catch (error) {
            return [imageUrls];
        }
    }

    return [];
}

function createPropertyCard(property) {
    const imageUrls = getImageUrls(property);
    const firstImage = imageUrls[0];
    const imageHTML = firstImage
        ? `<img src="${escapeHTML(firstImage)}" alt="${escapeHTML(property.title || 'Verified property')}">`
        : '<div class="property-image-placeholder">No Image Available</div>';

    return `
        <article class="property-card">
            <div class="property-card-image">
                ${imageHTML}
                ${getBadgeHTML(property.status)}
            </div>
            <div class="property-card-body">
                <h3 class="property-card-title">${escapeHTML(property.title || 'Untitled Property')}</h3>
                <p class="property-location">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M12 21C12 21 18 15.8 18 10C18 6.7 15.3 4 12 4C8.7 4 6 6.7 6 10C6 15.8 12 21 12 21Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                        <path d="M12 12.2C13.215 12.2 14.2 11.215 14.2 10C14.2 8.785 13.215 7.8 12 7.8C10.785 7.8 9.8 8.785 9.8 10C9.8 11.215 10.785 12.2 12 12.2Z" stroke="currentColor" stroke-width="1.8"/>
                    </svg>
                    ${escapeHTML(property.location || 'Location unavailable')}
                </p>
                <p class="property-price">${formatPrice(property.price)}</p>
                <span class="property-type-tag">${escapeHTML(property.type || 'Property')}</span>
                <a class="view-details-btn" href="property-details.html?id=${encodeURIComponent(property.id)}">View Details</a>
            </div>
        </article>
    `;
}

function revealRenderedCards() {
    const cards = Array.from(document.querySelectorAll('#property-grid .property-card, #similar-properties .property-card'));

    cards.forEach((card, index) => {
        window.setTimeout(() => {
            card.classList.add('is-visible');
        }, index * 70);
    });
}

function showSkeletons() {
    const propertyGrid = document.getElementById('property-grid');

    if (!propertyGrid) {
        return;
    }

    const skeletonCards = Array.from({ length: 6 }, () => `
        <article class="property-card is-visible" aria-label="Loading property">
            <div class="property-card-image skeleton"></div>
            <div class="property-card-body">
                <div class="skeleton skeleton-line title"></div>
                <div class="skeleton skeleton-line location"></div>
                <div class="skeleton skeleton-line price"></div>
                <div class="skeleton skeleton-line type"></div>
                <div class="skeleton skeleton-line button"></div>
            </div>
        </article>
    `).join('');

    propertyGrid.innerHTML = skeletonCards;
}

function getInputValue(id) {
    return document.getElementById(id)?.value.trim() || '';
}

function applyPriceFilter(query, priceValue) {
    if (priceValue === 'under-5m') {
        return query.lt('price', 5000000);
    }

    if (priceValue === '5m-20m') {
        return query.gte('price', 5000000).lte('price', 20000000);
    }

    if (priceValue === '20m-50m') {
        return query.gte('price', 20000000).lte('price', 50000000);
    }

    if (priceValue === 'above-50m') {
        return query.gt('price', 50000000);
    }

    return query;
}

function sortProperties(properties, sortValue) {
    const sortedProperties = [...properties];

    if (sortValue === 'price-asc') {
        return sortedProperties.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }

    if (sortValue === 'price-desc') {
        return sortedProperties.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }

    if (sortValue === 'location-asc') {
        return sortedProperties.sort((a, b) => String(a.location || '').localeCompare(String(b.location || '')));
    }

    return sortedProperties.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function setListingEmptyState(isEmpty) {
    const emptyState = document.getElementById('empty-state');

    if (emptyState) {
        emptyState.hidden = !isEmpty;
    }
}

function updateResultsCount(count) {
    const resultsCount = document.getElementById('results-count');

    if (!resultsCount) {
        return;
    }

    resultsCount.textContent = `Showing ${count} ${count === 1 ? 'property' : 'properties'}`;
}

function updatePaginationControls(count) {
    const pagination = document.getElementById('pagination');

    if (!pagination) {
        return;
    }

    const totalPages = Math.max(1, Math.ceil(count / PROPERTIES_PER_PAGE));
    const previousButton = document.getElementById('pagination-prev');
    const nextButton = document.getElementById('pagination-next');
    const currentPageElement = document.getElementById('pagination-current');

    pagination.hidden = count <= PROPERTIES_PER_PAGE;

    if (previousButton) {
        previousButton.disabled = currentPage <= 1;
    }

    if (nextButton) {
        nextButton.disabled = currentPage >= totalPages;
    }

    if (currentPageElement) {
        currentPageElement.textContent = String(currentPage);
        currentPageElement.setAttribute('aria-label', `Page ${currentPage} of ${totalPages}`);
    }
}

function renderCurrentPropertyPage() {
    const propertyGrid = document.getElementById('property-grid');

    if (!propertyGrid) {
        return;
    }

    const totalCount = currentProperties.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PROPERTIES_PER_PAGE));

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    updateResultsCount(totalCount);
    updatePaginationControls(totalCount);

    if (totalCount === 0) {
        propertyGrid.innerHTML = '';
        setListingEmptyState(true);
        return;
    }

    const startIndex = (currentPage - 1) * PROPERTIES_PER_PAGE;
    const visibleProperties = currentProperties.slice(startIndex, startIndex + PROPERTIES_PER_PAGE);

    setListingEmptyState(false);
    propertyGrid.innerHTML = visibleProperties.map(createPropertyCard).join('');
    revealRenderedCards();
}

async function loadProperties() {
    const propertyGrid = document.getElementById('property-grid');

    if (!propertyGrid) {
        return;
    }

    const searchText = getInputValue('search-input');
    const locationValue = getInputValue('filter-location');
    const typeValue = getInputValue('filter-type');
    const priceValue = getInputValue('filter-price');
    const statusValue = getInputValue('filter-status') || 'verified';
    const sortValue = getInputValue('sort-by') || 'date-desc';

    setListingEmptyState(false);
    updatePaginationControls(0);
    showSkeletons();

    try {
        const client = getSupabaseClient();
        let query = client
            .from('properties')
            .select('*')
            .order('created_at', { ascending: false });

        if (statusValue === 'verified') {
            query = query.eq('status', 'verified');
        }

        if (searchText) {
            query = query.or(`title.ilike.%${searchText}%,location.ilike.%${searchText}%`);
        }

        if (locationValue && locationValue.toLowerCase() !== 'all') {
            query = query.eq('location', locationValue);
        }

        if (typeValue && typeValue.toLowerCase() !== 'all') {
            query = query.eq('type', typeValue);
        }

        query = applyPriceFilter(query, priceValue);

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        currentProperties = sortProperties(data || [], sortValue);

        renderCurrentPropertyPage();
    } catch (error) {
        console.error('Error loading properties:', error);
        currentProperties = [];
        propertyGrid.innerHTML = '';
        updateResultsCount(0);
        updatePaginationControls(0);
        setListingEmptyState(true);
    }
}

function loadFirstPage() {
    currentPage = 1;
    loadProperties();
}

function setupPaginationButtons() {
    const previousButton = document.getElementById('pagination-prev');
    const nextButton = document.getElementById('pagination-next');

    if (previousButton) {
        previousButton.addEventListener('click', () => {
            if (currentPage <= 1) {
                return;
            }

            currentPage -= 1;
            renderCurrentPropertyPage();
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(currentProperties.length / PROPERTIES_PER_PAGE));

            if (currentPage >= totalPages) {
                return;
            }

            currentPage += 1;
            renderCurrentPropertyPage();
        });
    }
}

function initListingPage() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    const filterBar = document.getElementById('filter-bar');
    const clearFiltersBtn = document.querySelector('.clear-filters-btn');
    const filterControls = Array.from(document.querySelectorAll('#filter-location, #filter-type, #filter-price, #filter-status, #sort-by'));

    setupPaginationButtons();
    loadFirstPage();

    if (filterBar) {
        filterBar.addEventListener('submit', (event) => {
            event.preventDefault();
            loadFirstPage();
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', (event) => {
            event.preventDefault();
            loadFirstPage();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                loadFirstPage();
            }
        });
    }

    filterControls.forEach((control) => {
        control.addEventListener('change', loadFirstPage);
    });

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            const searchInputElement = document.getElementById('search-input');
            const locationFilter = document.getElementById('filter-location');
            const typeFilter = document.getElementById('filter-type');
            const priceFilter = document.getElementById('filter-price');
            const statusFilter = document.getElementById('filter-status');
            const sortBy = document.getElementById('sort-by');

            if (searchInputElement) {
                searchInputElement.value = '';
            }

            if (locationFilter) {
                locationFilter.value = '';
            }

            if (typeFilter) {
                typeFilter.value = '';
            }

            if (priceFilter) {
                priceFilter.value = '';
            }

            if (statusFilter) {
                statusFilter.value = 'verified';
            }

            if (sortBy) {
                sortBy.value = 'date-desc';
            }

            loadFirstPage();
        });
    }
}

function setElementText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function renderPropertyImages(property) {
    const imageUrls = getImageUrls(property);
    const mainImage = document.getElementById('main-image');
    const thumbnails = document.getElementById('thumbnails');

    if (!mainImage) {
        return;
    }

    if (imageUrls.length > 0) {
        mainImage.textContent = '';
        mainImage.style.backgroundImage = `url('${imageUrls[0].replace(/'/g, "%27")}')`;
        mainImage.style.backgroundPosition = 'center';
        mainImage.style.backgroundSize = 'cover';
        mainImage.style.backgroundRepeat = 'no-repeat';
    }

    if (!thumbnails || imageUrls.length === 0) {
        return;
    }

    thumbnails.innerHTML = imageUrls.slice(0, 4).map((imageUrl, index) => `
        <div class="thumbnail ${index === 0 ? 'active' : ''}" style="background-image: url('${escapeHTML(imageUrl).replace(/'/g, '%27')}'); background-position: center; background-size: cover;" aria-label="Property image ${index + 1}"></div>
    `).join('');

    thumbnails.querySelectorAll('.thumbnail').forEach((thumbnail, index) => {
        thumbnail.addEventListener('click', () => {
            thumbnails.querySelectorAll('.thumbnail').forEach((item) => item.classList.remove('active'));
            thumbnail.classList.add('active');
            mainImage.style.backgroundImage = `url('${imageUrls[index].replace(/'/g, "%27")}')`;
        });
    });
}

function renderStatusBadge(status) {
    const statusBadge = document.getElementById('status-badge');

    if (!statusBadge) {
        return;
    }

    statusBadge.innerHTML = getBadgeHTML(status);

    const badgeElement = statusBadge.firstElementChild;

    if (badgeElement) {
        badgeElement.style.position = 'static';
        badgeElement.style.width = 'fit-content';
    }
}

async function loadPropertyDetails() {
    const params = new URLSearchParams(window.location.search);
    const propertyId = params.get('id');

    if (!propertyId) {
        window.location.href = 'property-listing.html';
        return;
    }

    const loadingSpinner = document.getElementById('loading-spinner');
    const detailsContainer = document.getElementById('property-details-container');
    const errorState = document.getElementById('error-state');

    if (loadingSpinner) {
        loadingSpinner.hidden = false;
    }

    if (detailsContainer) {
        detailsContainer.hidden = true;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .single();

        if (error || !data) {
            if (loadingSpinner) {
                loadingSpinner.hidden = true;
            }

            if (errorState) {
                errorState.hidden = false;
            }

            return;
        }

        if (loadingSpinner) {
            loadingSpinner.hidden = true;
        }

        if (detailsContainer) {
            detailsContainer.hidden = false;
        }

        setElementText('property-title', data.title || 'Untitled Property');
        setElementText('property-price', formatPrice(data.price));
        setElementText('property-location', data.location || 'Location unavailable');
        setElementText('property-type', data.type || 'Property');
        setElementText('property-size', data.size ? `${data.size} sqm` : 'Size unavailable');
        setElementText('property-date', formatDate(data.created_at));
        setElementText('property-description', data.description || 'No description has been provided for this property.');
        renderStatusBadge(data.status);

        const verifiedBox = document.getElementById('verified-box');

        if (data.status === 'verified') {
            if (verifiedBox) {
                verifiedBox.hidden = false;
            }

            setElementText('verified-date', formatDate(data.verified_at));
            setElementText('admin-notes', data.admin_notes || 'This listing has been reviewed and approved by RealVerify.');
        } else if (verifiedBox) {
            verifiedBox.hidden = true;
        }

        renderPropertyImages(data);

        const similarSection = document.getElementById('similar-section');

        if (similarSection) {
            similarSection.hidden = false;
        }

        await loadSimilarProperties(data.type, data.id);
    } catch (error) {
        console.error('Error loading property details:', error);

        if (loadingSpinner) {
            loadingSpinner.hidden = true;
        }

        if (errorState) {
            errorState.hidden = false;
        }
    }
}

async function loadSimilarProperties(type, currentId) {
    const similarSection = document.getElementById('similar-section');
    const similarProperties = document.getElementById('similar-properties');

    if (!similarProperties) {
        return;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('properties')
            .select('*')
            .eq('status', 'verified')
            .eq('type', type)
            .neq('id', currentId)
            .limit(3);

        if (error) {
            throw error;
        }

        const properties = data || [];

        if (properties.length === 0) {
            if (similarSection) {
                similarSection.hidden = true;
            }

            similarProperties.innerHTML = '';
            return;
        }

        if (similarSection) {
            similarSection.hidden = false;
        }

        similarProperties.innerHTML = properties.map(createPropertyCard).join('');
        revealRenderedCards();
    } catch (error) {
        console.error('Error loading similar properties:', error);

        if (similarSection) {
            similarSection.hidden = true;
        }

        similarProperties.innerHTML = '';
    }
}

function initReportButton() {
    const reportBtn = document.getElementById('report-btn');

    if (!reportBtn) {
        return;
    }

    reportBtn.addEventListener('click', async () => {
        const params = new URLSearchParams(window.location.search);
        const propertyId = params.get('id');
        const reason = window.prompt('Please tell us why this listing looks suspicious:');

        if (!reason || !reason.trim()) {
            return;
        }

        try {
            const client = getSupabaseClient();
            const { data: sessionData } = await client.auth.getSession();
            const reporterId = sessionData?.session?.user?.id || null;
            const { error } = await client
                .from('fraud_flags')
                .insert({
                    property_id: propertyId,
                    reported_by: reporterId,
                    reason: reason.trim(),
                    is_dismissed: false,
                    created_at: new Date().toISOString()
                });

            if (error) {
                throw error;
            }

            window.alert('Report submitted. Thank you.');
        } catch (error) {
            console.error('Error submitting report:', error);
            window.alert('Unable to submit report. Please try again.');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('property-grid')) {
        initListingPage();
    }

    if (document.getElementById('property-title')) {
        loadPropertyDetails();
        initReportButton();
    }
});
