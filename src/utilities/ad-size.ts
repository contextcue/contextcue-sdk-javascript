type AdSize = {
    width: number;
    height: number;
};
const AdSizes: AdSize[] = [
    { width: 300, height: 250 },
    { width: 160, height: 600 },
    { width: 300, height: 600 },
    { width: 336, height: 280 },
    { width: 728, height: 90 },
    { width: 320, height: 100 },
    { width: 320, height: 50 }
];

export const calculateAdSize = (slot: HTMLElement) => {
    let finalSize: AdSize | undefined;
    let diff = Number.POSITIVE_INFINITY;
    const width = slot.offsetWidth || parseInt(slot.style.width || '');
    const height = slot.offsetHeight || parseInt(slot.style.height || '');

    if ((height === 0 || isNaN(height)) && width !== 0) {
        const availableSizes = AdSizes.filter(adSize => adSize.width <= width);

        for (const size of availableSizes) {
            const thisDiff = width - size.width;
            if (thisDiff === 0) {
                // Found a perfect match for the width, lets roll with it
                return size;
            }
            if (thisDiff < diff) {
                diff = thisDiff;
                finalSize = size;
            }
        }
    } else {
        // Filter out all ads that are larger than slot we are trying to find an ad for
        const availableSizes = AdSizes.filter(adSize => adSize.height <= height && adSize.width <= width);

        for (const size of availableSizes) {
            const thisDiff = (width - size.width) + (height - size.height);
            if (thisDiff === 0) {
                // Found a perfect match
                return size;
            }
            if (thisDiff < diff) {
                diff = thisDiff;
                finalSize = size;
            }
        }
    }

    if (finalSize) {
        return finalSize;
    } else {
        return undefined;
    }
};
