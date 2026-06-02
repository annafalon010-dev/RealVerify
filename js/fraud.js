const getClient = () => {
    if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase client is not loaded. Make sure js/supabase.js is included before js/fraud.js.');
    }

    return supabaseClient;
};

const normalizeText = (value) => String(value || '').trim();

const createErrorResponse = (message) => ({
    success: false,
    message
});

export async function checkDuplicateListing(title, location) {
    const cleanTitle = normalizeText(title);
    const cleanLocation = normalizeText(location);

    if (!cleanTitle || !cleanLocation) {
        return { isDuplicate: false };
    }

    const { data, error } = await getClient()
        .from('properties')
        .select('*')
        .ilike('title', `%${cleanTitle}%`)
        .ilike('location', cleanLocation);

    if (error) {
        throw error;
    }

    const matches = data || [];

    if (matches.length > 0) {
        return {
            isDuplicate: true,
            matches,
            message: `Warning: ${matches.length} similar listings found`
        };
    }

    return { isDuplicate: false };
}

export async function flagSuspiciousActivity(propertyId, reason, userId) {
    const cleanReason = normalizeText(reason);

    if (!propertyId || !cleanReason || !userId) {
        return createErrorResponse('Missing required report information');
    }

    const client = getClient();
    const { data: existingFlags, error: existingError } = await client
        .from('fraud_flags')
        .select('id')
        .eq('property_id', propertyId)
        .eq('reported_by', userId)
        .limit(1);

    if (existingError) {
        return createErrorResponse(existingError.message);
    }

    if (existingFlags && existingFlags.length > 0) {
        return {
            success: false,
            message: 'Already reported'
        };
    }

    const { error: insertError } = await client
        .from('fraud_flags')
        .insert({
            property_id: propertyId,
            reported_by: userId,
            reason: cleanReason,
            is_dismissed: false,
            created_at: new Date().toISOString()
        });

    if (insertError) {
        return createErrorResponse(insertError.message);
    }

    return {
        success: true,
        message: 'Report submitted'
    };
}

export async function monitorRecentUploads() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await getClient()
        .from('properties')
        .select('id, user_id, created_at')
        .gte('created_at', since);

    if (error) {
        throw error;
    }

    const recentUploads = data || [];
    const uploadCounts = recentUploads.reduce((counts, property) => {
        if (!property.user_id) {
            return counts;
        }

        counts[property.user_id] = (counts[property.user_id] || 0) + 1;
        return counts;
    }, {});

    const suspiciousUsers = Object.entries(uploadCounts)
        .filter(([, uploadCount]) => uploadCount > 3)
        .map(([userId, uploadCount]) => ({
            user_id: userId,
            upload_count: uploadCount,
            reason: 'More than 3 property uploads in the last 24 hours'
        }));

    return {
        suspiciousUsers,
        totalRecent: recentUploads.length
    };
}

export async function getFraudFlags() {
    const client = getClient();
    const { data, error } = await client
        .from('fraud_flags')
        .select(`
            *,
            properties (
                id,
                title
            ),
            profiles:reported_by (
                id,
                full_name,
                email
            )
        `)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

export async function dismissFraudFlag(flagId) {
    if (!flagId) {
        return { success: false };
    }

    const { error } = await getClient()
        .from('fraud_flags')
        .update({ is_dismissed: true })
        .eq('id', flagId);

    if (error) {
        return { success: false };
    }

    return { success: true };
}

if (typeof window !== 'undefined') {
    window.RealVerifyFraud = {
        checkDuplicateListing,
        flagSuspiciousActivity,
        monitorRecentUploads,
        getFraudFlags,
        dismissFraudFlag
    };
}
