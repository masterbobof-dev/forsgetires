import { supabase } from '../../supabaseClient';

export type AnalyticsEventType = 'page_view' | 'view_item' | 'add_to_cart';

const getSessionId = () => {
    let sid = sessionStorage.getItem('analytics_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('analytics_session_id', sid);
    }
    return sid;
};

export const logAnalyticsEvent = async (
    eventType: AnalyticsEventType, 
    itemId?: string, 
    itemName?: string, 
    pathName?: string
) => {
    try {
        const payload = {
            session_id: getSessionId(),
            event_type: eventType,
            item_id: itemId || null,
            item_name: itemName || null,
            path_name: pathName || window.location.pathname
        };
        // Background insert without awaiting to avoid blocking UI
        supabase.from('analytics_events').insert([payload]).then();
    } catch (e) {
        // Silently fail to not interrupt user experience
        console.warn('Analytics logging failed:', e);
    }
};
