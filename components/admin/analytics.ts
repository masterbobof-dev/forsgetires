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

// Хелпер для визначення типу пристрою
const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let device = 'Desktop';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) device = 'Tablet';
    else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) device = 'Mobile';

    // Спрощене визначення ОС та Браузера
    let os = 'Unknown OS';
    if (ua.indexOf('Win') !== -1) os = 'Windows';
    if (ua.indexOf('Mac') !== -1) os = 'macOS';
    if (ua.indexOf('Linux') !== -1) os = 'Linux';
    if (ua.indexOf('Android') !== -1) os = 'Android';
    if (ua.indexOf('like Mac') !== -1) os = 'iOS';

    let browser = 'Other';
    if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
    if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
    if (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1) browser = 'Safari';
    if (ua.indexOf('Edge') !== -1) browser = 'Edge';

    return { device, os, browser, resolution: `${window.screen.width}x${window.screen.height}` };
};

// Кешування геопозиції в межах сесії, щоб не спамити API
const getGeoInfo = async () => {
    const cached = sessionStorage.getItem('analytics_geo');
    if (cached) return JSON.parse(cached);

    try {
        const res = await fetch('https://ip-api.com/json/?fields=status,country,city');
        const data = await res.json();
        if (data.status === 'success') {
            const geo = { country: data.country, city: data.city };
            sessionStorage.setItem('analytics_geo', JSON.stringify(geo));
            return geo;
        }
    } catch (e) {
        console.warn('Geo tracking failed');
    }
    return { country: 'Unknown', city: 'Unknown' };
};

export const logAnalyticsEvent = async (
    eventType: AnalyticsEventType, 
    itemId?: string, 
    itemName?: string, 
    pathName?: string
) => {
    try {
        const device = getDeviceInfo();
        const geo = await getGeoInfo();

        const payload = {
            session_id: getSessionId(),
            event_type: eventType,
            item_id: itemId || null,
            item_name: itemName || null,
            path_name: pathName || window.location.pathname,
            device_type: device.device,
            browser_name: device.browser,
            os_name: device.os,
            screen_resolution: device.resolution,
            country: geo.country,
            city: geo.city
        };

        // Background insert without awaiting to avoid blocking UI
        supabase.from('analytics_events').insert([payload]).then();
    } catch (e) {
        // Silently fail to not interrupt user experience
        console.warn('Analytics logging failed:', e);
    }
};
