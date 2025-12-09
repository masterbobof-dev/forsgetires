
export const PRESET_COLORS = [
    { name: 'Чорний (Бренд)', value: 'bg-black border border-zinc-800' },
    { name: 'Темний Метал', value: 'bg-zinc-900 border border-zinc-700' },
    { name: 'Червоний', value: 'bg-gradient-to-r from-red-900 to-black' },
    { name: 'Жовтий', value: 'bg-gradient-to-r from-yellow-900 to-black' },
    { name: 'Синій', value: 'bg-gradient-to-r from-blue-950 to-black' },
    { name: 'Фіолетовий', value: 'bg-gradient-to-r from-purple-950 to-black' },
];

// SVG Patterns encoded for CSS
const CARBON_FIBER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath fill-rule='evenodd' d='M0 0h4v4H0V0zm4 4h4v4H4V4z'/%3E%3C/g%3E%3C/svg%3E")`;
const SPEED_LINES = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;
const CIRCUIT_BOARD = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E")`;
const TIRE_TREAD = `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20h20v20H0V20zm20 0h20v20H20V20zM0 0h20v20H0V0zm20 0h20v20H20V0z' fill='%23ffffff' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E")`;
const HEXAGONS = `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1h2v2H1V1zm4 0h2v2H5V1zm4 0h2v2H9V1zM1 5h2v2H1V5zm4 0h2v2H5V5zm4 0h2v2H9V5zM1 9h2v2H1V9zm4 0h2v2H5V9zm4 0h2v2H9V9zM1 13h2v2H1v-2zm4 0h2v2H5v-2zm4 0h2v2H9v-2z' fill='%23ffffff' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E")`;
const GRUNGE_LINES = `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40' stroke='%23ffffff' stroke-width='2' stroke-opacity='0.1'/%3E%3C/svg%3E")`;

export const PATTERNS = [
    { name: 'Без візерунка', value: 'none' },
    { name: 'Карбон (Carbon)', value: CARBON_FIBER },
    { name: 'Техно (Circuit)', value: CIRCUIT_BOARD },
    { name: 'Швидкість (Speed)', value: SPEED_LINES },
    { name: 'Шина (Tire)', value: TIRE_TREAD },
    { name: 'Сітка (Hex)', value: HEXAGONS },
    { name: 'Графіті Лінії', value: GRUNGE_LINES },
];

export interface Banner {
    id: number;
    active: boolean;
    title: string;
    text: string;
    buttonText: string;
    link: string;
    color: string;
    pattern?: string;
    patternOpacity?: number;
    image_url?: string;
    // Background Image
    backgroundImage?: string;
    backgroundConfig?: {
        opacity: number;
        positionY: number;
        overlayOpacity: number;
    };
    imageConfig?: {
        scale: number;
        xOffset: number;
        yOffset: number;
        shadow: boolean;
        glow: boolean;
        vignette: boolean;
        maskType: 'radial' | 'linear';
        maskDirection?: 'left' | 'right' | 'top' | 'bottom'; // Added direction
        vignetteStrength: number;
        opacity: number; 
    };
}

export const DEFAULT_IMG_CONFIG = {
    scale: 100,
    xOffset: 0,
    yOffset: 0,
    shadow: true,
    glow: false,
    vignette: true,
    maskType: 'linear' as 'linear',
    maskDirection: 'right' as 'right', // Default fade to right (standard)
    vignetteStrength: 30,
    opacity: 100
};

export const DEFAULT_BG_CONFIG = {
    opacity: 100,
    positionY: 50,
    overlayOpacity: 40
};
